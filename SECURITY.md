# Security Policy

## Supported Versions

Security fixes are generally provided for the latest supported Sylica release.

| Version              | Supported   |
|----------------------|-------------|
| Latest release       | Yes         |
| Older releases       | Best effort |
| Development branches | Best effort |

Users are encouraged to upgrade to the latest supported release before reporting an issue.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, pull requests, or discussions.**

Sylica is confidential VM firmware. Security vulnerabilities may affect the trusted computing base, firmware
measurements, remote attestation, or the confidentiality guarantees of protected workloads. Public disclosure before a
coordinated response may therefore expose users to unnecessary risk.

Please report vulnerabilities privately through the repository's **GitHub Private Vulnerability Reporting** mechanism.

On GitHub, use:

**Security → Advisories → Report a vulnerability**

If Private Vulnerability Reporting is unavailable, contact the Sylica security maintainers through the private security contact published by the project.

## What to Include

Please provide enough information for us to understand and reproduce the issue.

Where applicable, include:

* affected Sylica version or commit;
* affected platform;
* CPU and confidential-computing technology;
* Intel TDX, AMD SEV-SNP or ARM CCA configuration;
* firmware configuration;
* affected component;
* description of the vulnerability;
* security impact;
* reproduction steps;
* proof of concept, if available;
* relevant logs or measurements;
* whether the issue affects remote attestation;
* whether the issue affects the Sylica TCB;
* whether the issue changes or invalidates expected measurements;
* any suggested mitigation.

Please do not include secrets, private keys, customer data, credentials, or other unrelated sensitive information.

## Security-Sensitive Areas

Particular attention should be given to vulnerabilities affecting:

* secure boot;
* measured boot;
* Intel TDX;
* AMD SEV-SNP;
* ARM CCA
* firmware measurements;
* remote attestation;
* memory isolation;
* page validation;
* hypervisor/guest isolation;
* cryptographic operations;
* key handling;
* secret provisioning;
* firmware update mechanisms;
* platform configuration;
* the Sylica TCB;
* reproducible-build guarantees.

A vulnerability in any of these areas may have consequences beyond the affected component.

## Coordinated Disclosure

Sylica maintainers will work with the reporter to understand, validate, and remediate reported vulnerabilities.

Where appropriate, the project may:

1. acknowledge receipt of the report;
2. validate and reproduce the vulnerability;
3. assess affected versions and platforms;
4. determine the security severity;
5. develop and test a remediation;
6. coordinate disclosure with the reporter;
7. publish a security advisory;
8. release a patched version where necessary.

We ask security researchers to allow reasonable time for investigation and remediation before publicly disclosing vulnerability details.

The project may coordinate disclosure timing with affected upstream projects, hardware vendors, cloud providers, or other parties when the vulnerability crosses project boundaries.

## Severity

Severity is assessed based on the actual security impact and exploitability.

Particular consideration is given to vulnerabilities that could:

* compromise confidential VM isolation;
* allow a malicious host or hypervisor to access protected guest state;
* compromise the integrity of the firmware trust chain;
* manipulate security-relevant measurements;
* undermine remote attestation;
* cause unauthorised key or secret release;
* expand the trusted computing base unexpectedly;
* bypass security boundaries relied upon by Sylica.

A CVSS score may be used as an additional reference, but it does not replace project-specific security analysis.

## Security Advisories

Confirmed vulnerabilities may be published through GitHub Security Advisories.

Security advisories may include:

* affected versions;
* affected platforms;
* severity;
* impact;
* mitigations;
* patched versions;
* acknowledgements;
* references to relevant upstream advisories.

Exploit details will be disclosed only when appropriate.

## Supply Chain and Build Security

Sylica places particular importance on firmware provenance and reproducibility.

Security reports concerning:

* compromised build dependencies;
* malicious toolchain components;
* reproducibility failures with security implications;
* unexpected firmware measurements;
* compromised release artefacts;
* build-system injection;
* dependency substitution;

should be reported privately when they could affect the integrity or authenticity of Sylica releases.

## Security Research

Good-faith security research is welcomed.

Researchers should:

* avoid unnecessary disruption;
* avoid accessing or modifying data belonging to others;
* avoid degrading availability of systems;
* avoid social engineering;
* stop testing when sensitive information is encountered;
* report vulnerabilities privately;
* allow reasonable time for remediation.

Testing against systems that you do not own or have explicit permission to test is outside the scope of this policy.

## Safe Harbour

Sylica maintainers will not pursue legal action against security researchers for good-faith security research that:

* follows this security policy;
* is performed without malicious intent;
* avoids unnecessary harm;
* does not intentionally compromise or exfiltrate data;
* does not publicly disclose a vulnerability before reasonable coordination with the project.

This safe-harbour statement does not authorise testing of third-party systems or override applicable law.

## Contact

For security vulnerabilities, use:

**GitHub → Security → Advisories → Report a vulnerability**

For general security questions that do not contain vulnerability details, use the project's normal communication channels.

## Acknowledgements

Sylica may publicly acknowledge security researchers who responsibly report vulnerabilities, unless they request anonymity.

Thank you for helping make Sylica more secure.
