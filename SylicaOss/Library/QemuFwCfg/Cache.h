/** @file

  Shared definitions for cache replacement

  Copyright (c) 2026, Enclaive GmbH

  License: NFSL-1.0

**/

#pragma once

#include <Library/QemuFwCfgLib.h>

#define EV_POSTCODE_INFO  "QEMU FW CFG"
#define EV_POSTCODE_SIZE  sizeof (EV_POSTCODE_INFO)

#pragma pack(1)
typedef struct
{
  CHAR8 File[QEMU_FW_CFG_FNAME_SIZE];
  BOOLEAN Measure;
  UINT16 Item;
  UINT32 Size;
  UINT32 Max;
} CACHE_ENTRY;

typedef struct
{
  UINT8 Info[EV_POSTCODE_SIZE];
  UINT8 File[QEMU_FW_CFG_FNAME_SIZE];
} FW_CFG_EVENT;
#pragma pack()

CACHE_ENTRY *
ItemInCache (IN FIRMWARE_CONFIG_ITEM Item);

BOOLEAN
CacheItem (IN CACHE_ENTRY *Entry);

extern EFI_GUID gOvmfFwCfgInfoHobGuid;
