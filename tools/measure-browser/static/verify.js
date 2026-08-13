import * as pkijs from "pkijs";

const kdsBaseUrl = "https://kdsintf.amd.com/"
const productBaseUrl = (signer, product) => `${signer.toLowerCase()}/v1/${product}`;

const data = {};

async function kdsCache(message, path) {
    if (data[path]) {
        message(`Using cached ${path}`, "fetching");
        return data[path];
    }
    message(`Fetching ${path}`, "fetching");
    const res = await fetch(path);
    data[path] = await res.arrayBuffer();
    return data[path];
}

function parsePem(pem) {
    return Uint8Array.fromBase64(pem
        .replace(/-----BEGIN CERTIFICATE-----/, "")
        .replace(/-----END CERTIFICATE-----/, "")
        .replace(/\s/g, ""));
}

export async function verifyReport(attestation, message = console.info) {
    if (attestation.value("version") !== 3) throw new Error(`unsupported version ${attestation.value("version")}`);
    if (attestation.value("signature_algorithm") !== 1) throw new Error(`unsupported signature algorithm ${attestation.value("signature_algorithm")}`);

    const signer = attestation.value("flags").value("signing_key");
    if (signer !== "VCEK") throw new Error(`unsupported signer ${signer}`);

    const product = attestation.value("cpuid").product();
    if (product !== "Milan" && product !== "Genoa" && product !== "Turin") throw new Error(`unsupported product ${product}`);

    const baseUrl = productBaseUrl(signer, product);
    message(`Verifying SNP Report (v${attestation.value("version")}, ${product}, ${signer})`);

    const chainUrl = `${baseUrl}/cert_chain`;
    const chainRaw = await kdsCache(message, new URL(chainUrl, kdsBaseUrl));
    const [askRaw, arkRaw] = new TextDecoder().decode(chainRaw).split("-----BEGIN CERTIFICATE-----").slice(1).map(parsePem);
    const ark = pkijs.Certificate.fromBER(arkRaw);
    const ask = pkijs.Certificate.fromBER(askRaw);
    if (!await ask.verify(ark)) throw new Error('could not verify ASK with ARK');

    message(`Root certificate valid`, 'success', '✔ ');

    const crlUrl = `${baseUrl}/crl`;
    const crlRaw = await kdsCache(message, new URL(crlUrl, kdsBaseUrl));
    const crl = pkijs.CertificateRevocationList.fromBER(crlRaw);
    if (!await crl.verify({issuerCertificate: ark})) throw new Error('could not verify CRL with ARK');
    if (await crl.isCertificateRevoked(ask)) throw new Error('ASK has been revoked');
    if (crl.thisUpdate.value.getTime() > Date.now() || crl.nextUpdate.value.getTime() < Date.now()) throw new Error('CRL is not valid');

    message(`Chain not revoked`, 'success', '✔ ');

    const vcekUrl = `${baseUrl}/${attestation.value("chip_id").toHex()}`+
        `?blSPL=${attestation.value("reported_tcb").value("bootloader")}`+
        `&teeSPL=${attestation.value("reported_tcb").value("tee")}`+
        `&snpSPL=${attestation.value("reported_tcb").value("snp")}`+
        `&ucodeSPL=${attestation.value("reported_tcb").value("microcode")}`;
    const vcekRaw = await kdsCache(message, new URL(vcekUrl, kdsBaseUrl));
    const vcek = pkijs.Certificate.fromBER(vcekRaw);
    if (!await vcek.verify(ask)) throw new Error('could not verify VCEK with ASK');

    message(`VCEK is trusted`, 'success', '✔ ');

    const key = await vcek.getPublicKey({
        'algorithm': {
            'algorithm': {'name': 'ECDSA', 'namedCurve': 'P-384', 'hash': 'SHA-384'},
            'usages': ['verify']
        }
    })

    const signature = new Uint8Array(96);
    signature.set(attestation.value("signature").value("r").slice(0, 48).reverse(),  0);
    signature.set(attestation.value("signature").value("s").slice(0, 48).reverse(), 48);

    const verified = await crypto.subtle.verify(
        {name: 'ECDSA', hash: 'SHA-384'}, key,
        signature, attestation.raw_report
    );
    if (!verified) throw new Error('could not verify report data with vcek');

    message(`Signature verified`, 'success', '✔ ');

    return attestation;
}

export function extractCertsFromPemChain(certChainRaw) {
    const text = typeof certChainRaw === "string"
        ? certChainRaw
        : new TextDecoder().decode(certChainRaw);

    const pemBlocks = text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
    if (!pemBlocks || pemBlocks.length === 0) {
        throw new Error("No PEM certificates found in pckCertChainRaw");
    }

    return pemBlocks.map(pem => {
        const bytes = parsePem(pem);
        const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        return pkijs.Certificate.fromBER(buffer);
    });
}

export async function verifyQuote(quote, message = console.info) {
    if (quote.header.value("version") !== 4 && quote.header.value("version") !== 5) throw new Error(`Unsupported Quote version: ${quote.header.value("version")}`);
    if (quote.header.value("tee_type") !== 0x00000081) throw new Error(`Unsupported TEE type: 0x${quote.header.value("tee_type").toString(16)} (expected TDX 0x81)`);
    if (quote.header.value("attestation_key_type") !== 2) throw new Error(`Unsupported Attestation Key Type: ${quote.header.value("attestation_key_type")} (expected 2 for ECDSA-P256)`);

    message(`Verifying TDX Quote (v${quote.header.value("version")})`);

    const attestationKey = new Uint8Array(65);
    attestationKey[0] = 0x04; // Uncompressed point header
    attestationKey.set(quote.sigData.value("attestation_key").value("x"), 1);
    attestationKey.set(quote.sigData.value("attestation_key").value("y"), 33);

    const attPubKey = await crypto.subtle.importKey(
        "raw", attestationKey,
        { name: "ECDSA", namedCurve: "P-256" },
        true, ["verify"]
    );

    const quoteSignature = new Uint8Array(64);
    quoteSignature.set(quote.sigData.value("signature").value("r"),  0);
    quoteSignature.set(quote.sigData.value("signature").value("s"), 32);

    const verified = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" }, attPubKey,
        quoteSignature, quote.rawReportForSignature
    );
    if (!verified) throw new Error("Quote signature verification failed");

    message("Signature verified", 'success', '✔ ');

    if (quote.certHeader.value("type") !== 6) throw new Error(`Unsupported certification type: ${quote.certHeader.value("type")}`);

    const hashInput = new Uint8Array(64 + quote.qeAuthData.length);
    hashInput.set(attestationKey.slice(1), 0);
    hashInput.set(quote.qeAuthData, 64);

    const expectedHash = new Uint8Array(await crypto.subtle.digest("SHA-256", hashInput)).toHex();
    const actualHash = quote.qeCertData.value("qe_report").value("report_data").slice(0, 32).toHex();
    if (expectedHash !== actualHash) throw new Error(`QE report_data hash mismatch: ${expectedHash} != ${actualHash}`);

    message("QE binding verified", 'success', '✔ ');

    const pck = await verifyPckCertChain(quote.pckCertChainRaw, message);
    const pckPubKey = await pck.getPublicKey({
        'algorithm': {
            'algorithm': {'name': 'ECDSA', 'namedCurve': 'P-256', 'hash': 'SHA-256'},
            'usages': ['verify']
        }
    })

    const qeSig = new Uint8Array(64);
    qeSig.set(quote.qeCertData.value("qe_report_signature").value("r"),  0);
    qeSig.set(quote.qeCertData.value("qe_report_signature").value("s"), 32);

    const isQeSigValid = await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" }, pckPubKey,
        qeSig, quote.rawQeReportBytes
    );
    if (!isQeSigValid) throw new Error("QE report signature verification failed against PCK public key");

    message("QE signature verified", 'success', '✔ ');

    return quote;
}

export async function verifyPckCertChain(pckCertChainRaw, message) {
    const certs = extractCertsFromPemChain(pckCertChainRaw);
    if (certs.length === 0) throw new Error("Empty certificate chain");

    const leafCert = certs[0];
    const rootCert = certs[certs.length - 1];

    const hash = await crypto.subtle.digest("SHA-256", rootCert.toSchema().toBER(false));
    const digest = new Uint8Array(hash).toHex();
    if (digest !== "44a0196b2b99f889b8e149e95b807a350e7424964399e885a7cbb8ccfab674d3") throw new Error(`root cert digest mismatch: ${digest}`);

    const chainEngine = new pkijs.CertificateChainValidationEngine({
        certs: certs.slice(0, certs.length - 1),
        trustedCerts: [rootCert],
        checkDate: new Date()
    });
    const validation = await chainEngine.verify();
    if (!validation.result) throw new Error(`PCK Cert Chain verification failed: ${validation.resultMessage}`);

    return leafCert;
}