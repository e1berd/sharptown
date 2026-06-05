package sharptown

import (
	"net/http"
	"os"
)

// Response is the result of a transform: the image bytes plus the response status and
// headers. Returned by every transport.
type Response struct {
	Status int
	Header http.Header
	Body   []byte
}

// ContentType returns the response Content-Type header.
func (r *Response) ContentType() string { return r.Header.Get("Content-Type") }

// Save writes the body to a file.
func (r *Response) Save(path string) error { return os.WriteFile(path, r.Body, 0o644) }
