package sharptown

// Error is returned for invalid operations (caught before the request) and for
// unsuccessful server responses.
type Error struct {
	// Message is a human-readable description.
	Message string
	// Status is the HTTP status or JSON-RPC/gRPC code, when the error came from the server.
	Status int
	// Body is the parsed error payload, when present.
	Body any
}

func (e *Error) Error() string { return e.Message }
