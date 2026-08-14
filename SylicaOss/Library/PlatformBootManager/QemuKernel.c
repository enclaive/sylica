/** @file

  Copyright (c) 2026, Enclaive.
  License: NFSL-1.0

**/

#include "BdsPlatform.h"

#include <Library/DebugLib.h>
#include <Library/UefiLib.h>
#include <Library/QemuLoadImageLib.h>
#include <Library/ReportStatusCodeLib.h>
#include <Library/UefiBootServicesTableLib.h>

#include <Guid/EventGroup.h>

EFI_STATUS
TryRunningQemuKernel (VOID)
{
  EFI_HANDLE KernelImageHandle = NULL;
  EFI_STATUS Status = QemuLoadKernelImage (&KernelImageHandle);
  if (EFI_ERROR (Status)) {
    return Status;
  }

  EFI_EVENT ReadyToBootEvent;
  EFI_EVENT AfterReadyToBootEvent;

  Status = gBS->CreateEventEx (
    EVT_NOTIFY_SIGNAL, TPL_CALLBACK, EfiEventEmptyFunction, NULL,
    &gEfiEventReadyToBootGuid, &ReadyToBootEvent);
  if (EFI_ERROR (Status)) {
    return Status;
  }
  gBS->SignalEvent (ReadyToBootEvent);
  gBS->CloseEvent (ReadyToBootEvent);

  Status = gBS->CreateEventEx (
    EVT_NOTIFY_SIGNAL, TPL_CALLBACK, EfiEventEmptyFunction, NULL,
    &gEfiEventAfterReadyToBootGuid, &AfterReadyToBootEvent);
  if (EFI_ERROR (Status)) {
    return Status;
  }
  gBS->SignalEvent (AfterReadyToBootEvent);
  gBS->CloseEvent (AfterReadyToBootEvent);

  ReportStatusCode (EFI_PROGRESS_CODE, EFI_SOFTWARE_DXE_BS_DRIVER | EFI_SW_DXE_BS_PC_READY_TO_BOOT_EVENT);

  Status = gBS->StartImage (KernelImageHandle, NULL, NULL);
  if (EFI_ERROR (Status)) {
    DEBUG ((DEBUG_ERROR, "%a: StartImage(): %r\n", __func__, Status));
  }

  // this leaks the allocated load options. just boot already!
  return gBS->UnloadImage (KernelImageHandle);
}
