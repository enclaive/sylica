/** @file
  Driver to expose blobs

  Copyright (C) 2026, Enclaive GmbH

  License: NFSL-1.0
**/

#include <PiDxe.h>

#include <Library/BaseLib.h>
#include <Library/BaseMemoryLib.h>
#include <Library/BlobVerifierLib.h>
#include <Library/DebugLib.h>
#include <Library/DevicePathLib.h>
#include <Library/MemoryAllocationLib.h>
#include <Library/PrintLib.h>
#include <Library/QemuFwCfgLib.h>
#include <Library/UefiBootServicesTableLib.h>

#include <Guid/FileInfo.h>
#include <Guid/FileSystemInfo.h>
#include <Guid/FileSystemVolumeLabelInfo.h>
#include <Guid/LinuxEfiInitrdMedia.h>
#include <Guid/QemuLoaderMedia.h>

#include <Protocol/LoadFile2.h>
#include <Protocol/SimpleFileSystem.h>

#define NameSize 48

typedef struct
{
  CHAR16 Name[NameSize];
  UINT32 Size;
  UINT8 *Data;

  FIRMWARE_CONFIG_ITEM SizeKey;
  FIRMWARE_CONFIG_ITEM DataKey;
} LOADER_ITEM;

STATIC UINTN mFetchedItems = 0;

// traditionally the kernel consisted of two separate blobs, but we only support a single named blob
#define InitrdIndex 1
STATIC LOADER_ITEM mLoaderItems[] = {
    {.Name = L"kernel", .Size = 0, .Data = NULL,
     .SizeKey = -1, .DataKey = -1},
    {.Name = L"initrd", .Size = 0, .Data = NULL,
     .SizeKey = QemuFwCfgItemInitrdSize, .DataKey = QemuFwCfgItemInitrdData},
    {.Name = L"cmdline", .Size = 0, .Data = NULL,
     .SizeKey = QemuFwCfgItemCommandLineSize, .DataKey = QemuFwCfgItemCommandLineData},
    {.Name = L"EFI\\BOOT\\BOOTX64.EFI", .Size = 0, .Data = NULL,
     .SizeKey = -1, .DataKey = -1},
    {.Name = L"startup.nsh", .Size = 0, .Data = NULL,
     .SizeKey = -1, .DataKey = -1},
};
STATIC UINT64 mTotalBytes;

STATIC
LOADER_ITEM *
LookupItem (
  const CHAR16 *Name)
{
  for (UINTN j = 0; j < ARRAY_SIZE (mLoaderItems); j++) {
    if (StrCmp (mLoaderItems[j].Name, Name) == 0) {
      return &mLoaderItems[j];
    }
  }
  return NULL;
}

#pragma pack (1)
typedef struct
{
  VENDOR_DEVICE_PATH VenMediaNode;
  EFI_DEVICE_PATH_PROTOCOL EndNode;
} SINGLE_VENMEDIA_NODE_DEVPATH;
#pragma pack ()

STATIC CONST SINGLE_VENMEDIA_NODE_DEVPATH mKernelDevicePath = {
    .VenMediaNode = {
        .Header = {
            .Type = MEDIA_DEVICE_PATH, .SubType = MEDIA_VENDOR_DP,
            .Length = {sizeof (VENDOR_DEVICE_PATH)}
        },
        .Guid = QEMU_LOADER_MEDIA_GUID
    },
    .EndNode = {
        .Type = END_DEVICE_PATH_TYPE, .SubType = END_ENTIRE_DEVICE_PATH_SUBTYPE,
        .Length = {sizeof (EFI_DEVICE_PATH_PROTOCOL)}
    }
};

STATIC CONST SINGLE_VENMEDIA_NODE_DEVPATH mInitrdDevicePath = {
    .VenMediaNode = {
        .Header = {
            .Type = MEDIA_DEVICE_PATH, .SubType = MEDIA_VENDOR_DP,
            .Length = {sizeof (VENDOR_DEVICE_PATH)}
        },
        .Guid = LINUX_EFI_INITRD_MEDIA_GUID
    },
    .EndNode = {
        .Type = END_DEVICE_PATH_TYPE, .SubType = END_ENTIRE_DEVICE_PATH_SUBTYPE,
        .Length = {sizeof (EFI_DEVICE_PATH_PROTOCOL)}
    }
};

typedef struct
{
  UINT64 Signature;
  LOADER_ITEM *Item;
  UINT64 Position; // Byte position for regular files or directory index for root
  EFI_FILE_PROTOCOL File;
} STUB_FILE;

#define STUB_FILE_SIG  SIGNATURE_64 ('S', 'T', 'U', 'B', 'F', 'I', 'L', 'E')
#define STUB_FILE_FROM_FILE(FilePointer) \
        CR (FilePointer, STUB_FILE, File, STUB_FILE_SIG)

STATIC
EFI_STATUS
BlobTypeToFileInfo (IN LOADER_ITEM *Item,
                    IN OUT UINTN *BufferSize, OUT VOID *Buffer)
{
  CONST CHAR16 *Name = L"";
  UINT64 FileSize = mFetchedItems;
  UINT64 Attribute = EFI_FILE_READ_ONLY | EFI_FILE_DIRECTORY;

  if (Item != NULL) {
    Name = Item->Name;
    FileSize = Item->Size;
    Attribute = EFI_FILE_READ_ONLY;
  }

  const UINTN InfoNameSize = StrSize (Name);
  const UINTN FileInfoSize = SIZE_OF_EFI_FILE_INFO + InfoNameSize;

  if (*BufferSize < FileInfoSize) {
    *BufferSize = FileInfoSize;
    return EFI_BUFFER_TOO_SMALL;
  }

  EFI_FILE_INFO *FileInfo = Buffer;
  FileInfo->Size = FileInfoSize;
  FileInfo->FileSize = FileSize;
  FileInfo->PhysicalSize = FileSize;
  FileInfo->Attribute = Attribute;
  CopyMem (FileInfo->FileName, Name, InfoNameSize);

  *BufferSize = FileInfoSize;
  return EFI_SUCCESS;
}

STATIC EFI_STATUS
CreateStubFile (IN LOADER_ITEM *Item, OUT EFI_FILE_PROTOCOL **NewHandle);

STATIC EFI_STATUS
EFIAPI
StubFileOpen (
  IN EFI_FILE_PROTOCOL *This,
  OUT EFI_FILE_PROTOCOL **NewHandle,
  IN CHAR16 *FileName,
  IN UINT64 OpenMode,
  IN UINT64 Attributes
)
{
  DEBUG ((DEBUG_INFO, "%a: %s\n", __func__, FileName));

  if ((OpenMode & EFI_FILE_MODE_WRITE) != 0 || (OpenMode & EFI_FILE_MODE_CREATE) != 0) {
    return EFI_WRITE_PROTECTED;
  }

  if (OpenMode != EFI_FILE_MODE_READ) {
    return EFI_INVALID_PARAMETER;
  }

  CONST STUB_FILE *StubFile = STUB_FILE_FROM_FILE (This);
  if (StubFile->Item != NULL) {
    // Only the root directory supports opening files in it
    return EFI_UNSUPPORTED;
  }

  if (FileName[0] == '\\') {
    // \\EFI\\BOOT\\BOOTX64.EFI / for injected files loaded from media
    FileName++;
  }

  LOADER_ITEM *Item = LookupItem (FileName);
  if (Item == NULL) {
    return EFI_NOT_FOUND;
  }

  return CreateStubFile (Item, NewHandle);
}

STATIC EFI_STATUS EFIAPI
StubFileClose (IN EFI_FILE_PROTOCOL *This)
{
  STUB_FILE *StubFile = STUB_FILE_FROM_FILE (This);
  DEBUG ((DEBUG_VERBOSE, "%a: %s\n", __func__, StubFile->Item != NULL ? StubFile->Item->Name : L"root"));
  FreePool (StubFile);
  return EFI_SUCCESS;
}

STATIC EFI_STATUS EFIAPI
StubFileDelete (IN EFI_FILE_PROTOCOL *This)
{
  STUB_FILE *StubFile = STUB_FILE_FROM_FILE (This);
  DEBUG ((DEBUG_VERBOSE, "%a: %s\n", __func__, StubFile->Item != NULL ? StubFile->Item->Name : L"root"));
  FreePool (StubFile);
  return EFI_WARN_DELETE_FAILURE;
}

STATIC EFI_STATUS EFIAPI
StubFileRead (IN EFI_FILE_PROTOCOL *This,
              IN OUT UINTN *BufferSize, OUT VOID *Buffer)
{
  STUB_FILE *StubFile = STUB_FILE_FROM_FILE (This);
  DEBUG ((DEBUG_VERBOSE, "%a: %s\n", __func__, StubFile->Item != NULL ? StubFile->Item->Name : L"root"));

  if (StubFile->Item == NULL) {
    if (StubFile->Position == mFetchedItems) {
      *BufferSize = 0;
      return EFI_SUCCESS;
    }

    if (StubFile->Position > mFetchedItems) {
      return EFI_DEVICE_ERROR;
    }

    // Find the nth fetched item
    UINTN FetchedCount = 0;
    UINTN ItemIndex;
    for (ItemIndex = 0; ItemIndex < ARRAY_SIZE (mLoaderItems); ItemIndex++)
      if (mLoaderItems[ItemIndex].Size != 0)
        if (FetchedCount++ == StubFile->Position)
          break;

    const EFI_STATUS Status = BlobTypeToFileInfo (&mLoaderItems[ItemIndex], BufferSize, Buffer);
    if (EFI_ERROR (Status)) {
      return Status;
    }

    StubFile->Position++;
    return EFI_SUCCESS;
  }

  LOADER_ITEM *Item = StubFile->Item;
  if (StubFile->Position > Item->Size) {
    DEBUG ((DEBUG_VERBOSE, "%a: %d, %d bytes\n", __func__, Item->Size, StubFile->Position));
    return EFI_DEVICE_ERROR;
  }

  if (*BufferSize > Item->Size - StubFile->Position) {
    *BufferSize = Item->Size - StubFile->Position;
  }

  if (Item->Data != NULL) {
    DEBUG ((DEBUG_VERBOSE, "%a: %d bytes\n", __func__, *BufferSize));
    CopyMem (Buffer, Item->Data + StubFile->Position, *BufferSize);
  }

  StubFile->Position += *BufferSize;
  return EFI_SUCCESS;
}

STATIC EFI_STATUS EFIAPI
StubFileWrite (IN EFI_FILE_PROTOCOL *This,
               IN OUT UINTN *BufferSize, IN VOID *Buffer)
{
  const STUB_FILE *StubFile = STUB_FILE_FROM_FILE (This);
  DEBUG ((DEBUG_VERBOSE, "%a: %s\n", __func__, StubFile->Item != NULL ? StubFile->Item->Name : L"root"));
  return StubFile->Item == NULL ? EFI_UNSUPPORTED : EFI_WRITE_PROTECTED;
}

STATIC EFI_STATUS EFIAPI
StubFileGetPosition (IN EFI_FILE_PROTOCOL *This, OUT UINT64 *Position)
{
  const STUB_FILE *StubFile = STUB_FILE_FROM_FILE (This);
  DEBUG ((DEBUG_VERBOSE, "%a: %s\n", __func__, StubFile->Item != NULL ? StubFile->Item->Name : L"root"));

  if (StubFile->Item == NULL) {
    return EFI_UNSUPPORTED;
  }

  *Position = StubFile->Position;
  return EFI_SUCCESS;
}

STATIC EFI_STATUS EFIAPI
StubFileSetPosition (IN EFI_FILE_PROTOCOL *This, IN UINT64 Position)
{
  STUB_FILE *StubFile = STUB_FILE_FROM_FILE (This);
  DEBUG ((DEBUG_VERBOSE, "%a: %s\n", __func__, StubFile->Item != NULL ? StubFile->Item->Name : L"root"));

  if (StubFile->Item == NULL) {
    if (Position == 0) {
      StubFile->Position = 0;
      return EFI_SUCCESS;
    }
    return EFI_UNSUPPORTED;
  }

  if (Position == MAX_UINT64) {
    StubFile->Position = StubFile->Item->Size;
  } else {
    StubFile->Position = Position;
  }
  return EFI_SUCCESS;
}

STATIC EFI_STATUS EFIAPI
StubFileGetInfo (IN EFI_FILE_PROTOCOL *This, IN EFI_GUID *InformationType,
                 IN OUT UINTN *BufferSize, OUT VOID *Buffer)
{
  CONST STUB_FILE *StubFile = STUB_FILE_FROM_FILE (This);
  DEBUG ((DEBUG_VERBOSE, "%a: %s\n", __func__, StubFile->Item != NULL ? StubFile->Item->Name : L"root"));

  if (CompareGuid (InformationType, &gEfiFileInfoGuid)) {
    return BlobTypeToFileInfo (StubFile->Item, BufferSize, Buffer);
  }

  if (CompareGuid (InformationType, &gEfiFileSystemInfoGuid)) {
    EFI_FILE_SYSTEM_INFO *FileSystemInfo;

    if (*BufferSize < sizeof *FileSystemInfo) {
      *BufferSize = sizeof *FileSystemInfo;
      return EFI_BUFFER_TOO_SMALL;
    }

    FileSystemInfo = (EFI_FILE_SYSTEM_INFO *)Buffer;
    FileSystemInfo->Size = sizeof *FileSystemInfo;
    FileSystemInfo->ReadOnly = TRUE;
    FileSystemInfo->VolumeSize = mTotalBytes;
    FileSystemInfo->FreeSpace = 0;
    FileSystemInfo->BlockSize = 1;
    FileSystemInfo->VolumeLabel[0] = L'\0';

    *BufferSize = sizeof *FileSystemInfo;
    return EFI_SUCCESS;
  }

  if (CompareGuid (InformationType, &gEfiFileSystemVolumeLabelInfoIdGuid)) {
    EFI_FILE_SYSTEM_VOLUME_LABEL *FileSystemVolumeLabel;

    if (*BufferSize < sizeof *FileSystemVolumeLabel) {
      *BufferSize = sizeof *FileSystemVolumeLabel;
      return EFI_BUFFER_TOO_SMALL;
    }

    FileSystemVolumeLabel = (EFI_FILE_SYSTEM_VOLUME_LABEL *)Buffer;
    FileSystemVolumeLabel->VolumeLabel[0] = L'\0';

    *BufferSize = sizeof *FileSystemVolumeLabel;
    return EFI_SUCCESS;
  }

  return EFI_UNSUPPORTED;
}

STATIC EFI_STATUS EFIAPI
StubFileSetInfo (IN EFI_FILE_PROTOCOL *This, IN EFI_GUID *InformationType,
                 IN UINTN BufferSize, IN VOID *Buffer)
{
  DEBUG ((DEBUG_VERBOSE, "%a\n", __func__));
  return EFI_WRITE_PROTECTED;
}

STATIC EFI_STATUS EFIAPI
StubFileFlush (IN EFI_FILE_PROTOCOL *This)
{
  DEBUG ((DEBUG_VERBOSE, "%a\n", __func__));
  return EFI_WRITE_PROTECTED;
}

STATIC CONST EFI_FILE_PROTOCOL mEfiFileProtocolTemplate = {
    .Revision = EFI_FILE_PROTOCOL_REVISION,
    .Open = StubFileOpen,
    .Close = StubFileClose,
    .Delete = StubFileDelete,
    .Read = StubFileRead,
    .Write = StubFileWrite,
    .GetPosition = StubFileGetPosition,
    .SetPosition = StubFileSetPosition,
    .GetInfo = StubFileGetInfo,
    .SetInfo = StubFileSetInfo,
    .Flush = StubFileFlush,
    .OpenEx = NULL,
    .ReadEx = NULL,
    .WriteEx = NULL,
    .FlushEx = NULL
};

STATIC
EFI_STATUS
CreateStubFile (IN LOADER_ITEM *Item, OUT EFI_FILE_PROTOCOL **NewHandle)
{
  STUB_FILE *StubFile = AllocatePool (sizeof *StubFile);
  if (StubFile == NULL) {
    return EFI_OUT_OF_RESOURCES;
  }

  StubFile->Signature = STUB_FILE_SIG;
  StubFile->Item = Item;
  StubFile->Position = 0;
  CopyMem (&StubFile->File, &mEfiFileProtocolTemplate, sizeof mEfiFileProtocolTemplate);

  *NewHandle = &StubFile->File;

  return EFI_SUCCESS;
}

STATIC
EFI_STATUS
EFIAPI
StubFileOpenVolume (
  IN EFI_SIMPLE_FILE_SYSTEM_PROTOCOL *This,
  OUT EFI_FILE_PROTOCOL **Root
)
{
  DEBUG ((DEBUG_VERBOSE, "%a\n", __func__));
  return CreateStubFile (NULL, Root);
}

STATIC CONST EFI_SIMPLE_FILE_SYSTEM_PROTOCOL mFileSystem = {
    .Revision = EFI_SIMPLE_FILE_SYSTEM_PROTOCOL_REVISION,
    .OpenVolume = StubFileOpenVolume
};

STATIC
EFI_STATUS
EFIAPI
InitrdLoadFile2 (
  IN EFI_LOAD_FILE2_PROTOCOL *This,
  IN EFI_DEVICE_PATH_PROTOCOL *FilePath,
  IN BOOLEAN BootPolicy,
  IN OUT UINTN *BufferSize,
  OUT VOID *Buffer OPTIONAL
)
{
  DEBUG ((DEBUG_INFO, "%a: initrd read\n", __func__));

  const LOADER_ITEM *InitrdBlob = &mLoaderItems[InitrdIndex];

  ASSERT (InitrdBlob != NULL);
  ASSERT (InitrdBlob->Size > 0);
  ASSERT (InitrdBlob->Data != NULL);

  if (BootPolicy) {
    return EFI_UNSUPPORTED;
  }

  if (BufferSize == NULL || !IsDevicePathValid (FilePath, 0)) {
    return EFI_INVALID_PARAMETER;
  }

  if (FilePath->Type != END_DEVICE_PATH_TYPE || FilePath->SubType != END_ENTIRE_DEVICE_PATH_SUBTYPE) {
    return EFI_NOT_FOUND;
  }

  if (Buffer == NULL || *BufferSize < InitrdBlob->Size) {
    *BufferSize = InitrdBlob->Size;
    return EFI_BUFFER_TOO_SMALL;
  }

  CopyMem (Buffer, InitrdBlob->Data, InitrdBlob->Size);

  *BufferSize = InitrdBlob->Size;
  return EFI_SUCCESS;
}

STATIC CONST EFI_LOAD_FILE2_PROTOCOL mInitrdLoadFile2 = {
    .LoadFile = InitrdLoadFile2
};

typedef struct
{
  UINT32 Size;   /* size of referenced fw_cfg item, big-endian */
  UINT16 Select; /* selector key of fw_cfg item, big-endian */
  UINT16 Reserved;
  CHAR8 Name[QEMU_FW_CFG_FNAME_SIZE];
} FWCFG_FILE;

// https://github.com/qemu/qemu/blob/055952c0aa91ea7a00d135b73f78fc0b13442d6c/hw/nvram/fw_cfg.c#L46
#define MAXIMUM_SLOTS  0x20

STATIC
EFI_STATUS
LookupNamedBlobs ()
{
  QemuFwCfgSelectItem (QemuFwCfgItemFileDir);

  const UINT32 Count = SwapBytes32 (QemuFwCfgRead32 ());
  if (Count > MAXIMUM_SLOTS) {
    DEBUG ((DEBUG_ERROR, "%a: validate: too large %d\n", __func__, Count));
    return EFI_UNSUPPORTED;
  }
  const UINT32 DirSize = Count * sizeof (FWCFG_FILE);
  FWCFG_FILE *DirEntry = AllocatePool (DirSize);
  if (DirEntry == NULL) {
    return EFI_OUT_OF_RESOURCES;
  }

  QemuFwCfgReadBytes (DirSize, DirEntry);

  for (UINT32 i = 0; i < Count; i++) {
    if (AsciiStrnCmp (DirEntry[i].Name, "etc/boot/", 9) != 0) {
      continue;
    }

    CHAR16 Name[NameSize];
    UnicodeSPrint (Name, sizeof (Name), L"%a", DirEntry[i].Name + 9);

    LOADER_ITEM *Item = LookupItem (Name);
    if (Item == NULL) {
      continue;
    }

    Item->Size = SwapBytes32 (DirEntry[i].Size);
    Item->DataKey = SwapBytes16 (DirEntry[i].Select);

    DEBUG ((DEBUG_INFO, "%a: found %s (%d bytes) at %d\n", __func__, Name, Item->Size, Item->DataKey));
  }

  FreePool (DirEntry);
  return EFI_SUCCESS;
}

STATIC
EFI_STATUS
FetchBlob (LOADER_ITEM *item)
{
  if (item->Size == 0) {
    return EFI_SUCCESS;
  }

  DEBUG ((DEBUG_INFO, "%a: %s, %d bytes\n", __func__, item->Name, item->Size));

  item->Data = AllocatePool (item->Size);
  if (item->Data == NULL) {
    return EFI_OUT_OF_RESOURCES;
  }

  mTotalBytes += item->Size;

  QemuFwCfgSelectItem (item->DataKey);

  UINT8 *Dest = item->Data;
  UINT32 Bytes = item->Size;

  while (Bytes > 0) {
    const UINT32 Chunk = Bytes < SIZE_1MB ? Bytes : SIZE_1MB;
    QemuFwCfgReadBytes (Chunk, Dest);
    Bytes -= Chunk;
    Dest += Chunk;
  }

  return EFI_SUCCESS;
}

EFI_STATUS
EFIAPI
QemuLoaderEntrypoint (
  IN EFI_HANDLE ImageHandle,
  IN EFI_SYSTEM_TABLE *SystemTable
)
{
  EFI_HANDLE FileSystemHandle;
  EFI_HANDLE InitrdLoadFile2Handle;

  if (!QemuFwCfgIsAvailable ()) {
    return EFI_NOT_FOUND;
  }

  // get sizes for all blobs already known
  for (UINTN i = 0; i < ARRAY_SIZE (mLoaderItems); i++) {
    LOADER_ITEM *item = &mLoaderItems[i];
    if (item->SizeKey == -1) {
      continue;
    }
    QemuFwCfgSelectItem (item->SizeKey);
    item->Size = QemuFwCfgRead32 ();
  }

  // lookup named blobs to find kernel and allow override
  EFI_STATUS Status = LookupNamedBlobs ();
  if (EFI_ERROR (Status)) {
    DEBUG ((DEBUG_ERROR, "%a: LookupNamedBlobs failed: %r\n", __func__, Status));
    return EFI_NOT_FOUND;
  }

  // fetch blobs after lookup
  for (UINTN i = 0; i < ARRAY_SIZE (mLoaderItems); i++) {
    LOADER_ITEM *item = &mLoaderItems[i];
    if (item->DataKey == -1) {
      DEBUG ((DEBUG_INFO, "%a: invalid loader item: %s\n", __func__, item->Name));
      continue; // we don't enforce all blobs to be present
    }

    Status = FetchBlob (item);
    if (EFI_ERROR (Status)) {
      DEBUG ((DEBUG_ERROR, "%a: FetchBlob failed: %r\n", __func__, Status));
      goto FreeBlobs;
    }

    Status = VerifyBlob (item->Name, item->Data, item->Size);
    if (EFI_ERROR (Status)) {
      DEBUG ((DEBUG_ERROR, "%a: VerifyBlob failed: %r\n", __func__, Status));
      goto FreeBlobs;
    }

    if (item->Size > 0) // we only count non-zero blobs as fetched
      mFetchedItems++;
  }

  FileSystemHandle = NULL;
  Status = gBS->InstallMultipleProtocolInterfaces (
    &FileSystemHandle,
    &gEfiDevicePathProtocolGuid, &mKernelDevicePath,
    &gEfiSimpleFileSystemProtocolGuid, &mFileSystem,
    NULL
  );
  if (EFI_ERROR (Status)) {
    DEBUG ((DEBUG_ERROR, "%a: Install FileSystemHandle: %r\n", __func__, Status));
    goto FreeBlobs;
  }

  if (mLoaderItems[InitrdIndex].Data != NULL) {
    InitrdLoadFile2Handle = NULL;
    Status = gBS->InstallMultipleProtocolInterfaces (
      &InitrdLoadFile2Handle,
      &gEfiDevicePathProtocolGuid, &mInitrdDevicePath,
      &gEfiLoadFile2ProtocolGuid, &mInitrdLoadFile2,
      NULL
    );
    if (EFI_ERROR (Status)) {
      DEBUG ((DEBUG_ERROR, "%a: Install InitrdLoadFile2Handle: %r\n", __func__, Status));
      goto UninstallFileSystemHandle;
    }
  }

  return EFI_SUCCESS;

UninstallFileSystemHandle:
  Status = gBS->UninstallMultipleProtocolInterfaces (
    FileSystemHandle,
    &gEfiDevicePathProtocolGuid, &mKernelDevicePath,
    &gEfiSimpleFileSystemProtocolGuid, &mFileSystem,
    NULL
  );
  ASSERT_EFI_ERROR (Status);

FreeBlobs:
  for (UINTN i = 0; i < ARRAY_SIZE (mLoaderItems); i++) {
    UINT8 *Data = mLoaderItems[i].Data;
    if (Data != NULL)
      FreePool (Data);
  }

  return Status;
}
