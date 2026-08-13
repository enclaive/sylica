PAGE_SIZE = 0x1000
MR_EXTEND_GRANULARITY = 0x100

ATTRIBUTE_MR_EXTEND = 0x1
ATTRIBUTE_PAGE_AUG = 0x2

TABLE_FOOTER_GUID = "96b582de-1fb2-45f7-baea-a366c55a082d"
TDX_METADATA_OFFSET_GUID = "e47a6535-984a-4798-865e-4685a7bf8ec2"
BYTES_AFTER_TABLE_FOOTER = 32

TDVF_SECTION_TD_CFV = 0x01
TDVF_SECTION_TD_HOB = 0x02
TDVF_SECTION_TEMP_MEM = 0x03


def encode_guid(guid: str) -> bytes:
    groups = guid.split("-")
    if len(groups) != 5:
        raise ValueError(f"invalid GUID: {guid}")
    out = bytearray()
    for i, group in enumerate(groups):
        raw = bytes.fromhex(group)
        out += raw[::-1] if i <= 2 else raw  # first three groups are little-endian
    return bytes(out)


def decode_guid(raw: bytes) -> str:
    return "{}-{}-{}-{}-{}".format(
        raw[0:4][::-1].hex(),
        raw[4:6][::-1].hex(),
        raw[6:8][::-1].hex(),
        raw[8:10].hex(),
        raw[10:16].hex(),
    )


def u16(b, off):
    return int.from_bytes(b[off:off + 2], "little")


def u32(b, off):
    return int.from_bytes(b[off:off + 4], "little")


def u64(b, off):
    return int.from_bytes(b[off:off + 8], "little")
