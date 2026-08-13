import {authenticode, ctype, efiVariable, encodeText, encodeUtf16LE} from "./binutil.js";
import {
    SectionType, GuidLe, SevEsSaveArea, VmcbSeg, PaddedSevHashTable, SevHashTable, SevHashTableEntry,
    OvmfFooterTableEntry, OvmfSevMetadataHeader, OvmfSevMetadataSectionDesc
} from "./types.js";

function cpu_sig(family, model, stepping) {
    const f_low = family > 0xF ? 0xF : family;
    const f_high = family > 0xF ? (family - 0xF) & 0xFF : 0;
    return (
        (f_high << 20) |
        ((model >> 4) & 0xF) << 16 |
        (f_low << 8) |
        ((model & 0xF) << 4) |
        (stepping & 0xF)
    ) >>> 0;
}

const CPU_SIGS = {
    'EPYC-v4':    cpu_sig(23,  1, 2),
    'EPYC-Rome':  cpu_sig(23, 49, 0),
    'EPYC-Milan': cpu_sig(25,  1, 1),
    'EPYC-Genoa': cpu_sig(25, 17, 0),
    'EPYC-Turin': cpu_sig(26,  0, 0),
};

const sha384 = async data => new Uint8Array(await crypto.subtle.digest("SHA-384", data));

class GCTX {
    static LD_SIZE = 48;
    static VMSA_GPA = 0xFFFFFFFFF000;
    static ZEROS = new Uint8Array(GCTX.LD_SIZE);
    constructor(ovmf_hash) {
        this._ld = Uint8Array.fromHex(ovmf_hash);
    }
    async _update(page_type, gpa, contents) {
        if (contents.length !== GCTX.LD_SIZE) throw new Error("invalid length");

        const page_info_len = 0x70;
        const is_imi = 0;
        const vmpl3_perms = 0, vmpl2_perms = 0, vmpl1_perms = 0;

        // SNP spec 8.17.2 Table 67 Layout of the PAGE_INFO structure
        const page_info = new Uint8Array(page_info_len);
        // page_info = self._ld + contents
        page_info.set(this._ld, 0);
        page_info.set(contents, GCTX.LD_SIZE);
        const params = new DataView(page_info.buffer, GCTX.LD_SIZE + contents.length, 16);
        // page_info += le16(page_info_len) + le8(page_type) + le8(is_imi)
        params.setUint16(0, page_info_len, true);
        params.setUint8(2, page_type);
        params.setUint8(3, is_imi);
        // page_info += le8(vmpl3_perms) + le8(vmpl2_perms) + le8(vmpl1_perms) + le8(0)
        params.setUint8(4, vmpl3_perms);
        params.setUint8(5, vmpl2_perms);
        params.setUint8(6, vmpl1_perms);
        params.setUint8(7, 0);
        // page_info += le64(gpa)
        params.setBigUint64(8, BigInt(gpa), true);
        this._ld = await sha384(page_info)
    }
    async update_normal_pages(start_gpa, data) {
        if (data.byteLength % 4096 !== 0) throw new Error("invalid length");
        for (let offset = 0; offset < data.length; offset += 4096) {
            const page_data = data.slice(offset).slice(0, 4096);
            await this._update(0x01, start_gpa + offset, await sha384(page_data))
        }
    }
    async update_vmsa_page(data) {
        if (data.byteLength !== 4096) throw new Error("invalid length");
        await this._update(0x02, GCTX.VMSA_GPA, await sha384(data))
    }
    async update_zero_pages(gpa, length_bytes) {
        if (length_bytes % 4096 !== 0) throw new Error("invalid length");
        for (let offset = 0; offset < length_bytes; offset += 4096) {
            await this._update(0x03, gpa + offset, GCTX.ZEROS)
        }
    }
    async update_secrets_page(gpa) {
        await this._update(0x05, gpa, GCTX.ZEROS)
    }
    async update_cpuid_page(gpa) {
        await this._update(0x06, gpa, GCTX.ZEROS)
    }
    ld() {
        return this._ld;
    }
}

class SevHashes {
    PAGE_MASK = 0xfff;
    SEV_HASH_TABLE_HEADER_GUID = new GuidLe("9438d606-4f22-4cc9-b479-a793d411fd21");
    SEV_KERNEL_ENTRY_GUID = new GuidLe("4de79437-abd2-427f-b835-d5b172d2045b");
    SEV_INITRD_ENTRY_GUID = new GuidLe("44baf731-3a2f-4bd7-9af1-41e29169781d");
    SEV_CMDLINE_ENTRY_GUID = new GuidLe("97d02dd8-bd20-4c94-aa78-e7714d36ab2a");
    constructor(kernel, initrd, cmdline) {
        this.kernel = kernel;
        this.initrd = initrd;
        this.cmdline = cmdline;
    }
    page(sev_hashes_table_gpa) {
        // offset_in_page = sev_hashes_table_gpa & PAGE_MASK
        // sev_hashes_page = sev_hashes.construct_page(offset_in_page)
        return this.construct_page(sev_hashes_table_gpa & this.PAGE_MASK)
    }
    construct_page(offset) {
        const hashes_table = this.construct_table()
        if (offset + hashes_table.length > 4096) throw new Error("invalid hashes table length");

        // page = bytes(offset) + hashes_table + bytes(4096 - offset - len(hashes_table))
        const page = new Uint8Array(4096);
        page.set(hashes_table, offset);
        return page
    }
    construct_table() {
        const padded_ht = new PaddedSevHashTable();
        const ht = new SevHashTable();
        const cmdline = new SevHashTableEntry();
        const initrd = new SevHashTableEntry();
        const kernel = new SevHashTableEntry();
        padded_ht.set("ht", ht);
        ht.set("guid", this.SEV_HASH_TABLE_HEADER_GUID);
        ht.set("length", ctype.size(SevHashTable));
        ht.set("cmdline", cmdline);
        cmdline.set("guid", this.SEV_CMDLINE_ENTRY_GUID);
        cmdline.set("length", ctype.size(SevHashTableEntry));
        cmdline.set("hash", Uint8Array.fromHex(this.cmdline))
        ht.set("initrd", initrd);
        initrd.set("guid", this.SEV_INITRD_ENTRY_GUID);
        initrd.set("length", ctype.size(SevHashTableEntry));
        initrd.set("hash", Uint8Array.fromHex(this.initrd))
        ht.set("kernel", kernel);
        kernel.set("guid", this.SEV_KERNEL_ENTRY_GUID);
        kernel.set("length", ctype.size(SevHashTableEntry));
        kernel.set("hash", Uint8Array.fromHex(this.kernel))
        return padded_ht.pack();
    }
}

class VMSA {
    BSP_EIP = 0xfffffff0;
    constructor(ap_eip, vcpu_sig, guest_features, vmm_type) {
        this.bsp_save_area = this.build_save_area(this.BSP_EIP, guest_features, vcpu_sig, vmm_type)
        this.ap_save_area = this.build_save_area(ap_eip, guest_features, vcpu_sig, vmm_type)
    }
    pages(vcpus) {
        const out = [];
        for (let i = 0; i < vcpus; i++) {
            out.push(i === 0 ? this.bsp_save_area : this.ap_save_area)
        }
        return out;
    }
    build_save_area(eip, sev_features, vcpu_sig, vmm_type) {
        const area = new SevEsSaveArea();
        area.set("es", new VmcbSeg(0, 0x93, 0xffff, 0));
        area.set("cs", new VmcbSeg(0xf000, 0x9b, 0xffff, (eip & 0xffff0000)>>>0));
        area.set("ss", new VmcbSeg(0, vmm_type !== "EC2" ? 0x93 : 0x92, 0xffff, 0));
        area.set("ds", new VmcbSeg(0, 0x93, 0xffff, 0));
        area.set("fs", new VmcbSeg(0, 0x93, 0xffff, 0));
        area.set("gs", new VmcbSeg(0, 0x93, 0xffff, 0));
        area.set("gdtr", new VmcbSeg(0, 0, 0xffff, 0));
        area.set("idtr", new VmcbSeg(0, 0, 0xffff, 0));
        area.set("ldtr", new VmcbSeg(0, 0x82, 0xffff, 0));
        area.set("tr", new VmcbSeg(0, vmm_type !== "EC2" ? 0x8b : 0x83, 0xffff, 0));
        area.set("efer", 0x1000); // KVM enables EFER_SVME
        area.set("cr4", 0x40); // KVM enables X86_CR4_MCE
        area.set("cr0", 0x10);
        area.set("dr7", 0x400);
        area.set("dr6", 0xffff0ff0);
        area.set("rflags", 0x2);
        area.set("rip", eip & 0xffff);
        // PAT MSR: See AMD APM Vol 2, Section A.3
        area.set("g_pat", vmm_type !== "GCE" ? 0x7040600070406 : 0x00070106);
        area.set("rdx", vmm_type === "QEMU" ? vcpu_sig : 0x600);
        area.set("sev_features", sev_features)
        area.set("xcr0", 0x1);
        area.set("mxcsr", vmm_type === "QEMU" ? 0x1f80 : 0);
        area.set("x87_fcw", vmm_type === "QEMU" ? 0x37f : 0);
        return area.pack();
    }
}

export async function snp_measure(data, config) {
    console.log("measuring", data, config);

    const vcpus = data.vcpus;
    const vcpu_sig = CPU_SIGS[data.vcpu_sig];
    const guest_features = 0x1;
    const vmm_type = "QEMU";

    const gctx = new GCTX(config.ovmf_hash);
    const sev_hashes = new SevHashes(data.kernel, data.initrd, data.cmdline);

    // snp_update_metadata_pages
    for (const desc of config.sections) {
        // snp_update_section
        if (desc.type === SectionType.SNP_SEC_MEM) {
            await gctx.update_zero_pages(desc.gpa, desc.size);
        } else if (desc.type === SectionType.SNP_SECRETS) {
            await gctx.update_secrets_page(desc.gpa);
        } else if (desc.type === SectionType.CPUID) {
            await gctx.update_cpuid_page(desc.gpa);
        } else if (desc.type === SectionType.SNP_KERNEL_HASHES) {
            await gctx.update_normal_pages(desc.gpa, sev_hashes.page(config.sev_hashes));
        } else if (desc.type === SectionType.SVSM_CAA) {
            await gctx.update_zero_pages(desc.gpa, desc.size)
        } else {
            throw new Error(`unknown section type: ${desc.type}`);
        }
    }

    const vmsa = new VMSA(config.reset_eip, vcpu_sig, guest_features, vmm_type);

    for (const vmsa_page of vmsa.pages(vcpus)) {
        await gctx.update_vmsa_page(vmsa_page)
    }

    return gctx.ld()
}

function parseMemorySize(mb) {
    if (typeof mb === "number") return mb * 1024 * 1024;
    const match = String(mb).trim().match(/^(\d+)\s*([kmg])?b?$/i);
    if (!match) return Number(mb) * 1024 * 1024;
    const mult = { k: 1024, m: 1024 ** 2, g: 1024 ** 3 }[match[2]?.toLowerCase()] || 1024 ** 2;
    return parseInt(match[1], 10) * mult;
}

export function measureVariables(sb = "00") {
    const efiGlobalVariable = new GuidLe("8be4df61-93ca-11d2-aa0d-00e098032b8c").value("data");
    const efiImageSecurity = new GuidLe("d719b2cb-3d3a-4596-a3bc-dad00e67656f").value("data");
    const secureBoot = efiVariable(efiGlobalVariable, "SecureBoot", Uint8Array.fromHex(sb));
    const pk = efiVariable(efiGlobalVariable, "PK", "");
    const kek = efiVariable(efiGlobalVariable, "KEK", "");
    const db = efiVariable(efiImageSecurity, "db", "");
    const dbx = efiVariable(efiImageSecurity, "dbx", "");
    return { secureBoot, pk, kek, db, dbx };
}

export async function tdx_measure(data, config) {
    const memorySize = parseMemorySize(data.memory);
    const fw = new Uint8Array(config.data);

    // Track memory acceptance ranges
    let ranges = [{ acc: false, s: 0, e: memorySize }];
    let hobBase = 0x809000;

    for (const section of config.sections) {
        if (section.secType === 2) hobBase = section.memoryAddress; // TD_HOB
        if (section.secType === 2 || section.secType === 3) {       // TD_HOB or TEMP_MEM
            const [sAddr, eAddr] = [section.memoryAddress, section.memoryAddress + section.memoryDataSize];
            if (sAddr >= eAddr) continue;
            ranges = ranges.flatMap(r => {
                if (r.acc || r.e <= sAddr || r.s >= eAddr) return [r];
                const res = [];
                if (r.s < sAddr) res.push({ acc: false, s: r.s, e: sAddr });
                if (r.e > eAddr) res.push({ acc: false, s: eAddr, e: r.e });
                return res;
            });
            ranges.push({ acc: true, s: sAddr, e: eAddr });
            ranges.sort((a, b) => a.s - b.s);
        }
    }

    const hob = [];
    const push = b => hob.push(...b);
    const u16 = v => [v & 0xff, (v >> 8) & 0xff];
    const u32 = v => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff];
    const u64 = v => {
        const b = new Uint8Array(8);
        new DataView(b.buffer).setBigUint64(0, BigInt(v), true);
        return Array.from(b);
    };

    // EFI_HOB_HANDOFF_INFO_TABLE
    push([0x01, 0x00, ...u16(56), 0, 0, 0, 0, ...u32(9), 0, 0, 0, 0]);
    push(new Array(32).fill(0));
    push(new Array(8).fill(0));

    const addHob = (type, start, len) => {
        push([0x03, 0x00, ...u16(48), 0, 0, 0, 0]);
        push(new Array(16).fill(0));
        push([type, 0, 0, 0, ...u32(7), ...u64(start), ...u64(len)]);
    };

    const last = ranges.pop();
    for (const r of ranges) addHob(r.acc ? 0x00 : 0x07, r.s, r.e - r.s);

    if (memorySize >= 0xB0000000) {
        addHob(0x07, last.s, 0x80000000 - last.s);
        addHob(0x07, 0x100000000, last.e - 0x80000000);
    } else {
        addHob(0x07, last.s, last.e - last.s);
    }

    const endHobBytes = u64(hobBase + hob.length + 8);
    for (let i = 0; i < 8; i++) hob[48 + i] = endHobBytes[i];

    const cfv = config.sections.find(s => s.secType === 1); // TD_CFV
    if (!cfv) throw new Error("missing CFV section");

    const hobHash = await sha384(new Uint8Array(hob));
    const cfvHash = await sha384(fw.subarray(cfv.dataOffset, cfv.dataOffset + cfv.rawDataSize));
    const sepHash = await sha384(new Uint8Array(4));
    const cmdHash = await sha384(encodeUtf16LE(data.append+"\x00"));

    const extend = async (pcr, val) => {
        const buf = new Uint8Array(pcr.length + val.length);
        buf.set(pcr, 0);
        buf.set(val, pcr.length);
        return await sha384(buf);
    };
    const variables = measureVariables();

    let rtmr0 = new Uint8Array(48);
    rtmr0 = await extend(rtmr0, hobHash);
    rtmr0 = await extend(rtmr0, cfvHash);
    rtmr0 = await extend(rtmr0, await sha384(encodeText("QEMU")));
    rtmr0 = await extend(rtmr0, await sha384(Uint8Array.fromHex("03000000")));
    rtmr0 = await extend(rtmr0, await sha384(variables.secureBoot));
    rtmr0 = await extend(rtmr0, await sha384(variables.pk));
    rtmr0 = await extend(rtmr0, await sha384(variables.kek));
    rtmr0 = await extend(rtmr0, await sha384(variables.db));
    rtmr0 = await extend(rtmr0, await sha384(variables.dbx));
    rtmr0 = await extend(rtmr0, sepHash);

    let rtmr1 = new Uint8Array(48);
    rtmr1 = await extend(rtmr1, Uint8Array.fromHex(data["kernel-tdx"]));
    rtmr1 = await extend(rtmr1, await sha384(encodeText("Calling EFI Application from Boot Option")));
    rtmr1 = await extend(rtmr1, sepHash);
    rtmr1 = await extend(rtmr1, await sha384(encodeText("Exit Boot Services Invocation")));
    rtmr1 = await extend(rtmr1, await sha384(encodeText("Exit Boot Services Returned with Success")));

    let rtmr2 = new Uint8Array(48);
    rtmr2 = await extend(rtmr2, cmdHash);
    rtmr2 = await extend(rtmr2, Uint8Array.fromHex(data["initrd-tdx"]));

    return {rtmr0, rtmr1, rtmr2,
        hob: hobHash.toHex(),
        cfv: cfvHash.toHex(),
        sep: sepHash.toHex(),
        cmd: cmdHash.toHex(),
        kernel: data["kernel-tdx"],
        initrd: data["initrd-tdx"],
    };
}

export async function ovmf_measure(mode, data) {
    const size = data.byteLength;
    const entry_header_size = ctype.size(OvmfFooterTableEntry);
    const start_of_footer_table = size - 32 - entry_header_size;
    const footer = OvmfFooterTableEntry.unpack(data.slice(start_of_footer_table));
    const expected_footer_guid = new GuidLe("96b582de-1fb2-45f7-baea-a366c55a082d").pack();

    const footer_guid = new Uint8Array(footer.value("guid"));
    if (footer_guid.toHex() !== expected_footer_guid.toHex()) throw new Error("invalid footer guid");

    const table_size = footer.value("size") - entry_header_size;
    if (table_size < 0) throw new Error("invalid footer table size");

    const table = {};

    let table_bytes = data.slice(start_of_footer_table - table_size, start_of_footer_table);
    while (table_bytes.byteLength >= entry_header_size) {
        const entry = OvmfFooterTableEntry.unpack(table_bytes.slice(-entry_header_size));
        if (entry.value("size") < entry_header_size) throw new Error("invalid entry size");

        const entry_guid = GuidLe.format(entry.value("guid"));
        table[entry_guid] = table_bytes.slice(-entry.value("size")).slice(0, -entry_header_size);
        table_bytes = table_bytes.slice(0, -entry.value("size"));
    }

    return mode === "snp" ? ovmf_measure_snp(table, data) : ovmf_measure_tdx(table, data);
}

async function ovmf_measure_snp(table, data) {
    const sevHashes = table["7255371f-3a3b-4b04-927b-1da6efa8d454"];
    if (!sevHashes) throw new Error("missing table entry for SEV hashes");

    const resetEip = table["00f771de-1a7e-4fcb-890e-68c77e2fb44e"];
    if (!resetEip) throw new Error("missing table entry for reset block");

    const sevMetadata = table["dc886566-984a-4798-a75e-5585a7bf67cc"];
    if (!sevMetadata) throw new Error("missing table entry");

    const offset_from_end = new DataView(sevMetadata).getInt32(0, true);
    const start = data.byteLength - offset_from_end;
    const header = OvmfSevMetadataHeader.unpack(data.slice(start));

    if (new Uint8Array(header.value("signature")).toHex() !== "41534556") throw new Error("Wrong SEV metadata signature");
    if (header.value("version") !== 1) throw new Error("Wrong SEV metadata version");

    const sections = [];

    const items = data.slice(start+ctype.size(OvmfSevMetadataHeader)).slice(0, header.value("size"));
    for (let i = 0; i < header.value("num_items"); i++) {
        const offset = i * ctype.size(OvmfSevMetadataSectionDesc);
        const item = OvmfSevMetadataSectionDesc.unpack(items.slice(offset));
        sections.push(item);
    }

    const gctx = new GCTX(new Uint8Array(GCTX.LD_SIZE).toHex());
    await gctx.update_normal_pages(0x100000000 - data.byteLength, new Uint8Array(data));
    return {
        ovmf_hash: gctx.ld().toHex(),
        sev_hashes: new DataView(sevHashes).getInt32(0, true),
        reset_eip: new DataView(resetEip).getInt32(0, true),
        sections: sections.map(x => {return {gpa: x.value("gpa"), size: x.value("size"), type: x.value("type")}}),
    }
}

async function ovmf_measure_tdx(table, data) {
    const metaEntry = table["e47a6535-984a-4798-865e-4685a7bf8ec2"];
    if (!metaEntry) throw new Error("missing table entry for TDX metadata offset");

    const fw = new Uint8Array(data);
    const view = new DataView(fw.buffer, fw.byteOffset, fw.byteLength);

    const metaOffsetFromEnd = new DataView(metaEntry).getUint32(metaEntry.byteLength - 4, true);
    const metaOff = fw.length - metaOffsetFromEnd;

    if (view.getUint32(metaOff, true) !== 0x46564454) throw new Error("invalid TDVF metadata descriptor"); // "TDVF"
    if (view.getUint32(metaOff + 8, true) !== 1) throw new Error("unsupported TDVF metadata version");

    const numSections = view.getUint32(metaOff + 12, true);
    const sections = [];

    for (let i = 0; i < numSections; i++) {
        const base = metaOff + 16 + 32 * i;
        sections.push({
            dataOffset: view.getUint32(base, true),
            rawDataSize: view.getUint32(base + 4, true),
            memoryAddress: Number(view.getBigUint64(base + 8, true)),
            memoryDataSize: Number(view.getBigUint64(base + 16, true)),
            secType: view.getUint32(base + 24, true),
            attributes: view.getUint32(base + 28, true),
        });
    }

    const chunks = [];
    const memPageAdd = new TextEncoder().encode("MEM.PAGE.ADD");
    const mrExtend = new TextEncoder().encode("MR.EXTEND");

    for (const s of sections) {
        for (let page = 0; page < s.memoryDataSize / 4096; page++) {
            const gpa = BigInt(s.memoryAddress + page * 4096);

            if (!(s.attributes & 0x2)) {
                const rec = new Uint8Array(128);
                rec.set(memPageAdd);
                new DataView(rec.buffer).setBigUint64(16, gpa, true);
                chunks.push(rec);
            }

            if (s.attributes & 0x1) {
                for (let chunk = 0; chunk < 16; chunk++) {
                    const caddr = gpa + BigInt(chunk * 256);
                    const rec = new Uint8Array(128);
                    rec.set(mrExtend);
                    new DataView(rec.buffer).setBigUint64(16, caddr, true);
                    chunks.push(rec);

                    const off = s.dataOffset + page * 4096 + chunk * 256;
                    chunks.push(fw.subarray(off, off + 256));
                }
            }
        }
    }

    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const stream = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
        stream.set(chunk, offset);
        offset += chunk.length;
    }

    const mrtd = (await sha384(stream)).toHex();
    return {
        ovmf_hash: mrtd,
        measurement: mrtd,
        sections: sections,
        data: data,
    };
}