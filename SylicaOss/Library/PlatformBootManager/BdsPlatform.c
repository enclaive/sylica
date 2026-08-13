/** @file
  Platform BDS customizations.

  Copyright (c) 2004 - 2019, Intel Corporation. All rights reserved.<BR>
  Copyright (c) 2026, Enclaive.<BR>
  SPDX-License-Identifier: BSD-2-Clause-Patent

**/

#include "BdsPlatform.h"

#include <Library/BaseLib.h>
#include <Library/DebugLib.h>
#include <Library/UefiBootServicesTableLib.h>
#include <Library/UefiBootManagerLib.h>
#include <Library/HobLib.h>
#include <Library/UefiLib.h>
#include <Library/BlobVerifierLib.h>

#include <Guid/RootBridgesConnectedEventGroup.h>
#include <Guid/EventGroup.h>

#include <Protocol/PciRootBridgeIo.h>
#include <Protocol/DxeSmmReadyToLock.h>

static VOID
RestrictBootOptionsToFirmware (
  VOID)
{
  UINTN BootOptionCount;
  EFI_BOOT_MANAGER_LOAD_OPTION *BootOptions = EfiBootManagerGetLoadOptions (&BootOptionCount, LoadOptionTypeBoot);

  for (UINTN Index = 0; Index < BootOptionCount; ++Index) {
    EfiBootManagerDeleteLoadOptionVariable (BootOptions[Index].OptionNumber, LoadOptionTypeBoot);
  }

  EfiBootManagerFreeLoadOptions (BootOptions, BootOptionCount);
}

static EFI_STATUS
EFIAPI
ConnectRootBridge (
  IN EFI_HANDLE RootBridgeHandle,
  IN VOID *Instance,
  IN VOID *Context
)
{
  //
  // Make the PCI bus driver connect the root bridge, non-recursively. This
  // will produce a number of child handles with PciIo on them.
  //
  return gBS->ConnectController (
    RootBridgeHandle, // ControllerHandle
    NULL,             // DriverImageHandle
    NULL,             // RemainingDevicePath -- produce all
    FALSE             // Recursive
  );
}

/**
  Do the platform init, can be customized by OEM/IBV
**/
VOID
EFIAPI
PlatformBootManagerBeforeConsole (
  VOID)
{
  EFI_HANDLE Handle;
  EFI_STATUS Status;

  DEBUG ((DEBUG_INFO, "PlatformBootManagerBeforeConsole\n"));

  VisitAllInstancesOfProtocol (&gEfiPciRootBridgeIoProtocolGuid, ConnectRootBridge, NULL);

  //
  // Signal the ACPI platform driver that it can download QEMU ACPI tables.
  //
  EfiEventGroupSignal (&gRootBridgesConnectedEventGroupGuid);

  //
  // We can't signal End-of-Dxe earlier than this. Namely, End-of-Dxe triggers
  // the preparation of S3 system information. That logic has a hard dependency
  // on the presence of the FACS ACPI table. Since our ACPI tables are only
  // installed after PCI enumeration completes, we must not trigger the S3 save
  // earlier, hence we can't signal End-of-Dxe earlier.
  //
  EfiEventGroupSignal (&gEfiEndOfDxeEventGroupGuid);

  //
  // Prevent further changes to LockBoxes or SMRAM.
  // Any TPM 2 Physical Presence Interface opcode must be handled before.
  //
  Handle = NULL;
  Status = gBS->InstallProtocolInterface (&Handle, &gEfiDxeSmmReadyToLockProtocolGuid, EFI_NATIVE_INTERFACE, NULL);
  ASSERT_EFI_ERROR (Status);

  //
  // Dispatch deferred images after EndOfDxe event and ReadyToLock
  // installation.
  //
  EfiBootManagerDispatchDeferredImages ();

  // Initialize the console so booting an efi shell works
  PlatformInitializeConsole ();
}

EFI_STATUS
VisitAllInstancesOfProtocol (
  IN EFI_GUID *Id,
  IN PROTOCOL_INSTANCE_CALLBACK CallBackFunction,
  IN VOID *Context
)
{
  UINTN HandleCount = 0;
  EFI_HANDLE *HandleBuffer = NULL;
  VOID *Instance;

  EFI_STATUS Status = gBS->LocateHandleBuffer (ByProtocol, Id, NULL, &HandleCount, &HandleBuffer);
  if (EFI_ERROR (Status)) {
    return Status;
  }

  for (UINTN Index = 0; Index < HandleCount; Index++) {
    Status = gBS->HandleProtocol (HandleBuffer[Index], Id, &Instance);
    if (EFI_ERROR (Status)) {
      continue;
    }

    Status = (*CallBackFunction) (HandleBuffer[Index], Instance, Context);
  }

  gBS->FreePool (HandleBuffer);

  return EFI_SUCCESS;
}

/**
  Do the platform specific action after the console is ready
**/
VOID
EFIAPI
PlatformBootManagerAfterConsole (
  VOID)
{
  EFI_BOOT_MODE BootMode = GetBootModeHob ();
  DEBUG ((DEBUG_INFO, "Boot Mode:%x\n", BootMode));
  ASSERT (BootMode == BOOT_WITH_FULL_CONFIGURATION);

  TryRunningQemuKernel ();

  if (VerificationEnabled ()) {
    DebugPrint (DEBUG_ERROR, "direct boot verification enabled but kernel returned\n");
    CpuDeadLoop ();
  }

  RestrictBootOptionsToFirmware ();
}

/**
  This function is called each second during the boot manager waits the timeout.

  @param TimeoutRemain  The remaining timeout.
**/
VOID
EFIAPI
PlatformBootManagerWaitCallback (
  UINT16 TimeoutRemain
)
{
}

/**
  If this function returns, BDS attempts to enter an infinite loop.
**/
VOID
EFIAPI
PlatformBootManagerUnableToBoot (
  VOID)
{
  CpuDeadLoop ();
}
