/** @file
  GUID definition for the QemuLoader media

  Copyright (c) 2026, Enclaive GmbH

  License: NFSL-1.0
**/

#pragma once

#include <Uefi/UefiBaseType.h>

#define QEMU_LOADER_MEDIA_GUID \
  {0x6861636b, 0x6564, 0x4265, {0x6e, 0x2d, 0x63, 0x6c, 0x61, 0x69, 0x76, 0x65}}

extern EFI_GUID gQemuLoaderMediaGuid;
