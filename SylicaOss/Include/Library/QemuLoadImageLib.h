/** @file
  Load a kernel image and command line passed to QEMU via the command line

  Copyright (c) 2026, Enclaive GmbH

  License: NFSL-1.0
**/

#pragma once

#include <Uefi/UefiBaseType.h>
#include <Base.h>

EFI_STATUS
EFIAPI
QemuLoadKernelImage (
  OUT EFI_HANDLE  *ImageHandle
  );
