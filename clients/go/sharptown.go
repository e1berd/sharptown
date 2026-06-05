// Package sharptown is an expressive Go client for the Sharptown image transformation API.
//
// It exposes one fluent API across all three transports — REST (default), JSON-RPC, and
// gRPC — selected when the client is created. Images are streamed from any io.Reader (an
// *os.File, a multipart upload, an in-memory buffer), so a photo can be transformed
// entirely in memory without ever touching disk.
//
// # Example
//
//	c := sharptown.New("http://localhost:3001")
//	data, err := c.Transform(sharptown.Bytes(raw, "photo.jpg")).
//		Resize(800, 600).
//		Blur(3).
//		Grayscale().
//		Convert("webp").
//		Bytes(ctx)
package sharptown

import (
	"net/http"
	"strings"
	"time"
)

// Client is a configured Sharptown client. Create one with New.
type Client struct {
	baseURL    string
	transport  Transport
	headers    map[string]string
	timeout    time.Duration
	httpClient *http.Client
}

// Option configures a Client.
type Option func(*Client)

// New creates a client for baseURL. The base URL must match the chosen transport: the REST
// host (http://…:3001), the JSON-RPC WebSocket host (ws://…:3002), or the gRPC host
// (…:50051).
func New(baseURL string, opts ...Option) *Client {
	c := &Client{
		baseURL:    strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		transport:  REST(),
		headers:    map[string]string{},
		timeout:    30 * time.Second,
		httpClient: http.DefaultClient,
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// WithTransport selects the transport (REST, JSONRPC, GRPC).
func WithTransport(t Transport) Option { return func(c *Client) { c.transport = t } }

// WithHeaders adds default headers sent with every request.
func WithHeaders(headers map[string]string) Option {
	return func(c *Client) {
		for key, value := range headers {
			c.headers[key] = value
		}
	}
}

// WithHeader adds a single default header.
func WithHeader(key, value string) Option {
	return func(c *Client) { c.headers[key] = value }
}

// WithTimeout sets the per-request timeout (0 disables it).
func WithTimeout(d time.Duration) Option { return func(c *Client) { c.timeout = d } }

// WithHTTPClient sets the *http.Client used by the REST and JSON-RPC transports.
func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) {
		if hc != nil {
			c.httpClient = hc
		}
	}
}

// BaseURL returns the configured base URL.
func (c *Client) BaseURL() string { return c.baseURL }

// Transform starts a transform chain for the given image source.
func (c *Client) Transform(input Input) *Transform {
	return &Transform{client: c, input: input, ops: map[string]any{}}
}
