/** @file

  Blob verification library

  Copyright (C) 2026, Enclaive GmbH

  License: NFSL-1.0
**/

#pragma once

#include <Uefi/UefiBaseType.h>
#include <Base.h>

BOOLEAN
EFIAPI
VerificationEnabled ();

EFI_STATUS
EFIAPI
VerifyBlob (
  IN CONST CHAR16 *BlobName,
  IN CONST VOID *Buffer,
  IN UINT32 BufferSize
);
