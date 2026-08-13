package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"

	"github.com/cli/cli/v2/pkg/cmd/attestation/io"
	"github.com/cli/cli/v2/pkg/cmd/attestation/verification"
	"github.com/cli/cli/v2/pkg/iostreams"
	v2 "github.com/in-toto/attestation/go/v1"
	v1 "github.com/sigstore/protobuf-specs/gen/pb-go/bundle/v1"
	"github.com/sigstore/sigstore-go/pkg/bundle"
	"github.com/sigstore/sigstore-go/pkg/fulcio/certificate"
	"github.com/sigstore/sigstore-go/pkg/verify"
	"google.golang.org/protobuf/encoding/protojson"

	"github.com/cli/cli/v2/pkg/cmd/attestation/api"
	"github.com/cli/cli/v2/pkg/cmd/attestation/artifact"
)

func main() {
	if len(os.Args) < 3 {
		fmt.Println("Usage: verify <bundle> <asset>")
		os.Exit(1)
	}

	var payload *v2.Statement
	for _, asset := range os.Args[2:] {
		_, err := os.Stat(asset)
		if err != nil {
			_, _ = fmt.Fprintln(os.Stderr, "Asset not found:", err)
			os.Exit(1)
		}

		payload, err = run(os.Args[1], asset)
		if err != nil {
			_, _ = fmt.Fprintln(os.Stderr, "Verification failed:", err)
			os.Exit(1)
		}
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	err := enc.Encode(payload)
	if err != nil {
		_, _ = fmt.Fprintln(os.Stderr, "Encoding output failed:", err)
		os.Exit(1)
	}
}

func run(file, asset string) (*v2.Statement, error) {
	raw, err := os.ReadFile(file)
	if err != nil {
		return nil, fmt.Errorf("read bundle: %w", err)
	}

	data := &v1.Bundle{}
	err = protojson.Unmarshal(raw, data)
	if err != nil {
		return nil, fmt.Errorf("parse bundle: %w", err)
	}

	attestation, err := bundle.NewBundle(data, bundle.AllowCertificateChain())
	if err != nil {
		return nil, fmt.Errorf("get bundle: %w", err)
	}

	digest, err := artifact.NewDigestedArtifact(nil, asset, "sha256")
	if err != nil {
		return nil, fmt.Errorf("get digest: %w", err)
	}

	if _, err = os.Stat("trusted_root.json"); os.IsNotExist(err) {
		return nil, errors.New("trusted_root.json not found, run: gh attestation trusted-root > trusted_root.json")
	}

	verifier, err := verification.NewLiveSigstoreVerifier(verification.SigstoreConfig{
		TrustedRoot: "trusted_root.json",
		Logger: &io.Handler{
			ColorScheme: &iostreams.ColorScheme{},
			IO: &iostreams.IOStreams{
				In:     os.Stdin,
				Out:    os.Stdout,
				ErrOut: os.Stderr,
			},
		},
		ExternalHttpClient: http.DefaultClient,
	})
	if err != nil {
		return nil, fmt.Errorf("create verifier: %w", err)
	}

	policy, err := buildVerificationPolicy(digest)
	if err != nil {
		return nil, fmt.Errorf("build policy: %w", err)
	}

	verified, err := verifier.Verify([]*api.Attestation{{
		Bundle: attestation,
	}}, *policy)
	if err != nil {
		return nil, fmt.Errorf("verify: %w", err)
	}

	return verified[0].VerificationResult.Statement, nil
}

func buildVerificationPolicy(digestedArtifact *artifact.DigestedArtifact) (*verify.PolicyBuilder, error) {
	sanMatcher, err := verify.NewSANMatcher("", "^https://dotcom\\.releases\\.github\\.com$")
	if err != nil {
		return nil, fmt.Errorf("new san: %w", err)
	}

	issuerMatcher, err := verify.NewIssuerMatcher("", "^$")
	if err != nil {
		return nil, fmt.Errorf("new issuer: %w", err)
	}

	certId, err := verify.NewCertificateIdentity(sanMatcher, issuerMatcher, certificate.Extensions{})
	if err != nil {
		return nil, fmt.Errorf("new certificate: %w", err)
	}

	artifactDigestPolicyOption, err := verification.BuildDigestPolicyOption(*digestedArtifact)
	if err != nil {
		return nil, fmt.Errorf("digest policy: %w", err)
	}

	policy := verify.NewPolicy(artifactDigestPolicyOption, verify.WithCertificateIdentity(certId))
	return &policy, nil
}
