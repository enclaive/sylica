#!/usr/bin/env python3

"""Compute the TDX TD-HOB measurement for a TDVF firmware image.

Usage:
    python measure.py <firmware> <memory_size>

<memory_size> is the guest RAM size in bytes. Suffixes K/M/G and 0x-hex are
accepted, e.g., 2G, 2048M, 0x80000000, 2147483648.

The TD-HOB and CVF section are the first things measured into RTMR0.
This tool computes the value after measuring the separator following this.

Ported from https://github.com/virtee/tdx-measure/
"""
import hashlib
import sys
import uuid
import struct

from _library import *


def parse_config_table(fw: bytes) -> dict:
    """
    Parse the OVMF GUIDed config table near the footer.
    Returns {guid_str: data_bytes}, e.g.
        {'e47a6535-984a-4798-865e-4685a7bf8ec2': b'\x00\n\x00\x00', ...}
    """
    offset = len(fw) - BYTES_AFTER_TABLE_FOOTER
    if decode_guid(fw[offset - 16:offset]) != TABLE_FOOTER_GUID:
        raise ValueError("Invalid footer GUID")

    tables_len = u16(fw, offset - 18)
    if tables_len == 0 or tables_len > offset - 18:
        raise ValueError("Invalid tables length")
    tables = fw[offset - 18 - tables_len:offset - 18]

    table = {}
    off = len(tables)
    while off >= 18:
        entry_len = u16(tables, off - 18)  # full block length (data + 2 + 16)
        if entry_len < 18 or entry_len > off:
            break
        guid = decode_guid(tables[off - 16:off])
        table[guid] = tables[off - entry_len:off - 18]
        off -= entry_len
    return table


def parse_sections(fw: bytes) -> list:
    """Parse the TDVF metadata descriptor into its section table."""
    table = parse_config_table(fw)
    if TDX_METADATA_OFFSET_GUID not in table:
        raise ValueError("Missing TDVF metadata offset GUID")

    meta_off = u32(table[TDX_METADATA_OFFSET_GUID][-4:], 0)
    meta_off = len(fw) - meta_off
    desc = fw[meta_off:meta_off + 16]

    if desc[:4] != b"TDVF":
        raise ValueError("Invalid TDVF descriptor")
    if u32(desc, 8) != 1:
        raise ValueError("Unsupported TDVF version")
    num_sections = u32(desc, 12)

    sections = []
    for i in range(num_sections):
        o = meta_off + 16 + 32 * i
        s = {
            "data_offset": u32(fw, o + 0),
            "raw_data_size": u32(fw, o + 4),
            "memory_address": u64(fw, o + 8),
            "memory_data_size": u64(fw, o + 16),
            "sec_type": u32(fw, o + 24),
            "attributes": u32(fw, o + 28),
        }
        if s["memory_address"] % PAGE_SIZE != 0:
            raise ValueError("Section memory address not aligned")
        if s["memory_data_size"] < s["raw_data_size"]:
            raise ValueError("Section memory data size less than raw")
        if s["memory_data_size"] % PAGE_SIZE != 0:
            raise ValueError("Section memory data size not aligned")
        if s["attributes"] & ATTRIBUTE_MR_EXTEND and s["raw_data_size"] > s["memory_data_size"]:
            raise ValueError("Section raw data size less than memory")
        sections.append(s)
    return sections


class MemoryAcceptor:
    """MemoryAcceptor: tracks accepted vs. unaccepted [start, end) ranges."""

    def __init__(self, start: int, size: int):
        self.ranges = [(False, start, start + size)]  # (is_accepted, start, end)

    def accept(self, start: int, end: int):
        if start >= end:
            return
        new_ranges = []
        for is_accepted, rs, re in self.ranges:
            if is_accepted or re <= start or rs >= end:
                new_ranges.append((is_accepted, rs, re))
            else:
                if rs < start:
                    new_ranges.append((False, rs, start))
                if re > end:
                    new_ranges.append((False, end, re))
        new_ranges.append((True, start, end))
        new_ranges.sort(key=lambda r: r[1])
        self.ranges = new_ranges


def measure_td_hob(sections: list, memory_size: int) -> bytes:
    """The TD-HOB measurement."""
    acceptor = MemoryAcceptor(0, memory_size)
    td_hob = bytearray()

    td_hob_base_addr = 0x809000
    for s in sections:
        if s["sec_type"] in (TDVF_SECTION_TD_HOB, TDVF_SECTION_TEMP_MEM):
            acceptor.accept(s["memory_address"], s["memory_address"] + s["memory_data_size"])
        if s["sec_type"] == TDVF_SECTION_TD_HOB:
            td_hob_base_addr = s["memory_address"]

    # EFI_HOB_HANDOFF_INFO_TABLE (HobType 0x0001, HobLength 56)
    td_hob += bytes([0x01, 0x00])  # HobType
    td_hob += (56).to_bytes(2, "little")  # HobLength
    td_hob += bytes(4)  # Reserved
    td_hob += (9).to_bytes(4, "little")  # Version
    td_hob += bytes(4)  # BootMode
    td_hob += bytes(8)  # EfiMemoryTop
    td_hob += bytes(8)  # EfiMemoryBottom
    td_hob += bytes(8)  # EfiFreeMemoryTop
    td_hob += bytes(8)  # EfiFreeMemoryBottom
    td_hob += bytes(8)  # EfiEndOfHobList (placeholder, offset 48..56)

    def add_memory_resource_hob(resource_type: int, start: int, length: int):
        td_hob.extend(bytes([0x03, 0x00]))  # HobType
        td_hob.extend((48).to_bytes(2, "little"))  # HobLength
        td_hob.extend(bytes(4))  # Reserved
        td_hob.extend(bytes(16))  # Owner
        td_hob.extend(bytes([resource_type]))  # ResourceType
        td_hob.extend(bytes(3))  # Padding
        td_hob.extend((7).to_bytes(4, "little"))  # ResourceAttribute
        td_hob.extend(start.to_bytes(8, "little"))
        td_hob.extend(length.to_bytes(8, "little"))

    _, last_start, last_end = acceptor.ranges.pop()

    for accepted, start, end in acceptor.ranges:
        add_memory_resource_hob(0x00 if accepted else 0x07, start, end - start)

    if memory_size >= 0xB0000000:
        add_memory_resource_hob(0x07, last_start, 0x80000000 - last_start)
        add_memory_resource_hob(0x07, 0x100000000, last_end - 0x80000000)
    else:
        add_memory_resource_hob(0x07, last_start, last_end - last_start)

    end_of_hob_list = td_hob_base_addr + len(td_hob) + 8
    td_hob[48:56] = end_of_hob_list.to_bytes(8, "little")

    return hashlib.sha384(bytes(td_hob)).digest()


def measure_cfv(sections: list, fw: bytes) -> bytes:
    """The CFV (Configuration Firmware Volume) measurement."""
    for s in sections:
        if s["sec_type"] == TDVF_SECTION_TD_CFV:
            start = s["data_offset"]
            end = start + s["raw_data_size"]
            if end > len(fw):
                raise ValueError("CFV section extends beyond firmware data")
            return hashlib.sha384(fw[start:end]).digest()
    raise ValueError("CFV section does not exist")


def parse_size(s: str) -> int:
    s = s.strip()
    if s.lower().startswith("0x"):
        return int(s, 16)
    mult = 1
    if s and s[-1] in "kKmMgG":
        mult = {"k": 1024, "m": 1024 ** 2, "g": 1024 ** 3}[s[-1].lower()]
        s = s[:-1]
    return int(s) * mult


def variable(uuid, name, data):
    return (uuid
        + struct.pack("<Q", len(name.encode("utf-16le")) // 2)
        + struct.pack("<Q", len(data))
        + name.encode("utf-16le")
        + data)


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    with open(argv[1], "rb") as f:
        fw = f.read()

    efi_global_variable = uuid.UUID("8be4df61-93ca-11d2-aa0d-00e098032b8c").bytes_le
    efi_image_security = uuid.UUID("d719b2cb-3d3a-4596-a3bc-dad00e67656f").bytes_le

    sections = parse_sections(fw)

    hash = lambda value: hashlib.sha384(value).digest()
    extend = lambda value, event: hashlib.sha384(value + event).digest()

    pcr = b"\00" * 48
    pcr = extend(pcr, measure_td_hob(sections, parse_size(argv[2])))
    pcr = extend(pcr, measure_cfv(sections, fw))
    pcr = extend(pcr, hash(b"QEMU"))
    pcr = extend(pcr, hash(b"\x03\x00\x00\x00"))
    pcr = extend(pcr, hash(variable(efi_global_variable, "SecureBoot", b"\x00")))
    pcr = extend(pcr, hash(variable(efi_global_variable, "PK", b"")))
    pcr = extend(pcr, hash(variable(efi_global_variable, "KEK", b"")))
    pcr = extend(pcr, hash(variable(efi_image_security, "db", b"")))
    pcr = extend(pcr, hash(variable(efi_image_security, "dbx", b"")))
    pcr = extend(pcr, hashlib.sha384(b"\x00\x00\x00\x00").digest())
    print(pcr.hex())
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
