# Measurement in the Browser

## Purpose

The Measurement in the Browser tool provides an interactive, web-based interface for computing and verifying SEV-SNP (Secure Encrypted Virtualization - Secure Nested Paging) measurements for Confidential Virtual Machines (CVMs). It eliminates the need for command-line tools and complex build processes, allowing security engineers and VM administrators to validate firmware measurements directly from their browser.

## Key Functionality

- **SEV-SNP Measurement Calculation**: Compute cryptographic measurements for AMD SEV-SNP encrypted VMs
- **Drag-and-Drop Interface**: Easily upload firmware files using intuitive drag-and-drop functionality
- **Live Reload Support**: Immediate feedback on changes without restarting the server
- **Browser-Based Execution**: No installation required; works in any modern web browser
- **Dependency Management**: Automatic vendoring of required JavaScript libraries (PKI.js, ASN.1.js, and cryptographic hashing libraries)

## How It Works

### Architecture

The tool runs as a lightweight Python HTTP server that serves a static frontend application. The browser-side application:

1. **Loads Dependencies**: Dynamically imports cryptographic libraries from a vendored local cache
2. **Processes Files**: Accepts firmware or measurement files via drag-and-drop
3. **Computes Measurements**: Uses PKI.js and @noble/hashes to perform SEV-SNP measurement calculations
4. **Displays Results**: Shows computed measurements in an easily readable format

### Technology Stack

- **Backend**: Python HTTP server (`server.py`) with custom request handling
- **Frontend**: Vanilla JavaScript with client-side cryptographic processing
- **Cryptographic Libraries**:
  - **PKI.js (3.4.0)**: ASN.1 and cryptographic operations
  - **ASN.1.js (3.0.7)**: Abstract Syntax Notation One parsing
  - **@noble/hashes (1.4.0)**: SHA-1 and SHA-2 implementations
  - **bytestreamjs (2.0.1)**: Binary data handling
  - **pvutils & pvtsutils**: Utility libraries for PKI operations

### Dependency Vendoring

The `vendor.sh` script downloads and caches all required dependencies as CommonJS modules in the `static/npm/` directory. This approach:

- Eliminates external CDN dependencies
- Improves offline availability
- Provides reproducible builds
- Ensures consistent versions across deployments

## Usage

### Quick Start

1. **Install Dependencies**:
   ```bash
   cd tools/measure-browser
   ./vendor.sh
   ```

2. **Start the Web Server**:
   ```bash
   python server.py
   ```

3. **Access the Tool**:
   Open your browser and navigate to:
   ```
   http://localhost:8080
   ```

4. **Upload and Measure**:
   - Drag and drop your firmware or measurement file into the browser window
   - The tool will automatically calculate and display the SEV-SNP measurement
   - Results update in real-time as you make changes

### Development Setup

For development and testing:

```bash
# Vendored dependencies must be present
./vendor.sh

# Start the server (serves from static/ directory with live reload support)
python server.py

# The server runs on localhost:8080 by default
# Changes to static files are reflected immediately
```

### File Format

The tool accepts firmware files in standard formats compatible with SEV-SNP measurement calculation:
- Raw firmware binaries
- Measurement attestation files
- VM configuration files in ASN.1 format

## Why It Matters

### Security & Verification

- **Attestation Validation**: Verify that Confidential VM firmware hasn't been tampered with
- **Supply Chain Confidence**: Validate measurements in a transparent, auditable way
- **Zero-Trust Architecture**: Enable measurement-based verification in confidential computing environments

### Operational Benefits

- **No Dependencies**: Requires only Python and a web browser
- **Accessibility**: Democratizes access to SEV-SNP tools for non-specialists
- **Integration**: Can be embedded in CI/CD pipelines or security dashboards
- **Auditability**: Clear, interactive workflow leaves no ambiguity about measurement computation

## Notes & Attribution

### Related Technologies

This tool is part of the **Enclaive Sylica** project, which provides comprehensive support for Confidential Virtual Machine Firmware (CVMF) distribution. It complements command-line measurement tools by offering an interactive, browser-based alternative.

### SEV-SNP Background

AMD SEV-SNP (Secure Encrypted Virtualization - Secure Nested Paging) is a security feature for AMD EPYC processors that provides:
- Encrypted VM memory
- Encrypted VM state
- Integrity and freshness guarantees via measurement attestation

Measurements are critical for verifying the integrity of the firmware and configuration before launching confidential workloads.

### Library Acknowledgments

- **PKI.js**: Used for ASN.1 structure parsing and X.509 certificate handling
- **@noble/hashes**: Provides cryptographically secure hash functions
- **bytestreamjs**: Enables efficient binary data stream manipulation

## License

This tool is part of the Enclaive Sylica project. Please refer to the main project's LICENSE file for licensing information.

For more information about Sylica and confidential computing, visit the [Enclaive Sylica GitHub repository](https://github.com/enclaive/sylica).
