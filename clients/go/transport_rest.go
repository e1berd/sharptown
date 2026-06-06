package sharptown

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
)

type restTransport struct {
	path  string
	field string
}

func (t *restTransport) Transform(ctx context.Context, req *Request) (*Response, error) {
	endpoint := httpBase(req.BaseURL) + t.path
	if query := queryString(req.Operations); query != "" {
		endpoint += "?" + query
	}

	source, err := req.Input.open(ctx, req.HTTPClient)
	if err != nil {
		return nil, err
	}

	pr, pw := io.Pipe()
	mw := multipart.NewWriter(pw)

	go func() {
		defer source.Close()
		part, perr := mw.CreateFormFile(t.field, req.Input.filename)
		if perr != nil {
			pw.CloseWithError(perr)
			return
		}
		if _, cerr := io.Copy(part, source); cerr != nil {
			pw.CloseWithError(cerr)
			return
		}
		for i, data := range req.Attachments {
			wpart, werr := mw.CreateFormFile("watermark", fmt.Sprintf("watermark-%d", i))
			if werr != nil {
				pw.CloseWithError(werr)
				return
			}
			if _, werr := wpart.Write(data); werr != nil {
				pw.CloseWithError(werr)
				return
			}
		}
		if cerr := mw.Close(); cerr != nil {
			pw.CloseWithError(cerr)
			return
		}
		pw.Close()
	}()

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, pr)
	if err != nil {
		return nil, &Error{Message: err.Error()}
	}
	httpReq.Header.Set("Content-Type", mw.FormDataContentType())
	for key, value := range req.Headers {
		httpReq.Header.Set(key, value)
	}

	hc := req.HTTPClient
	if hc == nil {
		hc = http.DefaultClient
	}

	resp, err := hc.Do(httpReq)
	if err != nil {
		return nil, &Error{Message: "http request failed: " + err.Error()}
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, &Error{Message: "reading response: " + err.Error()}
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, restError(resp.StatusCode, body)
	}
	return &Response{Status: resp.StatusCode, Header: resp.Header, Body: body}, nil
}

func restError(status int, body []byte) *Error {
	err := &Error{Message: fmt.Sprintf("sharptown request failed with status %d", status), Status: status}
	var parsed map[string]any
	if json.Unmarshal(body, &parsed) == nil {
		err.Body = parsed
		if message, ok := parsed["error"].(string); ok {
			err.Message = message
		}
	}
	return err
}
