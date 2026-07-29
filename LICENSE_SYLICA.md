# Non-Functional Source License 1.0 — Sylica Additional License Terms

**NFSL-1.0-ALv2-Sylica**

Copyright © 2026 enclaive GmbH and contributors.

Sylica is licensed under the Non-Functional Source License 1.0, subject to the additional terms set forth below.

These Additional License Terms are intended to define the permitted and prohibited uses of Sylica as a virtual machine firmware platform.

## 1. Definitions

### 1.1 Sylica

“Sylica” means the original software authored by the Licensor and distributed as part of the Sylica project. Sylica does not include third-party software distributed under separate licence terms, including but not limited to edk2 and other third-party dependencies.

### 1.2 Sylica-Derived Work

“Sylica-Derived Work” means any work based upon, incorporating, modifying, or otherwise derived from Sylica or a substantial portion of Sylica, including modified firmware, firmware images, forks, and derivative firmware implementations.

### 1.3 Production Environment

“Production Environment” means an environment used to operate live workloads, applications, services, or infrastructure for an organisation's operational, business, or revenue-generating activities, as opposed to development, testing, evaluation, research, or educational activities.

### 1.4 Commercial Production Use

“Commercial Production Use” means use of Sylica or a Sylica-Derived Work by or on behalf of an organisation in a Production Environment in connection with that organisation's commercial, operational, business, or revenue-generating activities.

Commercial Production Use includes internal use. The fact that Sylica is operated exclusively on an organisation's own infrastructure, and is not provided to external customers, does not by itself make the use non-commercial.

### 1.5 Competing Use

“Competing Use” means any Commercial Production Use, distribution, integration, provision, or commercial exploitation of Sylica or a Sylica-Derived Work that provides, enables, supports, or forms part of a commercial virtualization, cloud computing, infrastructure, firmware, hardware, or platform offering.

Without limiting the foregoing, Competing Use includes the activities described in Section 3.

### 1.6 Commercial Agreement

“Commercial Agreement” means a separate written agreement with the Licensor authorising one or more uses that would otherwise constitute Commercial Production Use or Competing Use.

---

## 2. Additional Restriction

In addition to the restrictions contained in the Non-Functional Source License 1.0, you may not engage in **Commercial Production Use** or **Competing Use** of Sylica or a Sylica-Derived Work unless you have obtained the applicable rights under a Commercial Agreement with the Licensor.

The absence of a fee charged directly for Sylica does not by itself make a use non-commercial.

For the avoidance of doubt, an organisation does not avoid this restriction merely because it:

* operates Sylica only on its own infrastructure;
* uses Sylica only for its own workloads;
* does not distribute Sylica to customers;
* does not charge customers separately for Sylica; or
* uses Sylica as one component of a larger system.

---

## 3. Competing Uses

Without limiting the definition of Competing Use, the following activities require a Commercial Agreement.

### 3.1 Commercial Cloud and Infrastructure Services

Using Sylica or a Sylica-Derived Work as part of a commercial service providing computing or infrastructure capabilities to third parties, including:

* public cloud computing;
* infrastructure-as-a-service;
* virtual machine hosting;
* confidential computing services;
* managed virtualization;
* managed Kubernetes or container infrastructure;
* hosted private cloud;
* edge computing services;
* bare-metal or virtualized infrastructure services.

This applies whether Sylica is visible to the customer or operates solely as an underlying infrastructure component.

### 3.2 Commercial Virtualization Platforms

Using Sylica or a Sylica-Derived Work as part of a commercial:

* hypervisor;
* virtualization platform;
* VM management platform;
* cloud operating system;
* infrastructure platform;
* confidential computing platform; or
* software-defined infrastructure product.

### 3.3 Commercial Hardware Integration

Embedding, bundling, pre-installing, or otherwise incorporating Sylica or a Sylica-Derived Work into a commercially distributed:

* server;
* workstation;
* appliance;
* computing platform;
* motherboard;
* processor platform;
* accelerator platform;
* BIOS or UEFI implementation;
* BMC or platform management firmware;
* virtualisation appliance; or
* other computing hardware or firmware product.

A hardware vendor's distribution of Sylica as part of a commercial hardware product constitutes Competing Use even where the hardware vendor does not separately charge for Sylica.

### 3.4 Distribution of Production Firmware

Distributing, making available, or supplying a Sylica-Derived Work as a production firmware image or production firmware component for commercial deployment.

This includes:

* signed firmware images;
* commercially supported firmware builds;
* OEM firmware packages;
* production firmware repositories;
* firmware update channels; and
* firmware images distributed to commercial customers.

### 3.5 Commercial Forks

Maintaining, distributing, or commercially exploiting a fork or Sylica-Derived Work that is intended to provide substantially similar VM firmware or infrastructure functionality.

This includes:

* commercial forks;
* proprietary derivatives;
* independently branded Sylica-based firmware;
* commercially supported Sylica derivatives; and
* commercial products substantially based on Sylica.

### 3.6 Managed Services and Infrastructure Operations

Operating Sylica as part of a managed service, infrastructure outsourcing arrangement, or other service in which a provider operates virtualisation or computing infrastructure on behalf of another organisation for commercial consideration.

---

## 4. Permitted Uses Without a Commercial Agreement

The following uses are permitted without a Commercial Agreement, provided that they do not otherwise constitute Commercial Production Use or Competing Use.

### 4.1 Security Research

You may:

* inspect Sylica source code;
* analyse its security properties;
* conduct vulnerability research;
* perform security testing;
* investigate vulnerabilities;
* develop security proofs or analyses; and
* publish security findings.

### 4.2 Auditing and Verification

You may:

* audit Sylica;
* inspect its implementation;
* verify build processes;
* reproduce builds;
* analyse firmware measurements;
* verify secure boot behaviour;
* verify attestation behaviour; and
* independently assess Sylica's security properties.

### 4.3 Development and Testing

You may use, modify, build, and test Sylica for:

* software development;
* firmware development;
* integration testing;
* interoperability testing;
* automated testing;
* continuous integration;
* development environments; and
* non-production test environments.

### 4.4 Internal Evaluation

You may evaluate Sylica internally for the purpose of determining whether to adopt, purchase, integrate, or license Sylica.

Evaluation may include proof-of-concept deployments and pilot environments, provided that such use is not used to operate production workloads or provide production services.

### 4.5 Academic and Educational Use

You may use Sylica for:

* academic research;
* university research;
* teaching;
* educational exercises;
* scientific publications; and
* non-commercial experimentation.

### 4.6 Personal and Non-Commercial Use

You may use Sylica for personal, hobbyist, and other genuinely non-commercial purposes.

---

## 5. Enterprise Production Deployment

A commercial organisation may not deploy Sylica in a Production Environment for its own internal workloads without a Commercial Agreement.

For clarity, the following constitute Commercial Production Use and therefore require a Commercial Agreement:

* a bank operating production virtual machines using Sylica;
* a hospital operating production workloads using Sylica;
* a manufacturer operating its production systems using Sylica;
* an enterprise operating a production private cloud using Sylica; and
* a company using Sylica as part of its production application infrastructure.

The fact that the organisation owns and operates the infrastructure itself does not exempt that use from the requirement for a Commercial Agreement.

---

## 6. Customer Deployment

A customer may deploy Sylica in a Production Environment under the terms of a Commercial Agreement.

A Commercial Agreement may authorise, as applicable:

* internal production deployment;
* production VM workloads;
* private cloud deployment;
* confidential computing deployment;
* commercial redistribution;
* OEM integration;
* cloud service operation;
* managed service operation;
* hardware integration;
* firmware distribution; or
* other specified commercial uses.

The scope of rights granted to one customer or partner does not imply or grant rights to any other party.

---

## 7. Separation of Evaluation and Production Use

Evaluation, research, and testing rights do not grant production deployment rights.

A party may therefore:

1. download Sylica;
2. inspect and audit the source;
3. build Sylica;
4. test Sylica;
5. deploy Sylica in a non-production evaluation environment; and
6. determine whether to enter into a Commercial Agreement.

Those activities do not themselves grant a right to use Sylica in a Production Environment.

---

## 8. No Circumvention

You may not structure, rename, separate, outsource, or otherwise arrange an activity for the principal purpose of avoiding the restrictions on Commercial Production Use or Competing Use.

In particular, an activity does not cease to constitute Commercial Production Use merely because Sylica is:

* embedded in another product;
* used indirectly by an application;
* operated by a subsidiary or affiliate;
* operated by a contractor;
* incorporated into a larger infrastructure platform; or
* provided without a separately itemised Sylica charge.

---

## 9. Affiliates and Contractors

For purposes of determining whether use is permitted, an organisation includes entities that it controls, entities under common control with it, and contractors acting on its behalf where Sylica is used for the organisation's commercial or operational activities.

A Commercial Agreement may specify the entities, affiliates, contractors, infrastructure, products, and territories to which the commercial rights apply.

---

## 10. No Trademark Rights

This licence does not grant any right to use the trademarks, trade names, logos, or certification marks of the Licensor.

In particular, use of the name “Sylica” must not imply that a product, firmware image, hardware platform, cloud service, or implementation is certified, endorsed, or supported by the Licensor unless expressly authorised.

---

## 11. Commercial Licensing

The Licensor may provide Commercial Agreements to organisations wishing to use Sylica for Commercial Production Use or Competing Use.

Commercial Agreements may include rights and obligations relating to:

* production deployment;
* redistribution;
* OEM integration;
* hardware integration;
* cloud services;
* managed services;
* firmware signing;
* certification;
* security updates;
* support;
* maintenance;
* vulnerability response;
* attribution; and
* contributions to the Sylica project.

The Licensor may offer different commercial terms for different categories of use.

---

## 12. Interpretation

These Additional License Terms are intended to distinguish between **access to and examination of Sylica** and **commercial exploitation of Sylica as infrastructure**.

The following principle applies:

> **Sylica is available for independent inspection, security research, auditing, development, evaluation, personal and academic use. Production use by commercial organisations and commercial exploitation as infrastructure require a Commercial Agreement.**

Nothing in these Additional License Terms is intended to prohibit legitimate security research, independent auditing, academic research, evaluation, or other permitted non-production activities.

---

## 13. No Implied Rights

Except for the rights expressly granted under the Non-Functional Source License 1.0 and these Additional License Terms, no rights are granted by implication, estoppel, exhaustion, or otherwise.

In particular, permission to inspect, build, test, evaluate, or research Sylica does not grant permission for Commercial Production Use or Competing Use.

---

## 14. Relationship to NFSL-1.0

These Additional License Terms supplement the Non-Functional Source License 1.0.

If a provision of these Additional License Terms conflicts with a provision of NFSL-1.0, these Additional License Terms control solely with respect to Sylica and the additional rights and restrictions expressly addressed herein.

All provisions of NFSL-1.0 that are not modified by these Additional License Terms remain in effect.
