#!/usr/bin/env python3

"""Compute the MRTD of an Intel TDX guest.

Usage:
    python mrtd.py <firmware>

The MRTD is the build-time measurement of the initial TD memory, i.e., the
base OVMF/TDVF firmware as it is loaded before the TD is launched.
It is everything measured before the RTMRs.

Ported from https://github.com/virtee/tdx-measure/
"""

from __future__ import annotations

import argparse
import hashlib
import struct
import sys
from dataclasses import dataclass
from pathlib import Path

from _library import *


@dataclass
class Section:
    data_offset: int
    raw_data_size: int
    memory_address: int
    memory_data_size: int
    sec_type: int
    attributes: int


def parse_sections(fw: bytes) -> list[Section]:
    """Locate and parse the TDVF metadata sections embedded in `fw`."""
    # The GUIDed table sits just before the last 32 bytes, terminated by a footer.
    end = len(fw) - BYTES_AFTER_TABLE_FOOTER
    if fw[end - 16:end] != encode_guid(TABLE_FOOTER_GUID):
        raise ValueError("invalid TDVF footer GUID (not a TDX firmware image?)")

    tables_len = struct.unpack_from("<H", fw, end - 18)[0]
    if not 0 < tables_len <= end - 18:
        raise ValueError("invalid TDVF table length")
    tables = fw[end - 18 - tables_len:end - 18]

    # Walk the table backwards, entry by entry, to find the metadata-offset entry.
    target = encode_guid(TDX_METADATA_OFFSET_GUID)
    offset = len(tables)
    entry = None
    while offset >= 18:
        entry_len = struct.unpack_from("<H", tables, offset - 18)[0]
        if entry_len == 0 or entry_len > offset - 18:
            raise ValueError("invalid TDVF table entry length")
        if tables[offset - 16:offset] == target:
            entry = tables[offset - 18 - entry_len:offset - 18]
            break
        offset -= entry_len
    if entry is None:
        raise ValueError("TDVF metadata offset entry not found")

    # The entry's trailing u32 is the offset (from EOF) of the metadata descriptor.
    meta_off = len(fw) - struct.unpack_from("<I", entry, len(entry) - 4)[0]
    desc = fw[meta_off:meta_off + 16]
    if desc[:4] != b"TDVF":
        raise ValueError("invalid TDVF metadata descriptor")
    if struct.unpack_from("<I", desc, 8)[0] != 1:
        raise ValueError("unsupported TDVF metadata version")
    num_sections = struct.unpack_from("<I", desc, 12)[0]

    sections = []
    for i in range(num_sections):
        base = meta_off + 16 + 32 * i
        (data_offset, raw_data_size, memory_address, memory_data_size,
         sec_type, attributes) = struct.unpack_from("<IIQQII", fw, base)
        if memory_address % PAGE_SIZE or memory_data_size % PAGE_SIZE:
            raise ValueError("TDVF section not page-aligned")
        if memory_data_size < raw_data_size:
            raise ValueError("TDVF section memory size smaller than raw size")
        if attributes & ATTRIBUTE_MR_EXTEND and data_offset + memory_data_size > len(fw):
            raise ValueError("TDVF section data extends past end of firmware")
        sections.append(Section(data_offset, raw_data_size, memory_address,
                                memory_data_size, sec_type, attributes))
    return sections


def compute_mrtd(fw: bytes, sections: list[Section]) -> bytes:
    """Replay TDH.MEM.PAGE.ADD / TDH.MR.EXTEND over the initial pages."""
    h = hashlib.sha384()

    for s in sections:
        for page in range(s.memory_data_size // PAGE_SIZE):
            gpa = s.memory_address + page * PAGE_SIZE

            if not s.attributes & ATTRIBUTE_PAGE_AUG:
                rec = bytearray(128)
                rec[0:12] = b"MEM.PAGE.ADD"
                rec[16:24] = struct.pack("<Q", gpa)
                h.update(rec)

            if s.attributes & ATTRIBUTE_MR_EXTEND:
                for chunk in range(PAGE_SIZE // MR_EXTEND_GRANULARITY):
                    caddr = gpa + chunk * MR_EXTEND_GRANULARITY
                    rec = bytearray(128)
                    rec[0:9] = b"MR.EXTEND"
                    rec[16:24] = struct.pack("<Q", caddr)
                    h.update(rec)

                    off = s.data_offset + page * PAGE_SIZE + chunk * MR_EXTEND_GRANULARITY
                    h.update(fw[off:off + MR_EXTEND_GRANULARITY])

    return h.digest()


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    with open(argv[1], "rb") as f:
        fw = f.read()

    mrtd = compute_mrtd(fw, parse_sections(fw))
    print(mrtd.hex())
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
