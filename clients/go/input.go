package sharptown

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// Input is an image source for a transform. It is consumed lazily at request time and is
// stream-oriented: nothing is read until the transform runs, and the transports stream
// straight from it — so an image can be processed entirely in memory or from a network
// stream, without ever touching disk.
//
// Use File or Reader to pass a standard file object or any io.Reader; use Bytes for an
// in-memory buffer; Path and URL are conveniences that read from disk or fetch over HTTP.
type Input struct {
	filename    string
	contentType string
	open        func(ctx context.Context, hc *http.Client) (io.ReadCloser, error)
}

// Reader wraps any io.Reader (e.g. an *os.File, a multipart.File, an http body, a
// bytes.Buffer). The reader is not closed by the client.
func Reader(r io.Reader, filename string) Input {
	name := orDefault(filename, "image")
	return Input{
		filename:    name,
		contentType: guessContentType(name),
		open: func(context.Context, *http.Client) (io.ReadCloser, error) {
			return io.NopCloser(r), nil
		},
	}
}

// File wraps a standard *os.File, taking its base name as the filename. The file is not
// closed by the client.
func File(f *os.File) Input {
	return Reader(f, filepath.Base(f.Name()))
}

// Bytes wraps an in-memory image buffer.
func Bytes(data []byte, filename string) Input {
	name := orDefault(filename, "image")
	return Input{
		filename:    name,
		contentType: guessContentType(name),
		open: func(context.Context, *http.Client) (io.ReadCloser, error) {
			return io.NopCloser(bytes.NewReader(data)), nil
		},
	}
}

// Path reads the image from a file path when the transform runs.
func Path(p string) Input {
	name := filepath.Base(p)
	return Input{
		filename:    name,
		contentType: guessContentType(name),
		open: func(context.Context, *http.Client) (io.ReadCloser, error) {
			return os.Open(p)
		},
	}
}

// URL fetches the image over HTTP when the transform runs.
func URL(rawURL string) Input {
	name := "image"
	if parsed, err := url.Parse(rawURL); err == nil {
		if base := path.Base(parsed.Path); base != "" && base != "/" && base != "." {
			name = base
		}
	}
	return Input{
		filename:    name,
		contentType: guessContentType(name),
		open: func(ctx context.Context, hc *http.Client) (io.ReadCloser, error) {
			if hc == nil {
				hc = http.DefaultClient
			}
			req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
			if err != nil {
				return nil, &Error{Message: err.Error()}
			}
			resp, err := hc.Do(req)
			if err != nil {
				return nil, &Error{Message: fmt.Sprintf("failed to fetch input from %s: %s", rawURL, err)}
			}
			if resp.StatusCode < 200 || resp.StatusCode >= 300 {
				resp.Body.Close()
				return nil, &Error{Message: fmt.Sprintf("failed to fetch input from %s: %d", rawURL, resp.StatusCode), Status: resp.StatusCode}
			}
			return resp.Body, nil
		},
	}
}

func orDefault(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func guessContentType(filename string) string {
	switch strings.ToLower(strings.TrimPrefix(filepath.Ext(filename), ".")) {
	case "jpg", "jpeg":
		return "image/jpeg"
	case "png":
		return "image/png"
	case "webp":
		return "image/webp"
	case "gif":
		return "image/gif"
	case "avif":
		return "image/avif"
	case "heif", "heic":
		return "image/heif"
	case "tif", "tiff":
		return "image/tiff"
	case "bmp":
		return "image/bmp"
	default:
		return "application/octet-stream"
	}
}
