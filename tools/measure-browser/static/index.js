"use strict";

import {measureVariables, ovmf_measure, snp_measure, tdx_measure} from "./measure.js";
import {authenticode, ctype, efiVariableName, encodeText, hexdump} from "./binutil.js";
import {verifyQuote, verifyReport} from "./verify.js";
import {SnpAttestation, TdxQuote, CcelEventLog} from "./types.js";

window.addEventListener("DOMContentLoaded", () => {
    async function hash(alg, buf) {
        const hashBuf = await crypto.subtle.digest(alg, buf);
        return new Uint8Array(hashBuf).toHex();
    }

    let target;
    let mode = "snp";

    const reset = () => {
        while (messages.firstChild) messages.removeChild(messages.firstChild);
    }
    const messages = document.getElementById("messages");
    const message = (msg, cls = null, prepend = null, container = messages) => {
        const pre = document.createElement("pre");
        if (prepend) {
            const span = document.createElement("span");
            span.appendChild(document.createTextNode(prepend));
            pre.appendChild(span);
        }
        pre.appendChild(document.createTextNode(msg));
        if (cls) pre.classList.add(cls);
        container.appendChild(pre);
        container.scrollTop = container.scrollHeight;
    }
    const detailed = (desc, open = false) => {
        const details = document.createElement("details");
        details.open = open;

        const summary = document.createElement("summary");
        summary.appendChild(document.createTextNode(desc));
        details.appendChild(summary);
        messages.appendChild(details);
        return details;
    }

    const form = document.getElementById("variables");

    document.getElementById("toggle").addEventListener("change", e => {
        document.getElementById(`shared-${mode}`).hidden = true;
        document.getElementById(`measure-${mode}`).hidden = true;

        mode = e.target.checked ? "tdx" : "snp";
        e.target.defaultChecked = e.target.checked;

        document.getElementById(`shared-${mode}`).hidden = false;
        document.getElementById(`measure-${mode}`).hidden = false;

        document.getElementById("measure-first").firstChild.data = mode === "snp" ? "OVMF" : "MRTD";

        document.getElementById("ccel").hidden = mode !== "tdx";
        form.reset();
    });
    form.addEventListener("reset", () => {
        target = null;
        form.elements["kernel"].value = "";
        form.elements["initrd"].value = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        form.elements["cmdline"].value = "8415315fdb250b9a97b0daf6f2649577b4a1f76a331f708df2ba2cc751003690";
        if (mode === "snp") form.elements["append"].defaultValue = "console=hvc0 quiet";
        if (mode === "tdx") form.elements["append"].defaultValue = "initrd=initrd console=ttyS0 quiet";
        reset();
        message("Waiting for input...");
    });
    form.reset();

    const zones = document.getElementsByClassName("dropzone");

    for (const zone of zones) {
        const inputs = zone.getElementsByTagName("input");

        zone.addEventListener("dragover", async e => {
            e.preventDefault();
        });

        zone.addEventListener("drop", async e => {
            e.preventDefault();
            inputs[0].files = e.dataTransfer.files;
            inputs[0].dispatchEvent(new Event("change"));
        });

        inputs[0].addEventListener("change", async e => {
            if (!e.target.files[0]) return;

            const buffer = await e.target.files[0].arrayBuffer();

            if (zone.id === "report") {
                verify(buffer);
                return;
            } else if (zone.id === "ccel") {
                await dump(buffer);
                return;
            }

            form.elements[`${inputs[1].name}-hash`].value = inputs[1].value = await hash("SHA-256", buffer);
            if (zone.id === "initrd" && mode === "tdx")
                form.elements[`${inputs[1].name}-tdx`].value = await hash("SHA-384", buffer);
            if (zone.id === "kernel" && mode === "tdx")
                form.elements[`${inputs[1].name}-tdx`].value = await hash("SHA-384", authenticode(buffer));

            if (zone.id === "bios") {
                target = await ovmf_measure(mode, buffer);
                form.elements["measure-ovmf"].value = target.ovmf_hash;
            }

            measure();
        });
    }

    form.elements["append"].addEventListener("input", async e => {
        const raw = new TextEncoder().encode(e.target.value);
        const cmdline = new Uint8Array(raw.length + 1);
        cmdline.set(raw);
        form.elements["cmdline"].value = await hash("SHA-256", cmdline);
        measure();
    })

    const inputs = form.getElementsByTagName("input");
    for (const input of inputs) {
        if (input.type === "file" || input.name === "append") continue;

        input.addEventListener("input", () => {
            measure();
        });
    }

    const selects = form.getElementsByTagName("select");
    for (const select of selects) {
        select.addEventListener("change", () => {
            measure();
        });
    }

    const measure = () => {
        const values = new FormData(form);
        const payload = Object.fromEntries(values);

        if (!target) return;
        if (mode === "snp" && !payload.kernel) return;
        if (mode === "tdx" && !payload.ovmf) return;

        switch (mode) {
            case "snp":
                snp_measure(payload, target).then(measurement => {
                    target.measurement = measurement.toHex();
                    form.elements["measure-attest"].value = measurement.toHex();
                });
                break;
            case "tdx":
                tdx_measure(payload, target).then(measurement => {
                    target.measurement = measurement
                    form.elements["measure-rtmr0"].value = measurement.rtmr0.toHex();
                    form.elements["measure-rtmr1"].value = measurement.rtmr1.toHex();
                    form.elements["measure-rtmr2"].value = measurement.rtmr2.toHex();
                })
                break;
            default:
                throw new Error("invalid mode");
        }
    }

    const verify = data => {
        reset();

        switch (mode) {
            case "snp":
                let raw = data.slice(0, ctype.size(SnpAttestation));
                const attestation = SnpAttestation.unpack(raw);
                if (attestation.pack().toBase64() !== new Uint8Array(raw).toBase64()) throw new Error("binary parser is broken");

                verifyReport(attestation, message).then(() => {
                    const receivedMeasurement = attestation.value("measurement").toHex();
                    if (receivedMeasurement !== target?.measurement) throw new Error(`wrong measurement: ${receivedMeasurement}`);

                    message(`Verification complete: ${receivedMeasurement}`);
                }).catch(err => {
                    message(`Verification failed: ${err}`);
                });
                break;
            case "tdx":
                const quote = TdxQuote.unpack(data);
                let packed = quote.pack();
                if (packed.toBase64() !== new Uint8Array(data.slice(0, packed.length)).toBase64()) throw new Error("binary parser is broken");

                verifyQuote(quote, message).then(() => {
                    message("Dumping all RTMRs...");
                    message(quote.body.value("rtmr0").toHex(), "state", "RTMR0: ", );
                    message(quote.body.value("rtmr1").toHex(), "state", "RTMR1: ", );
                    message(quote.body.value("rtmr2").toHex(), "state", "RTMR2: ", );
                    message(quote.body.value("rtmr3").toHex(), "state", "RTMR3: ", );

                    const receivedMeasurement = quote.body.value("mr_td").toHex();
                    if (receivedMeasurement !== target?.ovmf_hash) throw new Error(`wrong measurement: ${receivedMeasurement}`);

                    message(`Verification complete: ${receivedMeasurement}`);
                }).catch(err => {
                    message(`Verification failed: ${err}`);
                });
                break;
            default:
                throw new Error("invalid mode");
        }
    }

    const dump = async data => {
        reset();

        if (mode !== "tdx") {
            message(`CCEL is unsupported in SNP mode`);
            return;
        }

        const log = CcelEventLog.unpack(data);
        const packed = log.pack();
        if (packed.toBase64() !== new Uint8Array(data.slice(0, packed.length)).toBase64()) throw new Error("binary parser is broken");

        message(`CCEL with ${log.events.length} events, signature:`);
        message(hexdump(log.spec.specHeader.value("signature")), "hexdump");

        const variables = await measureVariables();

        const sha384 = async data => new Uint8Array(await crypto.subtle.digest("SHA-384", data));
        const extend = async (pcr, val) => {
            const buf = new Uint8Array(pcr.length + val.length);
            buf.set(pcr, 0);
            buf.set(val, pcr.length);
            return await sha384(buf);
        };
        const state = {
            rtmr0: new Uint8Array(48),
            rtmr1: new Uint8Array(48),
            rtmr2: new Uint8Array(48),
            rtmr3: new Uint8Array(48),
        }

        for (const event of log.events) {
            message("\n");

            const digest = event.digests.find(x => x.algorithm_id === 12).digest.toHex();
            message(digest, "event", `${event.eventType}: `);

            state["rtmr" + event.rtmr] = await extend(state["rtmr" + event.rtmr], Uint8Array.fromHex(digest));
            message(state["rtmr" + event.rtmr].toHex(), "state", `RTMR${event.rtmr}: `);

            let skip = false;
            switch (event.eventType) {
                case "EV_SEPARATOR": if (digest === target?.measurement?.sep) skip = true; break;
                case "EV_EFI_HANDOFF_TABLES2": if (digest === target?.measurement?.hob) skip = true; break;
                case "EV_EFI_PLATFORM_FIRMWARE_BLOB2": if (digest === target?.measurement?.cfv) skip = true; break;
                case "EV_EFI_BOOT_SERVICES_APPLICATION": if (digest === target?.measurement?.kernel) skip = true; break;
                case "EV_EFI_ACTION": if (digest === await hash('SHA-384', event.event_data)) skip = true; break;
                case "EV_EVENT_TAG":
                    let blob = new TextDecoder().decode(event.event_data.slice(8)).split("\x00")[0];
                    switch (blob) {
                        case "LOADED_IMAGE::LoadOptions": if (digest === target?.measurement?.cmd) skip = true; break;
                        case "Linux initrd": if (digest === target?.measurement?.initrd) skip = true; break;
                        default: console.log(blob, digest);
                    } break;
                case "EV_EFI_VARIABLE_DRIVER_CONFIG":
                    let name = efiVariableName(event.event_data);
                    switch (name) {
                        case "SecureBoot": if (digest === await hash('SHA-384', variables.secureBoot)) skip = true; break;
                        case "PK": if (digest === await hash('SHA-384', variables.pk)) skip = true; break;
                        case "KEK": if (digest === await hash('SHA-384', variables.kek)) skip = true; break;
                        case "db": if (digest === await hash('SHA-384', variables.db)) skip = true; break;
                        case "dbx": if (digest === await hash('SHA-384', variables.dbx)) skip = true; break;
                        default: console.log(name, digest);
                    } break;
                case "EV_PLATFORM_CONFIG_FLAGS":
                    let [type, desc] = new TextDecoder().decode(event.event_data).split('\x00');
                    switch (type) {
                        case "QEMU FW CFG":
                            switch (desc) {
                                case "Signature": if (digest === await hash('SHA-384', encodeText("QEMU"))) skip = true; break;
                                case "InterfaceVersion": if (digest === await hash('SHA-384', Uint8Array.fromHex("03000000"))) skip = true; break;
                                default: console.log(type, desc);
                            } break;
                        case "ACPI DATA": break;
                        default: console.log(type, desc);
                    } break;
            }
            message(hexdump(event.event_data), "hexdump", null, detailed("Event Data", !skip));
        }

        message("\n");
        message("Dumping all RTMRs...");
        message(state.rtmr0.toHex(), "state", "RTMR0: ", );
        message(state.rtmr1.toHex(), "state", "RTMR1: ", );
        message(state.rtmr2.toHex(), "state", "RTMR2: ", );
        message(state.rtmr3.toHex(), "state", "RTMR3: ", );
    }
});