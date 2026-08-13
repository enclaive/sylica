/** @file

  Copyright (c) 2006 - 2015, Intel Corporation. All rights reserved.<BR>
  Copyright (c) 2026, Enclaive.<BR>
  SPDX-License-Identifier: BSD-2-Clause-Patent

**/

#include "BdsPlatform.h"

#include <Library/DebugLib.h>
#include <Library/UefiLib.h>
#include <Library/QemuLoadImageLib.h>
#include <Library/ReportStatusCodeLib.h>

EFI_STATUS
TryRunningQemuKernel (
  VOID)
{
  EFI_HANDLE KernelImageHandle;
  EFI_STATUS Status = QemuLoadKernelImage (&KernelImageHandle);
  if (EFI_ERROR (Status)) {
    return Status;
  }

  EfiSignalEventReadyToBoot ();
  REPORT_STATUS_CODE (
    EFI_PROGRESS_CODE,
    (EFI_SOFTWARE_DXE_BS_DRIVER | EFI_SW_DXE_BS_PC_READY_TO_BOOT_EVENT)
  );

  Status = QemuStartKernelImage (&KernelImageHandle);
  if (EFI_ERROR (Status)) {
    DEBUG ((DEBUG_ERROR, "%a: QemuStartKernelImage(): %r\n", __func__, Status));
  }

  QemuUnloadKernelImage (KernelImageHandle);

  return Status;
}
