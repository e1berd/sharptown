package sharptown

import (
	"context"
	"net/http"
	"time"
)

// Request is the canonical, protocol-independent input handed to a Transport.
type Request struct {
	BaseURL     string
	Headers     map[string]string
	Input       Input
	Operations  map[string]any
	Attachments [][]byte
	Timeout     time.Duration
	HTTPClient  *http.Client
}

// Transport speaks one of the Sharptown protocols (REST, JSON-RPC, gRPC). Each
// implementation accepts the same Request and returns the same Response.
type Transport interface {
	Transform(ctx context.Context, req *Request) (*Response, error)
}

// REST returns the default transport: a multipart POST to {baseURL}/api/v1/transform.
func REST() Transport { return &restTransport{path: "/api/v1/transform", field: "image"} }

// JSONRPC returns the JSON-RPC over WebSocket transport (image.transform at {baseURL}/rpc).
func JSONRPC() Transport { return &jsonrpcTransport{path: "/rpc", method: "image.transform"} }

// GRPC returns the gRPC transport (sharptown.v1.ImageProcessor/Transform, bidi streaming).
func GRPC() Transport { return &grpcTransport{} }
