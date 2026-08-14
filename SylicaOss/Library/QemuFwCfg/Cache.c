/** @file

  Cache provider of certain fw_cfg values

  Copyright (c) 2026, Enclaive GmbH

  License: NFSL-1.0

**/

#include <Uefi.h>

#include <Library/DebugLib.h>
#include <Library/QemuFwCfgLib.h>
#include <Library/BaseMemoryLib.h>

#include "QemuFwCfgLibInternal.h"
#include "Cache.h"

STATIC FW_CFG_CACHED_ITEM *
QemuFwCfgItemCached (IN const UINT16 Item)
{
#ifdef TDX_PEI_LESS_BOOT
  if (InternalQemuFwCfgCheckOvmfWorkArea () == FALSE) {
    return NULL;
  }
#endif

  EFI_PEI_HOB_POINTERS Hob;
  Hob.Raw = (UINT8 *)GetFirstGuidHob (&gOvmfFwCfgInfoHobGuid);

  while (Hob.Raw != NULL) {
    FW_CFG_CACHED_ITEM *CachedItem = (FW_CFG_CACHED_ITEM *)GET_GUID_HOB_DATA (Hob);
    if (CachedItem->FwCfgItem == Item && CachedItem->DataSize != 0) {
      return CachedItem;
    }

    Hob.Raw = (UINT8 *)GET_NEXT_HOB (Hob);
    Hob.Raw = (UINT8 *)GetNextGuidHob (&gOvmfFwCfgInfoHobGuid, Hob.Raw);
  }
  return NULL;
}

VOID
InternalQemuFwCfgCacheResetWorkArea (VOID)
{
  QEMU_FW_CFG_WORK_AREA *WorkArea = InternalQemuFwCfgCacheGetWorkArea ();
  if (WorkArea != NULL) {
    WorkArea->FwCfgItem = 0;
    WorkArea->Offset = 0;
    WorkArea->Reading = FALSE;
  }
}

BOOLEAN
InternalQemuFwCfgCacheReading (VOID)
{
  const QEMU_FW_CFG_WORK_AREA *WorkArea = InternalQemuFwCfgCacheGetWorkArea ();
  if (WorkArea != NULL) {
    return WorkArea->Reading;
  }
  return FALSE;
}

BOOLEAN
InternalQemuFwCfgCacheSelectItem (IN const FIRMWARE_CONFIG_ITEM Item)
{
  CACHE_ENTRY *Cache = NULL;
  if (QemuFwCfgItemCached (Item) == NULL) {
    Cache = ItemInCache (Item);
    if (Cache == NULL) {
      DEBUG ((DEBUG_INFO, "QemuFwCfg/Cache: Item 0x%x will not be cached\n", Item));
      return FALSE;
    }
  }

  QEMU_FW_CFG_WORK_AREA *WorkArea = InternalQemuFwCfgCacheGetWorkArea ();
  if (WorkArea == NULL) {
    DEBUG ((DEBUG_ERROR, "%a: invalid work area\n", __func__));
    return FALSE;
  }

  InternalQemuFwCfgCacheResetWorkArea ();

  if (Cache != NULL) {
    if (!CacheItem (Cache)) {
      DEBUG ((DEBUG_ERROR, "QemuFwCfg/Cache: Item 0x%x could not be cached\n", Item));
      CpuDeadLoop ();
      return FALSE;
    }
  }

  WorkArea->FwCfgItem = (UINT16)Item;
  WorkArea->Offset = 0;
  WorkArea->Reading = TRUE;

  return TRUE;
}

EFI_STATUS
InternalQemuFwCfgCacheReadBytes (IN const UINTN Size, IN OUT VOID *Buffer)
{
  if (Buffer == NULL) {
    return EFI_INVALID_PARAMETER;
  }

  QEMU_FW_CFG_WORK_AREA *WorkArea = InternalQemuFwCfgCacheGetWorkArea ();
  if (WorkArea == NULL) {
    DEBUG ((DEBUG_ERROR, "%a: invalid work area\n", __func__));
    CpuDeadLoop ();
    return RETURN_NOT_FOUND;
  }

  if (!WorkArea->Reading) {
    DEBUG ((DEBUG_ERROR, "QemuFwCfg/Cache: work area not ready\n"));
    CpuDeadLoop ();
    return RETURN_NOT_READY;
  }

  FW_CFG_CACHED_ITEM *CachedItem = QemuFwCfgItemCached (WorkArea->FwCfgItem);
  if (CachedItem == NULL) {
    DEBUG ((DEBUG_ERROR, "QemuFwCfg/Cache: item 0x%x not found\n", WorkArea->FwCfgItem));
    CpuDeadLoop ();
    return RETURN_NOT_FOUND;
  }

  if (WorkArea->Offset >= CachedItem->DataSize) {
    DEBUG ((DEBUG_ERROR, "QemuFwCfg/Cache: work area invalid, offset 0x%x, size 0x%x\n", WorkArea->Offset, CachedItem->DataSize));
    CpuDeadLoop ();
    return RETURN_ABORTED;
  }

  const UINT32 Delta = CachedItem->DataSize - WorkArea->Offset;
  const UINTN ReadSize = Delta < Size ? Delta : Size;

  CopyMem (Buffer, (UINT8 *)CachedItem + sizeof (FW_CFG_CACHED_ITEM) + WorkArea->Offset, ReadSize);
  WorkArea->Offset += (UINT32)ReadSize;

  return RETURN_SUCCESS;
}
