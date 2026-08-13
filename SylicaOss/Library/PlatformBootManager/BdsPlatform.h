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

#include <Library/BaseLib.h>
#include <Library/DebugLib.h>
#include <Library/UefiBootServicesTableLib.h>
#include <Library/UefiBootManagerLib.h>
#include <Library/HobLib.h>
#include <Library/UefiLib.h>

EFI_STATUS
TryRunningQemuKernel (
  VOID
  );
