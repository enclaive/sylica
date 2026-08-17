/** @file

  Cache initialization of certain fw_cfg values

  Copyright (c) 2026, Enclaive GmbH

  License: NFSL-1.0

**/

#include <Uefi.h>

#include <Library/DebugLib.h>
#include <Library/QemuFwCfgLib.h>
#include <Library/TpmMeasurementLib.h>
#include <Library/IoLib.h>

#include <IndustryStandard/UefiTcgPlatform.h>

#include "QemuFwCfgLibInternal.h"
#include "Cache.h"

// https://github.com/qemu/qemu/blob/055952c0aa91ea7a00d135b73f78fc0b13442d6c/hw/nvram/fw_cfg.c#L46
#define MAXIMUM_SLOTS  0x20

// there are only 11 calls to e820_add_entry in total for current QEMU
#define MAXIMUM_E820   0x10

#define UNRESOLVED_ITEM  0xFFFF

STATIC CACHE_ENTRY mCache[] = {
    {
        .File = "FileDir", .Measure = FALSE,
        .Item = QemuFwCfgItemFileDir,
        .Size = 0,
        .Max = sizeof (UINT32) + MAXIMUM_SLOTS * sizeof (FWCFG_FILE)
    },
    {
        .File = "Signature", .Measure = TRUE,
        .Item = QemuFwCfgItemSignature,
        .Size = sizeof (UINT32),
        .Max = sizeof (UINT32)
    },
    {
        .File = "InterfaceVersion", .Measure = TRUE,
        .Item = QemuFwCfgItemInterfaceVersion,
        .Size = sizeof (UINT32),
        .Max = sizeof (UINT32)
    },
    {
        .File = "etc/e820", .Measure = FALSE,
        .Item = UNRESOLVED_ITEM,
        .Size = 0,
        .Max = MAXIMUM_E820 * sizeof (EFI_E820_ENTRY64)
    },
    {
        .File = "etc/system-states", .Measure = FALSE,
        .Item = UNRESOLVED_ITEM,
        .Size = sizeof (UINT8[6]),
        .Max = sizeof (UINT8[6])
    },
    {
        .File = "etc/extra-pci-roots", .Measure = TRUE,
        .Item = UNRESOLVED_ITEM,
        .Size = sizeof (UINT64),
        .Max = sizeof (UINT64)
    },
    {
        .File = "etc/reserved-memory-end", .Measure = TRUE,
        .Item = UNRESOLVED_ITEM,
        .Size = sizeof (UINT64),
        .Max = sizeof (UINT64)
    },
    {
        .File = "opt/ovmf/X-PciMmio64Mb", .Measure = TRUE,
        .Item = UNRESOLVED_ITEM,
        .Size = 0,
        .Max = MAX_UINT16
    },
};
#define ENTRIES  sizeof (mCache) / sizeof (CACHE_ENTRY)

CACHE_ENTRY *
ItemInCache (IN const FIRMWARE_CONFIG_ITEM Item)
{
  for (UINT32 Index = 0; Index < ENTRIES; Index++) {
    if (mCache[Index].Item == Item && mCache[Index].Item != UNRESOLVED_ITEM) {
      return &mCache[Index];
    }
  }
  return NULL;
}

STATIC EFI_STATUS
CreateCache (IN const UINT16 Item, IN const UINT32 ItemSize, OUT UINT8 **ItemData)
{
  if (ItemData == NULL) {
    return EFI_INVALID_PARAMETER;
  }

  const UINT32 HobSize = sizeof (FW_CFG_CACHED_ITEM) + ItemSize;

  UINT8 *HobData = BuildGuidHob (&gOvmfFwCfgInfoHobGuid, HobSize);
  if (HobData == NULL) {
    DEBUG ((DEBUG_ERROR, "%a: BuildGuidHob Failed with FwCfgItemHobSize(0x%x)\n", __func__, HobSize));
    return EFI_OUT_OF_RESOURCES;
  }
  ZeroMem (HobData, HobSize);

  FW_CFG_CACHED_ITEM *CachedItem = (FW_CFG_CACHED_ITEM *)HobData;

  CachedItem->FwCfgItem = Item;
  CachedItem->DataSize = ItemSize;

  *ItemData = (UINT8 *)CachedItem + sizeof (FW_CFG_CACHED_ITEM);

  return EFI_SUCCESS;
}

STATIC EFI_STATUS
MeasureCache (IN const CHAR8 *File, IN const UINT32 ItemSize, IN VOID *ItemData)
{
  if (TdIsEnabled ()) {
    FW_CFG_EVENT FwCfgEvent;

    ZeroMem (&FwCfgEvent, sizeof (FW_CFG_EVENT));
    CopyMem (&FwCfgEvent.Info, EV_POSTCODE_INFO, EV_POSTCODE_SIZE);
    CopyMem (&FwCfgEvent.File, File, QEMU_FW_CFG_FNAME_SIZE);

    const EFI_STATUS Status = TpmMeasureAndLogData (
      1, EV_PLATFORM_CONFIG_FLAGS,
      &FwCfgEvent, sizeof (FwCfgEvent),
      ItemData, ItemSize
    );
    if (EFI_ERROR (Status)) {
      DEBUG ((DEBUG_ERROR, "%a: TpmMeasureAndLogData Failed with %r\n", __func__, Status));
      return Status;
    }
  }
  return EFI_SUCCESS;
}

STATIC EFI_STATUS
CacheResolve ()
{
  UINTN FwCfgSize;
  FIRMWARE_CONFIG_ITEM FwCfgItem;

  for (UINT32 Index = 0; Index < ENTRIES; Index++) {
    CACHE_ENTRY Entry = mCache[Index];
    if (Entry.Item != UNRESOLVED_ITEM)
      continue;

    if (EFI_ERROR (QemuFwCfgFindFile (Entry.File, &FwCfgItem, &FwCfgSize)))
      continue;

    if (Entry.Size != 0 && FwCfgSize != Entry.Size) {
      DEBUG ((DEBUG_ERROR, "%a: CacheResolve %s size mismatch %d\n", __func__, Entry.File, FwCfgSize));
      return EFI_UNSUPPORTED;
    }

    if (Entry.Max != 0 && FwCfgSize > Entry.Max) {
      DEBUG ((DEBUG_ERROR, "%a: CacheResolve %s too large %d\n", __func__, Entry.File, FwCfgSize));
      return EFI_UNSUPPORTED;
    }

    Entry.Item = (UINT16)FwCfgItem;
    Entry.Size = (UINT32)FwCfgSize;

    if (!CacheItem (&Entry)) {
      DEBUG ((DEBUG_ERROR, "%a: caching entry %a failed\n", __func__, Entry.File));
      return EFI_UNSUPPORTED;
    }
  }

  return EFI_SUCCESS;
}

BOOLEAN
CacheItem (IN CACHE_ENTRY *Entry)
{
  UINT32 ItemSize = Entry->Size;
  if (Entry->Item == QemuFwCfgItemFileDir) {
    IoWrite16 (FW_CFG_IO_SELECTOR, Entry->Item);
    const UINT32 Count = SwapBytes32 (QemuFwCfgRead32 ());
    if (Count > MAXIMUM_SLOTS) {
      DEBUG ((DEBUG_ERROR, "%a: validate: too large %d\n", __func__, Count));
      return FALSE;
    }
    ItemSize = sizeof (Count) + Count * sizeof (FWCFG_FILE);
  }

  if (ItemSize > Entry->Max) {
    DEBUG ((DEBUG_ERROR, "%a: validate %d: too large %d\n", __func__, Entry->Item, ItemSize));
    return FALSE;
  }

  IoWrite16 (FW_CFG_IO_SELECTOR, Entry->Item);
  DEBUG ((DEBUG_INFO, "%a: %a, item 0x%x, size 0x%x\n", __func__, Entry->File, Entry->Item, ItemSize));

  UINT8 *ItemData = NULL;
  EFI_STATUS Status = CreateCache (Entry->Item, ItemSize, &ItemData);
  if (EFI_ERROR (Status)) {
    DEBUG ((DEBUG_ERROR, "%a: CreateCache Failed = %r\n", __func__, Status));
    return FALSE;
  }

  if (ItemSize > 0) {
    IoReadFifo8 (FW_CFG_IO_DATA, ItemSize, ItemData);
  }

  if (Entry->Measure) {
    Status = MeasureCache (Entry->File, ItemSize, ItemData);
    if (EFI_ERROR (Status)) {
      DEBUG ((DEBUG_ERROR, "%a: MeasureCache Failed = %r\n", __func__, Status));
      return FALSE;
    }
  }

  if (Entry->Item == QemuFwCfgItemFileDir && ItemSize >= 4) {
    const UINT32 Count = SwapBytes32 (ReadUnaligned32 (ItemData));
    if (Count > MAXIMUM_SLOTS) {
      DEBUG ((DEBUG_ERROR, "%a: checking: too large %d\n", __func__, Count));
      return FALSE;
    }
    const UINT32 ExpectedSize = sizeof (Count) + Count * sizeof (FWCFG_FILE);
    if (ItemSize != ExpectedSize) {
      DEBUG ((DEBUG_ERROR, "%a: checking: mismatch %d != %d\n", __func__, ItemSize, ExpectedSize));
      return FALSE;
    }

    Status = CacheResolve ();
    if (EFI_ERROR (Status)) {
      DEBUG ((DEBUG_ERROR, "%a: CacheResolve Failed = %r\n", __func__, Status));
      return FALSE;
    }
  }

  return TRUE;
}

EFI_STATUS
InternalQemuFwCfgInitCache (IN OUT EFI_HOB_PLATFORM_INFO *PlatformInfoHob)
{
  if (PlatformInfoHob == NULL) {
    return EFI_INVALID_PARAMETER;
  }

  DEBUG ((DEBUG_ERROR, "%a init\n", __func__));

  PlatformInfoHob->QemuFwCfgWorkArea.FwCfgItem = UNRESOLVED_ITEM;
  PlatformInfoHob->QemuFwCfgWorkArea.Offset = 0;
  PlatformInfoHob->QemuFwCfgWorkArea.Reading = FALSE;

  return EFI_SUCCESS;
}
