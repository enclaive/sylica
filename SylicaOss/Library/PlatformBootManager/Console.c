/** @file
  Platform Console to support EFI shell debugging.

  Copyright (c) 2026, Enclaive.<BR>
  License: NFSL-1.0

**/

#include "BdsPlatform.h"

#include <Library/UefiBootServicesTableLib.h>
#include <Library/UefiBootManagerLib.h>
#include <Library/DevicePathLib.h>

#include <Protocol/PciIo.h>
#include <IndustryStandard/Pci.h>

// these three defines are from the original source
#define gPnp16550ComPort \
  { \
    { \
      ACPI_DEVICE_PATH, \
      ACPI_DP, \
      { \
        (UINT8) (sizeof (ACPI_HID_DEVICE_PATH)), \
        (UINT8) ((sizeof (ACPI_HID_DEVICE_PATH)) >> 8) \
      }, \
    }, \
    EISA_PNP_ID((0x0501)), \
    0 \
  }
#define gUart \
  { \
    { \
      MESSAGING_DEVICE_PATH, \
      MSG_UART_DP, \
      { \
        (UINT8) (sizeof (UART_DEVICE_PATH)), \
        (UINT8) ((sizeof (UART_DEVICE_PATH)) >> 8) \
      } \
    }, \
    0, \
    115200, \
    8, \
    1, \
    1 \
  }
#define gVtUtf8Terminal \
  { \
    { \
      MESSAGING_DEVICE_PATH, \
      MSG_VENDOR_DP, \
      { \
        (UINT8) (sizeof (VENDOR_DEVICE_PATH)), \
        (UINT8) ((sizeof (VENDOR_DEVICE_PATH)) >> 8) \
      } \
    }, \
    DEVICE_PATH_MESSAGING_VT_UTF8 \
  }

static ACPI_HID_DEVICE_PATH gPnp16550ComPortDeviceNode = gPnp16550ComPort;
static UART_DEVICE_PATH gUartDeviceNode = gUart;
static VENDOR_DEVICE_PATH gTerminalTypeDeviceNode = gVtUtf8Terminal;

static EFI_STATUS
PrepareLpcBridgeDevicePath (
  IN EFI_HANDLE DeviceHandle
)
{
  EFI_DEVICE_PATH_PROTOCOL *DevicePath;
  EFI_STATUS Status = gBS->HandleProtocol (DeviceHandle, &gEfiDevicePathProtocolGuid, (VOID *)&DevicePath);
  if (EFI_ERROR (Status)) {
    return Status;
  }

  DevicePath = AppendDevicePathNode (DevicePath, (EFI_DEVICE_PATH_PROTOCOL *)&gPnp16550ComPortDeviceNode);
  DevicePath = AppendDevicePathNode (DevicePath, (EFI_DEVICE_PATH_PROTOCOL *)&gUartDeviceNode);
  DevicePath = AppendDevicePathNode (DevicePath, (EFI_DEVICE_PATH_PROTOCOL *)&gTerminalTypeDeviceNode);

  EfiBootManagerUpdateConsoleVariable (ConOut, DevicePath, NULL);
  EfiBootManagerUpdateConsoleVariable (ConIn, DevicePath, NULL);
  EfiBootManagerUpdateConsoleVariable (ErrOut, DevicePath, NULL);

  return EFI_SUCCESS;
}

static EFI_STATUS
EFIAPI
DetectAndPreparePlatformPciDevicePath (
  IN EFI_HANDLE Handle,
  IN EFI_PCI_IO_PROTOCOL *PciIo,
  IN PCI_TYPE00 *Pci
)
{
  EFI_STATUS Status = PciIo->Attributes (PciIo, EfiPciIoAttributeOperationEnable, EFI_PCI_DEVICE_ENABLE, NULL);
  if (EFI_ERROR (Status)) {
    return Status;
  }

  // Connect console for interactive shell
  if (IS_PCI_LPC (Pci) ||
      (IS_CLASS3 (Pci, PCI_CLASS_BRIDGE, PCI_CLASS_BRIDGE_ISA_PDECODE, 0) &&
       Pci->Hdr.VendorId == 0x8086 && (Pci->Hdr.DeviceId == 0x7000))) {
    PrepareLpcBridgeDevicePath (Handle);
    return EFI_SUCCESS;
  }

  return Status;
}

typedef
EFI_STATUS
(EFIAPI *VISIT_PCI_INSTANCE_CALLBACK) (
  IN EFI_HANDLE Handle,
  IN EFI_PCI_IO_PROTOCOL *PciIo,
  IN PCI_TYPE00 *Pci
);

static EFI_STATUS
EFIAPI
VisitPciInstance (
  IN EFI_HANDLE Handle,
  IN VOID *Instance,
  IN VOID *Context
)
{
  PCI_TYPE00 Pci;
  EFI_PCI_IO_PROTOCOL *PciIo = Instance;

  EFI_STATUS Status = PciIo->Pci.Read (PciIo, EfiPciIoWidthUint32, 0, sizeof (Pci) / sizeof (UINT32), &Pci);
  if (EFI_ERROR (Status)) {
    return Status;
  }

  return (*(VISIT_PCI_INSTANCE_CALLBACK)(UINTN)Context) (Handle, PciIo, &Pci);
}

static EFI_STATUS
VisitPciInstances (
  IN VISIT_PCI_INSTANCE_CALLBACK Callback
)
{
  return VisitAllInstancesOfProtocol (&gEfiPciIoProtocolGuid, VisitPciInstance, (VOID *)(UINTN)Callback);
}

VOID
PlatformInitializeConsole (
  VOID)
{
  VisitPciInstances (DetectAndPreparePlatformPciDevicePath);
}
