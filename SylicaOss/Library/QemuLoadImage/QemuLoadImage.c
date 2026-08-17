/**  @file
  Custom implementation of QemuLoadImageLib for confidential compute

  Copyright (c) 2026, Enclaive GmbH

  License: NFSL-1.0
**/

#include <Uefi.h>
#include <Base.h>

#include <Guid/QemuLoaderMedia.h>

#include <Library/DebugLib.h>
#include <Library/PrintLib.h>
#include <Library/FileHandleLib.h>
#include <Library/MemoryAllocationLib.h>
#include <Library/UefiBootServicesTableLib.h>
#include <Library/QemuLoadImageLib.h>

#include <Protocol/DevicePath.h>
#include <Protocol/LoadedImage.h>
#include <Protocol/SimpleFileSystem.h>

#define KERNEL_FILENAME L"kernel"

#pragma pack (1)
typedef struct
{
  VENDOR_DEVICE_PATH VenMediaNode;
  EFI_DEVICE_PATH_PROTOCOL EndNode;
} SINGLE_VENMEDIA_NODE_DEVPATH;

typedef struct
{
  EFI_DEVICE_PATH_PROTOCOL FilePathHeader;
  CHAR16 FilePath[ARRAY_SIZE (KERNEL_FILENAME)];
} KERNEL_FILE;

typedef struct
{
  VENDOR_DEVICE_PATH VenMediaNode;
  KERNEL_FILE FileNode;
  EFI_DEVICE_PATH_PROTOCOL EndNode;
} KERNEL_FILE_DEVPATH;
#pragma pack ()

STATIC CONST SINGLE_VENMEDIA_NODE_DEVPATH mMediaDevicePath = {
    .VenMediaNode = {
        .Header = {
            MEDIA_DEVICE_PATH, MEDIA_VENDOR_DP,
            {sizeof (VENDOR_DEVICE_PATH)}
        },
        .Guid = QEMU_LOADER_MEDIA_GUID
    },
    .EndNode = {
        .Type = END_DEVICE_PATH_TYPE, .SubType = END_ENTIRE_DEVICE_PATH_SUBTYPE,
        .Length = {sizeof (EFI_DEVICE_PATH_PROTOCOL)}
    }
};
STATIC CONST KERNEL_FILE_DEVPATH mKernelDevicePath = {
    .VenMediaNode = {
        .Header = {
            .Type = MEDIA_DEVICE_PATH, .SubType = MEDIA_VENDOR_DP,
            .Length = {sizeof (VENDOR_DEVICE_PATH)}
        },
        .Guid = QEMU_LOADER_MEDIA_GUID
    },
    .FileNode = {
        .FilePathHeader = {
            .Type = MEDIA_DEVICE_PATH, .SubType = MEDIA_FILEPATH_DP,
            .Length = {sizeof (KERNEL_FILE)}
        },
        .FilePath = KERNEL_FILENAME,
    },
    .EndNode = {
        .Type = END_DEVICE_PATH_TYPE, .SubType = END_ENTIRE_DEVICE_PATH_SUBTYPE,
        .Length = {sizeof (EFI_DEVICE_PATH_PROTOCOL)}
    }
};

STATIC EFI_STATUS
FileSize (IN EFI_FILE_HANDLE Root, IN CHAR16 *FileName, OUT UINTN *Size)
{
  EFI_FILE_HANDLE FileHandle;
  EFI_STATUS Status = Root->Open(Root, &FileHandle, FileName, EFI_FILE_MODE_READ, 0);
  if (EFI_ERROR (Status)) {
    return Status;
  }

  UINT64 FileSize;
  Status = FileHandleGetSize (FileHandle, &FileSize);
  if (EFI_ERROR (Status)) {
    goto CloseFile;
  }

  if (FileSize > MAX_UINTN) {
    Status = EFI_UNSUPPORTED;
  } else {
    *Size = FileSize;
  }

  CloseFile:
    FileHandle->Close (FileHandle);
  return Status;
}

STATIC EFI_STATUS
FileRead (IN EFI_FILE_HANDLE Root, IN CHAR16 *FileName, IN UINTN Size, OUT VOID *Buffer)
{
  EFI_FILE_HANDLE FileHandle;
  EFI_STATUS Status = Root->Open (Root, &FileHandle, FileName, EFI_FILE_MODE_READ, 0);
  if (EFI_ERROR (Status)) {
    return Status;
  }

  UINTN ReadSize = Size;
  Status = FileHandle->Read (FileHandle, &ReadSize, Buffer);
  if (EFI_ERROR (Status)) {
    goto CloseFile;
  }

  if (ReadSize != Size) {
    Status = EFI_PROTOCOL_ERROR;
  }

CloseFile:
  FileHandle->Close (FileHandle);
  return Status;
}

EFI_STATUS EFIAPI
QemuLoadKernelImage (OUT EFI_HANDLE *ImageHandle)
{
  EFI_HANDLE KernelImageHandle;
  EFI_STATUS Status = gBS->LoadImage (
    FALSE, gImageHandle,
    (EFI_DEVICE_PATH_PROTOCOL *)&mKernelDevicePath,
    NULL, 0,
    &KernelImageHandle
  );
  switch (Status) {
  case EFI_SUCCESS:
    break;
  case EFI_SECURITY_VIOLATION:
    gBS->UnloadImage (KernelImageHandle);
    return EFI_ACCESS_DENIED;
  default:
    DEBUG ((DEBUG_INFO, "%a: LoadImage(): %r\n", __func__, Status));
    return Status;
  }

  EFI_LOADED_IMAGE_PROTOCOL *KernelLoadedImage;
  Status = gBS->OpenProtocol (
    KernelImageHandle, &gEfiLoadedImageProtocolGuid,
    (VOID **)&KernelLoadedImage, gImageHandle, NULL,
    EFI_OPEN_PROTOCOL_GET_PROTOCOL
  );
  if (EFI_ERROR (Status)) {
    goto UnloadImage;
  }

  KernelLoadedImage->LoadOptions = NULL;
  KernelLoadedImage->LoadOptionsSize = 0;

  EFI_HANDLE FsVolumeHandle;
  EFI_DEVICE_PATH_PROTOCOL *DevicePathNode = (EFI_DEVICE_PATH_PROTOCOL *)&mMediaDevicePath;
  Status = gBS->LocateDevicePath (&gEfiSimpleFileSystemProtocolGuid, &DevicePathNode, &FsVolumeHandle);
  if (EFI_ERROR (Status)) {
    goto UnloadImage;
  }

  EFI_SIMPLE_FILE_SYSTEM_PROTOCOL *FsProtocol;
  Status = gBS->HandleProtocol (FsVolumeHandle, &gEfiSimpleFileSystemProtocolGuid, (VOID **)&FsProtocol);
  if (EFI_ERROR (Status)) {
    goto UnloadImage;
  }

  EFI_FILE_HANDLE Root;
  Status = FsProtocol->OpenVolume (FsVolumeHandle, &Root);
  if (EFI_ERROR (Status)) {
    goto UnloadImage;
  }

  UINTN CommandLineSize = 0;
  Status = FileSize (Root, L"cmdline", &CommandLineSize);
  if (EFI_ERROR (Status) && Status != EFI_NOT_FOUND) {
    goto CloseRoot;
  }

  CHAR8 *CommandLine = NULL;
  if (CommandLineSize != 0) {
    CommandLine = AllocatePool (CommandLineSize);
    if (CommandLine == NULL) {
      Status = EFI_OUT_OF_RESOURCES;
      goto CloseRoot;
    }

    Status = FileRead (Root, L"cmdline", CommandLineSize, CommandLine);
    if (EFI_ERROR (Status)) {
      goto FreeCommandLine;
    }

    if (CommandLine[CommandLineSize - 1] != '\0') {
      DEBUG ((DEBUG_ERROR, "%a: cmdline does not end with NUL\n", __func__));
      Status = EFI_PROTOCOL_ERROR;
      goto FreeCommandLine;
    }

    KernelLoadedImage->LoadOptionsSize = (UINT32)((CommandLineSize - 1) * 2);
  }

  UINTN InitrdSize = 0;
  Status = FileSize (Root, L"initrd", &InitrdSize);
  if (EFI_ERROR (Status) && Status != EFI_NOT_FOUND) {
    goto FreeCommandLine;
  }

  if (InitrdSize > 0) {
    KernelLoadedImage->LoadOptionsSize += sizeof (L"initrd=initrd ") - 2;
  }

  if (KernelLoadedImage->LoadOptionsSize != 0) {
    KernelLoadedImage->LoadOptionsSize += 2; // NUL
    KernelLoadedImage->LoadOptions = AllocatePool (KernelLoadedImage->LoadOptionsSize);
    if (KernelLoadedImage->LoadOptions == NULL) {
      Status = EFI_OUT_OF_RESOURCES;
      goto FreeCommandLine;
    }

    UnicodeSPrintAsciiFormat (KernelLoadedImage->LoadOptions, KernelLoadedImage->LoadOptionsSize,
      "%a%a", InitrdSize > 0 ? "initrd=initrd " : "", CommandLineSize > 0 ? CommandLine : ""
    );
    DEBUG ((DEBUG_INFO, "%a: cmdline: %s\\0\n", __func__, (CHAR16 *)KernelLoadedImage->LoadOptions));
  }

  *ImageHandle = KernelImageHandle;
  Status = EFI_SUCCESS;

FreeCommandLine:
  if (CommandLine != NULL) {
    FreePool (CommandLine);
  }

CloseRoot:
  Root->Close (Root);

UnloadImage:
  if (EFI_ERROR (Status)) {
    gBS->UnloadImage (KernelImageHandle);
  }

  return Status;
}
