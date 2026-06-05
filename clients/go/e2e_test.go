//go:build e2e

// End-to-end tests against running Sharptown servers. Excluded from normal builds; run with:
//
//	go test -tags e2e ./...
//
// Start the servers first (from the repo root): pnpm rest, pnpm jsonrpc, pnpm grpc.
package sharptown_test

import (
	"context"
	"encoding/base64"
	"errors"
	"testing"
	"time"

	sharptown "github.com/e1berd/sharptown/clients/go"
)

var pngData, _ = base64.StdEncoding.DecodeString(
	"iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAFElEQVQImWOUm/CfARtgwio6aCUAUgQBvQtLKDIAAAAASUVORK5CYII=",
)

func isWebP(b []byte) bool {
	return len(b) >= 12 && string(b[0:4]) == "RIFF" && string(b[8:12]) == "WEBP"
}

func testCtx(t *testing.T) context.Context {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	t.Cleanup(cancel)
	return ctx
}

func TestRESTEndToEnd(t *testing.T) {
	c := sharptown.New("http://localhost:3001")
	res, err := c.Transform(sharptown.Bytes(pngData, "in.png")).
		Resize(64, 48).Grayscale().Convert("webp").Quality(80).Do(testCtx(t))
	if err != nil {
		t.Fatal(err)
	}
	if res.ContentType() != "image/webp" {
		t.Errorf("content-type: %q", res.ContentType())
	}
	if !isWebP(res.Body) {
		t.Errorf("expected a WebP, got %d bytes", len(res.Body))
	}
}

func TestRESTRejectsCorrupt(t *testing.T) {
	c := sharptown.New("http://localhost:3001")
	_, err := c.Transform(sharptown.Bytes([]byte("not-an-image"), "broken.png")).
		Convert("webp").Do(testCtx(t))
	var se *sharptown.Error
	if !errors.As(err, &se) {
		t.Fatalf("expected *sharptown.Error, got %T", err)
	}
	if se.Status != 415 {
		t.Errorf("status: %d", se.Status)
	}
}

func TestJSONRPCEndToEnd(t *testing.T) {
	c := sharptown.New("ws://localhost:3002", sharptown.WithTransport(sharptown.JSONRPC()))
	res, err := c.Transform(sharptown.Bytes(pngData, "in.png")).
		Width(50).Blur(2).Convert("webp").Do(testCtx(t))
	if err != nil {
		t.Fatal(err)
	}
	if res.ContentType() != "image/webp" {
		t.Errorf("content-type: %q", res.ContentType())
	}
	if !isWebP(res.Body) {
		t.Errorf("expected a WebP, got %d bytes", len(res.Body))
	}
}

func TestGRPCEndToEnd(t *testing.T) {
	c := sharptown.New("localhost:50051", sharptown.WithTransport(sharptown.GRPC()))
	res, err := c.Transform(sharptown.Bytes(pngData, "in.png")).
		Resize(64, 64).Convert("webp").Do(testCtx(t))
	if err != nil {
		t.Fatal(err)
	}
	if !isWebP(res.Body) {
		t.Errorf("expected a WebP, got %d bytes", len(res.Body))
	}
}
