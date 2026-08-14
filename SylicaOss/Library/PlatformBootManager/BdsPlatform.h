/** @file
  Platform BDS customizations include file.

  Copyright (c) 2006 - 2017, Intel Corporation. All rights reserved.<BR>
  Copyright (c) 2026, Enclaive.<BR>
  SPDX-License-Identifier: BSD-2-Clause-Patent

Module Name:

  BdsPlatform.h

Abstract:

  Head file for BDS Platform specific code

**/

#pragma once

#include <PiDxe.h>

typedef
EFI_STATUS
(EFIAPI *PROTOCOL_INSTANCE_CALLBACK) (
  IN EFI_HANDLE Handle,
  IN VOID *Instance,
  IN VOID *Context
);

EFI_STATUS
VisitAllInstancesOfProtocol (
  IN EFI_GUID *Id,
  IN PROTOCOL_INSTANCE_CALLBACK CallBackFunction,
  IN VOID *Context
);

VOID
PlatformInitializeConsole (VOID);

EFI_STATUS
TryRunningQemuKernel (VOID);
