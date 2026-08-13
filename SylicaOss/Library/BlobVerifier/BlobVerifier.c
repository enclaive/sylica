/** @file

  Blob verifier library that uses SEV hashes table.

  Copyright (C) 2026, Enclaive GmbH

  License: NFSL-1.0
**/

#include <Library/BaseCryptLib.h>
#include <Library/BaseLib.h>
#include <Library/PcdLib.h>
#include <Library/BaseMemoryLib.h>
#include <Library/DebugLib.h>
#include <Library/BlobVerifierLib.h>

/**
  The SEV Hashes table is in encrypted memory and contains a table like this:

  9438d606-4f22-4cc9-b479-a793d411fd21|<length>|<data>

  The length describes the amount of entries in the table.
  Each entry uses length to identify the hash used

  Currently supported by QEMU:
  - 4de79437-abd2-427f-b835-d5b172d2045b kernel
  - 44baf731-3a2f-4bd7-9af1-41e29169781d initrd
  - 97d02dd8-bd20-4c94-aa78-e7714d36ab2a cmdline
**/

#define SEV_HASH_TABLE_GUID \
  (GUID) { 0x9438d606, 0x4f22, 0x4cc9, { 0xb4, 0x79, 0xa7, 0x93, 0xd4, 0x11, 0xfd, 0x21 } }
#define SEV_KERNEL_HASH_GUID \
  (GUID) { 0x4de79437, 0xabd2, 0x427f, { 0xb8, 0x35, 0xd5, 0xb1, 0x72, 0xd2, 0x04, 0x5b } }
#define SEV_INITRD_HASH_GUID \
  (GUID) { 0x44baf731, 0x3a2f, 0x4bd7, { 0x9a, 0xf1, 0x41, 0xe2, 0x91, 0x69, 0x78, 0x1d } }
#define SEV_CMDLINE_HASH_GUID \
  (GUID) { 0x97d02dd8, 0xbd20, 0x4c94, { 0xaa, 0x78, 0xe7, 0x71, 0x4d, 0x36, 0xab, 0x2a } }

STATIC CONST EFI_GUID mSevKernelHashGuid = SEV_KERNEL_HASH_GUID;
STATIC CONST EFI_GUID mSevInitrdHashGuid = SEV_INITRD_HASH_GUID;
STATIC CONST EFI_GUID mSevCmdlineHashGuid = SEV_CMDLINE_HASH_GUID;

#pragma pack (1)
typedef struct
{
  GUID Guid;
  UINT16 Len;
  UINT8 Data[];
} HASH_TABLE;
#pragma pack ()

STATIC HASH_TABLE *mTable = NULL;
STATIC UINT16 mTableSize = 0;

STATIC CONST GUID *
FindBlobEntryGuid (IN CONST CHAR16 *BlobName)
{
  if (StrCmp (BlobName, L"kernel") == 0) {
    return &mSevKernelHashGuid;
  }
  if (StrCmp (BlobName, L"initrd") == 0) {
    return &mSevInitrdHashGuid;
  }
  if (StrCmp (BlobName, L"cmdline") == 0) {
    return &mSevCmdlineHashGuid;
  }
  return NULL;
}

BOOLEAN
EFIAPI
VerificationEnabled ()
{
  // assume verification if these were modified
  return mTable != NULL || mTableSize != 0;
}

/**
  Verify blob from an external source.

  @param[in] BlobName           The name of the blob
  @param[in] Buffer             The data of the blob
  @param[in] BufferSize         The size of the blob in bytes

  @retval EFI_SUCCESS           The blob was verified successfully or no injected table was found.
  @retval EFI_ACCESS_DENIED     The blob verification failed and the data should be discarded.
**/
EFI_STATUS
EFIAPI
VerifyBlob (
  IN CONST CHAR16 *BlobName,
  IN CONST VOID *Buffer,
  IN CONST UINT32 BufferSize
)
{
  if (mTable == NULL || mTableSize == 0) {
    DEBUG ((DEBUG_INFO, "%a: Verifier called but no table or zero size\n", __func__));
    return EFI_SUCCESS;
  }

  CONST GUID *Guid = FindBlobEntryGuid (BlobName);
  if (Guid == NULL) {
    DEBUG ((DEBUG_ERROR, "%a: Unknown blob name %s\n", __func__, BlobName));
    return EFI_ACCESS_DENIED;
  }

  INT32 Remaining = mTableSize; // catch underflow
  HASH_TABLE *Entry = mTable;
  for (; Entry->Len != 0 && Remaining >= sizeof *Entry && Remaining >= Entry->Len;
         Remaining -= Entry->Len,
         Entry = (HASH_TABLE *)((UINT8 *)Entry + Entry->Len)) {
    if (!CompareGuid (&Entry->Guid, Guid)) {
      continue;
    }

    DEBUG ((DEBUG_INFO, "%a: Found GUID %g in table\n", __func__, Guid));

    const UINTN EntrySize = Entry->Len - sizeof Entry->Guid - sizeof Entry->Len;
    if (EntrySize != SHA256_DIGEST_SIZE) {
      DEBUG ((DEBUG_ERROR, "%a: Hash has the wrong size %d != %d\n", __func__, EntrySize, SHA256_DIGEST_SIZE));
      return EFI_ACCESS_DENIED;
    }

    UINT8 Hash[SHA256_DIGEST_SIZE];
    if (!Sha256HashAll (Buffer, BufferSize, Hash)) {
      DEBUG ((DEBUG_ERROR, "%a: Hash calculation failed\n", __func__));
      return EFI_ACCESS_DENIED;
    }

    const BOOLEAN Verified = CompareMem (Entry->Data, Hash, EntrySize) == 0;
    DEBUG ((DEBUG_INFO, "%a: Hash comparison for %s: %a\n", __func__, BlobName, Verified ? "GOOD" : "FAILED"));

    if (Verified) {
      return EFI_SUCCESS;
    }

    return EFI_ACCESS_DENIED;
  }

  DEBUG ((DEBUG_ERROR, "%a: Hash GUID %g not found in table\n", __func__, Guid));
  return EFI_ACCESS_DENIED;
}

/**
  Locate the SEV hashes table if present.

  @retval RETURN_SUCCESS   This function always returns success, even if the table can't be found.
**/
RETURN_STATUS
EFIAPI
BlobVerifierConstructor (
  VOID)
{
  mTable = NULL;
  mTableSize = 0;

  const HASH_TABLE *Ptr = (void *)(UINTN)FixedPcdGet64 (PcdQemuHashTableBase);
  const UINT32 Size = FixedPcdGet32 (PcdQemuHashTableSize);

  if (Ptr == NULL || Size < sizeof *Ptr ||
      !CompareGuid (&Ptr->Guid, &SEV_HASH_TABLE_GUID) ||
      Ptr->Len < sizeof *Ptr || Ptr->Len > Size) {
    return RETURN_SUCCESS;
  }

  mTable = (HASH_TABLE *)Ptr->Data;
  mTableSize = Ptr->Len - sizeof Ptr->Guid - sizeof Ptr->Len;

  DEBUG ((DEBUG_INFO, "%a: Found injected table\n", __func__));
  DEBUG ((DEBUG_VERBOSE, "%a: mHashesTable=0x%p, Size=%u\n", __func__, mTable, mTableSize));

  return RETURN_SUCCESS;
}
