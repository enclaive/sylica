import {ctype} from "./binutil.js";

export class OvmfSevMetadataSectionDesc extends ctype {
    static FIELDS = [
        {name: "gpa", type: "u32"},
        {name: "size", type: "u32"},
        {name: "type", type: "u32"},
    ];
}

export class OvmfSevMetadataHeader extends ctype {
    static FIELDS = [
        {name: "signature", size: 4, type: "custom"},
        {name: "size", type: "u32"},
        {name: "version", type: "u32"},
        {name: "num_items", type: "u32"},
    ];
}

export class OvmfFooterTableEntry extends ctype {
    static FIELDS = [
        {name: "size", type: "u16"},
        {name: "guid", size: 16, type: "custom"},
    ];
}

export class SectionType {
    static SNP_SEC_MEM = 1;
    static SNP_SECRETS = 2;
    static CPUID = 3;
    static SVSM_CAA = 4;
    static SNP_KERNEL_HASHES = 0x10;
}

export class GuidLe extends ctype {
    static FIELDS = [
        {name: "data", size: 16, type: "custom"},
    ];

    constructor(data) {
        super();
        this.set("data", Uint8Array.fromHex(data.split("-").map((x, y) => y > 2 ? x : Uint8Array.fromHex(x).reverse().toHex()).join("")));
    }

    static format(data) {
        const real = new Uint8Array(data);
        return `${real.slice(0, 4).reverse().toHex()}-${real.slice(4, 6).reverse().toHex()}-${real.slice(6, 8).reverse().toHex()}-${real.slice(8, 10).toHex()}-${real.slice(10, 16).toHex()}`;
    }
}

export class SevHashTableEntry extends ctype {
    static FIELDS = [
        {name: "guid", type: GuidLe},
        {name: "length", type: "u16"},
        {name: "hash", size: 32, type: "custom"},
    ];
}

export class SevHashTable extends ctype {
    static FIELDS = [
        {name: "guid", type: GuidLe},
        {name: "length", type: "u16"},
        {name: "cmdline", type: SevHashTableEntry},
        {name: "initrd", type: SevHashTableEntry},
        {name: "kernel", type: SevHashTableEntry},
    ];
}

export class PaddedSevHashTable extends ctype {
    static FIELDS = [
        {name: "ht", type: SevHashTable},
        {name: "padding", size: ((ctype.size(SevHashTable) + 15) & ~15) - ctype.size(SevHashTable)},
    ];
}

export class VmcbSeg extends ctype {
    static FIELDS = [
        {name: "selector", type: "u16"},
        {name: "limit", type: "u16"},
        {name: "attrib", type: "u32"},
        {name: "base", type: "u64"},
    ];

    constructor(selector, limit, attrib, base) {
        super();
        this.set("selector", selector);
        this.set("limit", limit);
        this.set("attrib", attrib);
        this.set("base", base);
    }
}

export class SevEsSaveArea extends ctype {
    static FIELDS = [
        {name: "es", type: VmcbSeg},
        {name: "cs", type: VmcbSeg},
        {name: "ss", type: VmcbSeg},
        {name: "ds", type: VmcbSeg},
        {name: "fs", type: VmcbSeg},
        {name: "gs", type: VmcbSeg},
        {name: "gdtr", type: VmcbSeg},
        {name: "ldtr", type: VmcbSeg},
        {name: "idtr", type: VmcbSeg},
        {name: "tr", type: VmcbSeg},
        {name: "vmpl0_ssp", type: "u64"},
        {name: "vmpl1_ssp", type: "u64"},
        {name: "vmpl2_ssp", type: "u64"},
        {name: "vmpl3_ssp", type: "u64"},
        {name: "u_cet", type: "u64"},
        {name: "reserved_0xc8", size: 2},
        {name: "vmpl", type: "u8"},
        {name: "cpl", type: "u8"},
        {name: "reserved_0xcc", size: 4},
        {name: "efer", type: "u64"},
        {name: "reserved_0xd8", size: 104},
        {name: "xss", type: "u64"},
        {name: "cr4", type: "u64"},
        {name: "cr3", type: "u64"},
        {name: "cr0", type: "u64"},
        {name: "dr7", type: "u64"},
        {name: "dr6", type: "u64"},
        {name: "rflags", type: "u64"},
        {name: "rip", type: "u64"},
        {name: "dr0", type: "u64"},
        {name: "dr1", type: "u64"},
        {name: "dr2", type: "u64"},
        {name: "dr3", type: "u64"},
        {name: "dr0_addr_mask", type: "u64"},
        {name: "dr1_addr_mask", type: "u64"},
        {name: "dr2_addr_mask", type: "u64"},
        {name: "dr3_addr_mask", type: "u64"},
        {name: "reserved_0x1c0", size: 24},
        {name: "rsp", type: "u64"},
        {name: "s_cet", type: "u64"},
        {name: "ssp", type: "u64"},
        {name: "isst_addr", type: "u64"},
        {name: "rax", type: "u64"},
        {name: "star", type: "u64"},
        {name: "lstar", type: "u64"},
        {name: "cstar", type: "u64"},
        {name: "sfmask", type: "u64"},
        {name: "kernel_gs_base", type: "u64"},
        {name: "sysenter_cs", type: "u64"},
        {name: "sysenter_esp", type: "u64"},
        {name: "sysenter_eip", type: "u64"},
        {name: "cr2", type: "u64"},
        {name: "reserved_0x248", size: 32},
        {name: "g_pat", type: "u64"},
        {name: "dbgctrl", type: "u64"},
        {name: "br_from", type: "u64"},
        {name: "br_to", type: "u64"},
        {name: "last_excp_from", type: "u64"},
        {name: "last_excp_to", type: "u64"},
        {name: "reserved_0x298", size: 80},
        {name: "pkru", type: "u32"},
        {name: "tsc_aux", type: "u32"},
        {name: "reserved_0x2f0", size: 24},
        {name: "rcx", type: "u64"},
        {name: "rdx", type: "u64"},
        {name: "rbx", type: "u64"},
        {name: "reserved_0x320", type: "u64"},
        {name: "rbp", type: "u64"},
        {name: "rsi", type: "u64"},
        {name: "rdi", type: "u64"},
        {name: "r8", type: "u64"},
        {name: "r9", type: "u64"},
        {name: "r10", type: "u64"},
        {name: "r11", type: "u64"},
        {name: "r12", type: "u64"},
        {name: "r13", type: "u64"},
        {name: "r14", type: "u64"},
        {name: "r15", type: "u64"},
        {name: "reserved_0x380", size: 16},
        {name: "guest_exit_info_1", type: "u64"},
        {name: "guest_exit_info_2", type: "u64"},
        {name: "guest_exit_int_info", type: "u64"},
        {name: "guest_nrip", type: "u64"},
        {name: "sev_features", type: "u64"},
        {name: "vintr_ctrl", type: "u64"},
        {name: "guest_exit_code", type: "u64"},
        {name: "virtual_tom", type: "u64"},
        {name: "tlb_id", type: "u64"},
        {name: "pcpu_id", type: "u64"},
        {name: "event_inj", type: "u64"},
        {name: "xcr0", type: "u64"},
        {name: "reserved_0x3f0", size: 16},
        // # Floating Point Area #
        {name: "x87_dp", type: "u64"},
        {name: "mxcsr", type: "u32"},
        {name: "x87_ftw", type: "u16"},
        {name: "x87_fsw", type: "u16"},
        {name: "x87_fcw", type: "u16"},
        {name: "x87_fop", type: "u16"},
        {name: "x87_ds", type: "u16"},
        {name: "x87_cs", type: "u16"},
        {name: "x87_rip", type: "u64"},
        {name: "fpreg_x87", size: 80},
        {name: "fpreg_xmm", size: 256},
        {name: "fpreg_ymm", size: 256},
        {name: "manual_padding", size: 2448},
    ];
}

export class TcbVersion extends ctype {
    static FIELDS = [
        {name: "bootloader", type: "u8"},
        {name: "tee", type: "u8"},
        {name: "reserved", size: 4},
        {name: "snp", type: "u8"},
        {name: "microcode", type: "u8"},
    ];
}

export class FwVersion extends ctype {
    static FIELDS = [
        {name: "build", type: "u8"},
        {name: "minor", type: "u8"},
        {name: "major", type: "u8"},
        {name: "reserved", type: "u8"},
    ];
}

export class Signature extends ctype {
    static FIELDS = [
        {name: "r", size: 72},
        {name: "s", size: 72},
        {name: "reserved", size: 512 - 144},
    ];
}

export class CpuId extends ctype {
    static FIELDS = [
        {name: "family", type: "u8"},
        {name: "model", type: "u8"},
        {name: "stepping", type: "u8"},
    ];
    product() {
        switch (this.value("family")) {
            case 25:
                switch (this.value("model")) {
                    case 1: return "Milan";
                    case 17: return "Genoa";
                }
                break;
            case 26:
                switch (this.value("model")) {
                    case 2: return "Turin";
                }
                break;
        }
        return "Unknown";
    }
}

export class GuestPolicy extends ctype {
    static FIELDS = [
        {name: "abi_minor", type: "u8"},
        {name: "abi_major", type: "u8"},
        {name: "smt", type: "bool", index: 16 - 16},
        {name: "mbo", type: "bool", index: 17 - 16},
        {name: "migrate_ma", type: "bool", index: 18 - 16},
        {name: "debug", type: "bool", index: 19 - 16},
        {name: "single_socket", type: "bool", index: 20 - 16},
        {name: "cxl_allow", type: "bool", index: 21 - 16},
        {name: "mem_aes_256_xts", type: "bool", index: 22 - 16},
        {name: "rapl_dis", type: "bool", index: 23 - 16},
        {name: "ciphertext_hiding_dram", type: "bool", index: 24 - 16},
        {name: "page_swap_disable", type: "bool", index: 25 - 16},
        {name: "reserved", size: 6}, // alignment hack
    ];
}

export class PlatformInfo extends ctype {
    static FIELDS = [
        {name: "smt_en", type: "bool", index: 0},
        {name: "tsme_en", type: "bool", index: 1},
        {name: "ecc_en", type: "bool", index: 2},
        {name: "rapl_dis", type: "bool", index: 3},
        {name: "ciphertext_hiding_dram_en", type: "bool", index: 4},
        {name: "alias_check_complete", type: "bool", index: 5},
        {name: "unknown", type: "bool", index: 6},
        {name: "tio_en", type: "bool", index: 7},
        {name: "reserved", size: 8}, // alignment hack
    ];
}

export class ReportFlags extends ctype {
    static FIELDS = [
        {name: "author_key_en", type: "bool", index: 0},
        {name: "mask_chip_key", type: "bool", index: 1},
        {name: "signing_key", type: "custom", size: 0},
        {name: "reserved", size: 4}, // alignment hack
    ];
    static unpack(data) {
        const flags = super.unpack(data);
        const raw = flags.value("signing_key").getUint8(0);
        flags.set("signing_key", (raw>>>2)===0 ? "VCEK" : "VLEK");
        return flags;
    }
}

export class SnpAttestation extends ctype {
    static FIELDS = [
        {name: "version", type: "u32"},
        {name: "guest_svn", type: "u32"},
        {name: "policy", type: GuestPolicy},
        {name: "family_id", size: 16},
        {name: "image_id", size: 16},
        {name: "vmpl", type: "u32"},
        {name: "signature_algorithm", type: "u32"},
        {name: "current_tcb", type: TcbVersion},
        {name: "platform_info", type: PlatformInfo},
        {name: "flags", type: ReportFlags},
        {name: "reserved_zero", type: "u32"},
        {name: "report_data", size: 64},
        {name: "measurement", size: 48},
        {name: "host_data", size: 32},
        {name: "id_key_digest", size: 48},
        {name: "author_key_digest", size: 48},
        {name: "report_id", size: 32},
        {name: "report_id_ma", size: 32},
        {name: "reported_tcb", type: TcbVersion},
        {name: "cpuid", type: CpuId},
        {name: "reserved_one", size: 21},
        {name: "chip_id", size: 64},
        {name: "committed_tcb", type: TcbVersion},
        {name: "current_fw", type: FwVersion},
        {name: "comitted_fw", type: FwVersion},
        {name: "launch_tcb", type: TcbVersion},
        {name: "launch_mit", type: "u64"},
        {name: "current_mit", type: "u64"},
        {name: "reserved_two", size: 152},
        {name: "signature", type: Signature},
    ];
    raw_report = null;
    static unpack(data) {
        const attestation = super.unpack(data);
        attestation.raw_report = data.slice(0, ctype.size(SnpAttestation)-ctype.size(Signature));
        return attestation;
    }
}

export class TdxQuoteHeader extends ctype {
    static FIELDS = [
        { name: "version", type: "u16" },               // 0x00 - 0x02 (Must be 5)
        { name: "attestation_key_type", type: "u16" },  // 0x02 - 0x04 (2 = ECDSA-P256)
        { name: "tee_type", type: "u32" },              // 0x04 - 0x08 (0x00000081 = TDX)
        { name: "pce_svn", size: 2 },                   // 0x08 - 0x0A
        { name: "qe_svn", size: 2 },                    // 0x0A - 0x0C
        { name: "qe_vendor_id", size: 16 },             // 0x0C - 0x1C
        { name: "user_data", size: 20 },                // 0x1C - 0x30
    ];
}

export class TdQuoteBodyDescriptor extends ctype {
    static FIELDS = [
        { name: "type", type: "u16" },
        { name: "size", type: "u32" },
    ];
}

export class TdQuoteBodyV4 extends ctype {
    static FIELDS = [
        { name: "tee_tcb_svn", size: 16 },
        { name: "mr_seam", size: 48 },
        { name: "mr_signer_seam", size: 48 },
        { name: "seam_attributes", size: 8 },
        { name: "td_attributes", size: 8 },
        { name: "xfam", size: 8 },
        { name: "mr_td", size: 48 },
        { name: "mr_config_id", size: 48 },
        { name: "mr_owner", size: 48 },
        { name: "mr_owner_config", size: 48 },
        { name: "rtmr0", size: 48 },
        { name: "rtmr1", size: 48 },
        { name: "rtmr2", size: 48 },
        { name: "rtmr3", size: 48 },
        { name: "report_data", size: 64 },
    ];
}

export class TdQuoteBodyV5 extends ctype {
    static FIELDS = [
        ...TdQuoteBodyV4.FIELDS,
        { name: "tee_tcb_svn2", size: 16 },
        { name: "mr_service_td", size: 48 },
    ];
}

export class EnclaveReport extends ctype {
    static FIELDS = [
        { name: "cpu_svn", size: 16 },                  // 0x000 - 0x010
        { name: "misc_select", type: "u32" },           // 0x010 - 0x014
        { name: "reserved1", size: 28 },                // 0x014 - 0x030
        { name: "attributes", size: 16 },               // 0x030 - 0x040
        { name: "mr_enclave", size: 32 },               // 0x040 - 0x060
        { name: "reserved2", size: 32 },                // 0x060 - 0x080
        { name: "mr_signer", size: 32 },                // 0x080 - 0x0A0
        { name: "reserved3", size: 96 },                // 0x0A0 - 0x100
        { name: "isv_prod_id", type: "u16" },           // 0x100 - 0x102
        { name: "isv_svn", type: "u16" },               // 0x102 - 0x104
        { name: "reserved4", size: 60 },                // 0x104 - 0x140
        { name: "report_data", size: 64 },              // 0x140 - 0x180
    ];
}

export class Ecdsa256Signature extends ctype {
    static FIELDS = [
        { name: "r", size: 32 },
        { name: "s", size: 32 },
    ];
}

export class Ecdsa256PublicKey extends ctype {
    static FIELDS = [
        { name: "x", size: 32 },
        { name: "y", size: 32 },
    ];
}

export class CertificationDataHeader extends ctype {
    static FIELDS = [
        { name: "type", type: "u16" },
        { name: "size", type: "u32" },
    ];
}

export class EcdsaSignatureData extends ctype {
    static FIELDS = [
        { name: "signed_data_size", type: "u32" },
        { name: "signature", type: Ecdsa256Signature },
        { name: "attestation_key", type: Ecdsa256PublicKey },
    ];
}

export class QeReportCertData extends ctype {
    static FIELDS = [
        { name: "qe_report", type: EnclaveReport },
        { name: "qe_report_signature", type: Ecdsa256Signature },
        { name: "qe_auth_data_size", type: "u16" },
    ];
}

export class TdxQuote {
    // untested for v5
    static unpack(data) {
        const quote = new TdxQuote();

        quote.header = TdxQuoteHeader.unpack(data);
        let offset = ctype.size(TdxQuoteHeader);

        let bodySize = 0;

        const version = quote.header.value("version");
        if (version === 4) {
            bodySize = ctype.size(TdQuoteBodyV4);
            quote.body = TdQuoteBodyV4.unpack(data.slice(offset, offset + bodySize));
        } else if (version === 5) {
            quote.descriptor = TdQuoteBodyDescriptor.unpack(data.slice(offset, offset + ctype.size(TdQuoteBodyDescriptor)));
            offset += ctype.size(TdQuoteBodyDescriptor);

            const bodyType = quote.descriptor.value("type");
            bodySize = quote.descriptor.value("size");

            if (bodyType === 2 && bodySize === ctype.size(TdQuoteBodyV4)) {
                quote.body = TdQuoteBodyV4.unpack(data.slice(offset, offset + bodySize));
            } else if (bodyType === 3 && bodySize === ctype.size(TdQuoteBodyV5)) {
                quote.body = TdQuoteBodyV5.unpack(data.slice(offset, offset + bodySize));
            } else {
                throw new Error(`Unsupported V5 body type (${bodyType}) or size (${bodySize})`);
            }
        } else {
            throw new Error(`Unsupported quote version: ${version}`);
        }

        quote.rawReportForSignature = new Uint8Array(data.slice(0, offset + bodySize));
        offset += bodySize;

        quote.sigData = EcdsaSignatureData.unpack(data.slice(offset, offset + ctype.size(EcdsaSignatureData)));
        offset += ctype.size(EcdsaSignatureData);

        quote.certHeader = CertificationDataHeader.unpack(data.slice(offset, offset + ctype.size(CertificationDataHeader)));
        offset += ctype.size(CertificationDataHeader);

        const certType = quote.certHeader.value("type");
        if (certType === 6) {
            const qeStart = offset;
            quote.qeCertData = QeReportCertData.unpack(data.slice(offset, offset + ctype.size(QeReportCertData)));
            quote.rawQeReportBytes = new Uint8Array(data.slice(qeStart, qeStart + ctype.size(EnclaveReport)));
            offset += ctype.size(QeReportCertData);

            const authDataSize = quote.qeCertData.value("qe_auth_data_size");
            quote.qeAuthData = new Uint8Array(data.slice(offset, offset + authDataSize));
            offset += authDataSize;

            quote.pckCertHeader = CertificationDataHeader.unpack(data.slice(offset, offset + ctype.size(CertificationDataHeader)));
            offset += ctype.size(CertificationDataHeader);

            quote.pckCertChainRaw = new Uint8Array(data.slice(offset, offset + quote.pckCertHeader.value("size")));
        } else if (certType === 5) {
            quote.pckCertChainRaw = new Uint8Array(data.slice(offset, offset + quote.certHeader.value("size")));
        } else {
            throw new Error(`Unsupported certification type: ${certType}`);
        }

        return quote;
    }

    pack() {
        const isV5 = this.header?.value("version") === 5;
        const certType = this.certHeader?.value("type");

        const certParts = certType === 6
            ? [this.qeCertData?.pack(), this.qeAuthData, this.pckCertHeader?.pack(), this.pckCertChainRaw]
            : certType === 5
                ? [this.pckCertChainRaw]
                : [];

        const parts = [
            this.header?.pack(),
            isV5 ? this.descriptor?.pack() : null,
            this.body?.pack(),
            this.sigData?.pack(),
            this.certHeader?.pack(),
            ...certParts
        ].filter(Boolean);

        const totalSize = parts.reduce((acc, part) => acc + part.byteLength, 0);
        const buffer = new Uint8Array(totalSize);
        let offset = 0;

        for (const part of parts) {
            buffer.set(part, offset);
            offset += part.byteLength;
        }

        return buffer;
    }
}

export class TcgPcrEventHeader extends ctype {
    static FIELDS = [
        { name: "pcr_index", type: "u32" },
        { name: "event_type", type: "u32" },
        { name: "digest", size: 20 },
        { name: "event_data_size", type: "u32" },
    ];
}

export class TcgEfiSpecIdEventHeader extends ctype {
    static FIELDS = [
        { name: "signature", size: 16 },
        { name: "platform_class", type: "u32" },
        { name: "spec_version_minor", type: "u8" },
        { name: "spec_version_major", type: "u8" },
        { name: "spec_version_errata", type: "u8" },
        { name: "uint8_size", type: "u8" },
        { name: "number_of_algorithms", type: "u32" },
    ];
}

export class TcgEfiSpecIdEventAlgorithmSize extends ctype {
    static FIELDS = [
        { name: "algorithm_id", type: "u16" },
        { name: "digest_size", type: "u16" },
    ];
}

export class TcgPcrEvent2Header extends ctype {
    static FIELDS = [
        { name: "pcr_index", type: "u32" },
        { name: "event_type", type: "u32" },
        { name: "digest_count", type: "u32" },
    ];
}

function eventType(value) {
    switch (value) {
        case 0x00: return "EV_PREBOOT_CERT";
        case 0x01: return "EV_POST_CODE";
        case 0x03: return "EV_NO_ACTION";
        case 0x04: return "EV_SEPARATOR";
        case 0x05: return "EV_ACTION";
        case 0x06: return "EV_EVENT_TAG";
        case 0x07: return "EV_S_CRTM_CONTENTS";
        case 0x08: return "EV_S_CRTM_VERSION";
        case 0x09: return "EV_CPU_MICROCODE";
        case 0x0A: return "EV_PLATFORM_CONFIG_FLAGS";
        case 0x0B: return "EV_TABLE_OF_DEVICES";
        case 0x0C: return "EV_COMPACT_HASH";
        case 0x0F: return "EV_NONHOST_CODE";
        case 0x10: return "EV_NONHOST_CONFIG";
        case 0x11: return "EV_NONHOST_INFO";
        case 0x12: return "EV_OMIT_BOOT_DEVICE_EVENTS";
        case 0x80000000: return "EV_EFI_EVENT_BASE";
        case 0x80000001: return "EV_EFI_VARIABLE_DRIVER_CONFIG";
        case 0x80000002: return "EV_EFI_VARIABLE_BOOT";
        case 0x80000003: return "EV_EFI_BOOT_SERVICES_APPLICATION";
        case 0x80000004: return "EV_EFI_BOOT_SERVICES_DRIVER";
        case 0x80000005: return "EV_EFI_RUNTIME_SERVICES_DRIVER";
        case 0x80000006: return "EV_EFI_GPT_EVENT";
        case 0x80000007: return "EV_EFI_ACTION";
        case 0x80000008: return "EV_EFI_PLATFORM_FIRMWARE_BLOB";
        case 0x80000009: return "EV_EFI_HANDOFF_TABLES";
        case 0x8000000A: return "EV_EFI_PLATFORM_FIRMWARE_BLOB2";
        case 0x8000000B: return "EV_EFI_HANDOFF_TABLES2";
        case 0x80000010: return "EV_EFI_HCRTM_EVENT";
        case 0x800000E0: return "EV_EFI_VARIABLE_AUTHORITY";
        case 0x800000E1: return "EV_EFI_SPDM_FIRMWARE_BLOB";
        case 0x800000E2: return "EV_EFI_SPDM_FIRMWARE_CONFIG";
        default:
            throw new Error(`unknown event type ${value}`);
    }
}

export class CcelEventLog {
    events = [];

    static unpack(data) {
        let offset = 0;
        const log = new CcelEventLog();
        const view = new DataView(data);

        if (data.byteLength === 0) return log;

        const header = TcgPcrEventHeader.unpack(data);
        offset += ctype.size(TcgPcrEventHeader);

        const specData = data.slice(offset, offset + header.value("event_data_size"));
        offset += header.value("event_data_size");

        const specHeader = TcgEfiSpecIdEventHeader.unpack(specData);
        let specOffset = ctype.size(TcgEfiSpecIdEventHeader);

        const algorithmSizes = [];
        const algSizeMap = new Map();

        for (let i = 0; i < specHeader.value("number_of_algorithms"); i++) {
            const algSize = TcgEfiSpecIdEventAlgorithmSize.unpack(specData.slice(specOffset));
            algorithmSizes.push(algSize);
            algSizeMap.set(algSize.value("algorithm_id"), algSize.value("digest_size"));
            specOffset += ctype.size(TcgEfiSpecIdEventAlgorithmSize);
        }

        const vendorInfoSize = new DataView(specData).getUint8(specOffset);
        specOffset += 1;
        const vendorInfo = new Uint8Array(specData.slice(specOffset, specOffset + vendorInfoSize));

        log.spec = { header, specHeader, algorithmSizes, vendorInfo, rawEventData: new Uint8Array(specData) };

        while (offset < data.byteLength) {
            const eventHeader = TcgPcrEvent2Header.unpack(data.slice(offset));
            offset += ctype.size(TcgPcrEvent2Header);

            if (eventHeader.value("pcr_index") === 0xffffffff) break;

            const digests = [];
            for (let i = 0; i < eventHeader.value("digest_count"); i++) {
                const algorithmId = view.getUint16(offset, true);
                offset += 2;

                const digestSize = algSizeMap.get(algorithmId);
                if (digestSize === undefined) throw new Error(`Unknown algorithm ID 0x${algorithmId.toString(16)} at offset ${offset - 2}`);

                const digest = new Uint8Array(data.slice(offset, offset + digestSize));
                offset += digestSize;

                digests.push({ algorithm_id: algorithmId, digest });
            }

            const eventSize = view.getUint32(offset, true);
            offset += 4;

            const eventData = new Uint8Array(data.slice(offset, offset + eventSize));
            offset += eventSize;

            log.events.push({
                pcr_index: eventHeader.value("pcr_index"),
                event_type: eventHeader.value("event_type"),
                digests: digests,
                event_size: eventSize,
                event_data: eventData,
                rtmr: eventHeader.value("pcr_index") - 1,
                eventType: eventType(eventHeader.value("event_type")),
            });
        }

        return log;
    }

    pack() {
        const parts = [];

        const specDataParts = [
            this.spec.specHeader.pack(),
            ...this.spec.algorithmSizes.map((a) => a.pack()),
            new Uint8Array([this.spec.vendorInfo.byteLength]),
            this.spec.vendorInfo,
        ];

        const specDataSize = specDataParts.reduce((acc, p) => acc + p.byteLength, 0);
        this.spec.header.set("event_data_size", specDataSize);

        parts.push(this.spec.header.pack());
        parts.push(...specDataParts);

        for (let i = 0; i < this.events.length; i++) {
            const event = this.events[i];
            const header = new TcgPcrEvent2Header();
            header.set("pcr_index", event.pcr_index);
            header.set("event_type", event.event_type);
            header.set("digest_count", event.digests.length);

            parts.push(header.pack());

            for (const d of event.digests) {
                const algBuf = new ArrayBuffer(2);
                new DataView(algBuf).setUint16(0, d.algorithm_id, true);
                parts.push(new Uint8Array(algBuf));
                parts.push(d.digest);
            }

            const sizeBuf = new ArrayBuffer(4);
            new DataView(sizeBuf).setUint32(0, event.event_data.byteLength, true);
            parts.push(new Uint8Array(sizeBuf));
            parts.push(event.event_data);
        }

        const totalSize = parts.reduce((acc, part) => acc + part.byteLength, 0);
        const buffer = new Uint8Array(totalSize);
        let offset = 0;

        for (const part of parts) {
            buffer.set(part, offset);
            offset += part.byteLength;
        }

        return buffer;
    }
}