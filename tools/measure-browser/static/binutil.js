const SIZES = { u8: 8, u16: 16, u32: 32, u64: 64, bool: 0 };

const safe = (value, type, size) => {
    if (size !== undefined) {
        return value.size ? value.size() === size : true;
    } else if (type === "bool") {
        return typeof value === "boolean";
    } else if (typeof type === "string") {
        return BigInt(value) < (1n << BigInt(SIZES[type]));
    } else if (ctype.isPrototypeOf(type)) {
        return ctype.size(value.constructor) === ctype.size(type);
    } else {
        throw new Error("invalid type");
    }
}

const size = (type, size) => {
    if (size !== undefined) {
        return size * 8;
    } else if (typeof type === "string") {
        if (!Object.keys(SIZES).includes(type)) throw new Error("invalid type");
        return SIZES[type];
    } else if (ctype.isPrototypeOf(type)) {
        return ctype.size(type) * 8;
    } else {
        throw new Error("invalid type");
    }
}

export class ctype {
    static FIELDS = [];
    data = {};
    set(name, value) {
        for (const field of this.constructor.FIELDS) {
            if (field.name === name) {
                if (!safe(value, field.type, field.size)) throw new Error("invalid value");
                this.data[name] = value;
                return;
            }
        }
    }
    pack() {
        const buffer = new ArrayBuffer(ctype.size(this.constructor));
        const array = new Uint8Array(buffer);
        const view = new DataView(array.buffer);
        let offset = 0;
        for (const field of this.constructor.FIELDS) {
            switch (field.type) {
                case "u8":
                    view.setUint8(offset, this.value(field.name));
                    offset += 1;
                    break;
                case "u16":
                    view.setUint16(offset, this.value(field.name), true);
                    offset += 2;
                    break;
                case "u32":
                    view.setUint32(offset, this.value(field.name), true);
                    offset += 4;
                    break;
                case "u64":
                    view.setBigUint64(offset, BigInt(this.value(field.name)??0), true);
                    offset += 8;
                    break;
                case "bool":
                    break;
                case undefined:
                    if (this.data[field.name] === undefined) array.set(new Uint8Array(field.size), offset);
                    else array.set(this.data[field.name], offset);
                    offset += field.size;
                    break;
                case "custom":
                    array.set(this.value(field.name), offset);
                    offset += field.size;
                    break;
                default:
                    if (this.data[field.name] === undefined) throw new Error(`missing field ${field.name}`);
                    array.set(this.data[field.name].pack(), offset);
                    offset += ctype.size(this.data[field.name].constructor);
                    break;
            }
        }
        return new Uint8Array(buffer);
    }
    value(field) {
        return this.data[field];
    }
    static unpack(buffer) {
        const out = new this();
        const view = new DataView(buffer);
        let offset = 0;
        for (const field of this.FIELDS) {
            switch (field.type) {
                case "u8":
                    out.set(field.name, view.getUint8(offset));
                    offset += 1;
                    break;
                case "u16":
                    out.set(field.name, view.getUint16(offset, true));
                    offset += 2;
                    break;
                case "u32":
                    out.set(field.name, view.getUint32(offset, true));
                    offset += 4;
                    break;
                case "u64":
                    out.set(field.name, view.getBigUint64(offset, true));
                    offset += 8;
                    break;
                case "bool":
                    out.set(field.name, ctype.flag(view.getUint8(offset), field.index));
                    break;
                case undefined:
                    const data = new Uint8Array(field.size);
                    for (let i = 0; i < field.size; i++) {
                        data[i] = view.getUint8(offset + i);
                    }
                    out.set(field.name, data);
                    offset += field.size;
                    break;
                case "custom":
                    if (field.size === 0) out.set(field.name, view);
                    else out.set(field.name, view.buffer.slice(offset).slice(0, field.size));
                    offset += field.size;
                    break;
                default:
                    const size = ctype.size(field.type);
                    const value = field.type.unpack(buffer.slice(offset, offset + size));
                    out.set(field.name, value);
                    offset += size;
                    break;
            }
        }
        return out;
    }
    static size(type) {
        let bits = 0;
        for (const field of type.FIELDS) {
            bits += size(field.type, field.size);
        }
        if (bits % 8 !== 0) throw new Error("invalid size");
        return bits / 8;
    }
    static flag(data, index) {
        return (data & (1 << index)) !== 0;
    }
}

export function hexdump(data, width = 16) {
    const lines = [];

    for (let offset = 0; offset < data.length; offset += width) {
        const chunk = data.subarray(offset, offset + width);
        const addr = offset.toString(16).padStart(8, '0');

        const hex = [];
        for (let i = 0; i < width; i += 2) {
            if (i + 1 >= chunk.length) hex.push("    ");
            else hex.push(`${chunk[i].toString(16).padStart(2, '0')}${chunk[i+1].toString(16).padStart(2, '0')}`);
        }

        let ascii = '';
        for (let i = 0; i < chunk.length; i++) {
            const byte = chunk[i];
            ascii += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
        }

        lines.push(`${addr}: ${hex.join(' ')} |${ascii}|`);
    }

    return lines.join('\n');
}

export function encodeText(value) {
    const raw = new TextEncoder().encode(value);
    const array = new Uint8Array(raw.length);
    array.set(raw);
    return array;
}
export function encodeUtf16LE(str) {
    const buf = new Uint8Array(str.length * 2);
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        buf[i * 2] = code & 0xff;
        buf[i * 2 + 1] = (code >> 8) & 0xff;
    }
    return buf;
}
export function efiVariable(uuid, name, data) {
    const nameBuf = encodeUtf16LE(name);
    const dataBuf = new Uint8Array(data);
    const result = new Uint8Array(16 + 8 + 8 + nameBuf.byteLength + dataBuf.byteLength);
    const view = new DataView(result.buffer);
    result.set(uuid, 0); // GUID LE (16 bytes)
    view.setBigUint64(16, BigInt(name.length), true); // Name size (<Q - uint64 LE)
    view.setBigUint64(24, BigInt(dataBuf.byteLength), true); // Data length (<Q - uint64 LE)
    result.set(nameBuf, 32); // UTF-16LE encoded name
    result.set(dataBuf, 32 + nameBuf.byteLength); // Raw data
    return result;
}
export function efiVariableName(data) {
    const view = new DataView(data.buffer);
    const charCount = Number(view.getBigUint64(16, true));
    const nameBytes = data.slice(32, 32 + charCount * 2);
    return new TextDecoder('utf-16le').decode(nameBytes);
}

export function authenticode(buffer) {
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);
    if (view.getUint16(0, true) !== 0x5A4D) throw new Error('Invalid PE file: Missing MZ header');

    const peOffset = view.getUint32(0x3C, true);
    if (view.getUint32(peOffset, true) !== 0x00004550) throw new Error('Invalid PE file: Missing PE signature');

    const numberOfSections = view.getUint16(peOffset + 6, true);
    const sizeOfOptionalHeader = view.getUint16(peOffset + 20, true);
    const optionalHeaderOffset = peOffset + 24;

    // Magic 0x010B = PE32 (32-bit), 0x020B = PE32+ (64-bit)
    const magic = view.getUint16(optionalHeaderOffset, true);
    const isPE32Plus = magic === 0x020B;

    // Offsets to exclude during header hashing
    const sizeOfHeaders = view.getUint32(optionalHeaderOffset + 60, true);
    const checksumOffset = optionalHeaderOffset + 64;
    const securityDirOffset = optionalHeaderOffset + (isPE32Plus ? 144 : 128);
    const certAddress = view.getUint32(securityDirOffset, true);

    const chunks = [];

    // Header Chunks
    chunks.push(u8.subarray(0, checksumOffset));
    chunks.push(u8.subarray(checksumOffset + 4, securityDirOffset));
    chunks.push(u8.subarray(securityDirOffset + 8, sizeOfHeaders));

    // Parse and sort sections by physical offset
    const sectionsOffset = optionalHeaderOffset + sizeOfOptionalHeader;
    const sections = [];
    for (let i = 0; i < numberOfSections; i++) {
        const headerPos = sectionsOffset + i * 40;
        const rawSize = view.getUint32(headerPos + 16, true);
        const rawPointer = view.getUint32(headerPos + 20, true);
        if (rawSize > 0) sections.push({pointer: rawPointer, size: rawSize});
    }
    sections.sort((a, b) => a.pointer - b.pointer);

    // Section Chunks
    let pos = sizeOfHeaders;
    for (const sec of sections) {
        chunks.push(u8.subarray(sec.pointer, sec.pointer + sec.size));
        pos = Math.max(pos, sec.pointer + sec.size);
    }

    // Trailing/Overlay Data
    const limit = (certAddress > 0 && certAddress < u8.length) ? certAddress : u8.length;
    if (limit > pos) chunks.push(u8.subarray(pos, limit));

    const totalSize = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combinedBuffer = new Uint8Array(totalSize);
    let currentOffset = 0;
    for (const chunk of chunks) {
        combinedBuffer.set(chunk, currentOffset);
        currentOffset += chunk.length;
    }
    return combinedBuffer;
}