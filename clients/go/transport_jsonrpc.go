package sharptown

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/coder/websocket"
)

type jsonrpcTransport struct {
	path   string
	method string
}

func (t *jsonrpcTransport) Transform(ctx context.Context, req *Request) (*Response, error) {
	source, err := req.Input.open(ctx, req.HTTPClient)
	if err != nil {
		return nil, err
	}
	data, err := io.ReadAll(source)
	source.Close()
	if err != nil {
		return nil, &Error{Message: "reading input: " + err.Error()}
	}

	payload := map[string]any{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  t.method,
		"params": map[string]any{
			"image":   base64.StdEncoding.EncodeToString(data),
			"options": req.Operations,
		},
	}
	message, err := json.Marshal(payload)
	if err != nil {
		return nil, &Error{Message: err.Error()}
	}

	conn, _, err := websocket.Dial(ctx, wsEndpoint(req.BaseURL, t.path), &websocket.DialOptions{
		HTTPClient: req.HTTPClient,
		HTTPHeader: toHTTPHeader(req.Headers),
	})
	if err != nil {
		return nil, &Error{Message: "websocket dial: " + err.Error()}
	}
	defer conn.Close(websocket.StatusInternalError, "")

	conn.SetReadLimit(256 * 1024 * 1024)

	if err := conn.Write(ctx, websocket.MessageText, message); err != nil {
		return nil, &Error{Message: "websocket write: " + err.Error()}
	}
	_, reply, err := conn.Read(ctx)
	if err != nil {
		return nil, &Error{Message: "websocket read: " + err.Error()}
	}
	conn.Close(websocket.StatusNormalClosure, "")

	return decodeRPC(reply)
}

func decodeRPC(message []byte) (*Response, error) {
	var resp struct {
		Error *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
			Data    any    `json:"data"`
		} `json:"error"`
		Result *struct {
			Image       string `json:"image"`
			Format      string `json:"format"`
			ContentType string `json:"contentType"`
		} `json:"result"`
	}
	if err := json.Unmarshal(message, &resp); err != nil {
		return nil, &Error{Message: "malformed JSON-RPC response"}
	}
	if resp.Error != nil {
		return nil, &Error{Message: resp.Error.Message, Status: resp.Error.Code, Body: resp.Error}
	}
	if resp.Result == nil || resp.Result.Image == "" {
		return nil, &Error{Message: "JSON-RPC response is missing result.image"}
	}
	data, err := base64.StdEncoding.DecodeString(resp.Result.Image)
	if err != nil {
		return nil, &Error{Message: "JSON-RPC result.image is not valid base64"}
	}
	contentType := resp.Result.ContentType
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	header := http.Header{}
	header.Set("Content-Type", contentType)
	return &Response{Status: 200, Header: header, Body: data}, nil
}

func wsEndpoint(base, path string) string {
	b := strings.TrimRight(strings.TrimSpace(base), "/")
	switch {
	case strings.HasPrefix(b, "http://"):
		b = "ws://" + strings.TrimPrefix(b, "http://")
	case strings.HasPrefix(b, "https://"):
		b = "wss://" + strings.TrimPrefix(b, "https://")
	case strings.HasPrefix(b, "ws://"), strings.HasPrefix(b, "wss://"):
	default:
		b = "ws://" + b
	}
	if parsed, err := url.Parse(b); err == nil && (parsed.Path == "" || parsed.Path == "/") {
		return b + path
	}
	return b
}

func toHTTPHeader(headers map[string]string) http.Header {
	if len(headers) == 0 {
		return nil
	}
	h := http.Header{}
	for key, value := range headers {
		h.Set(key, value)
	}
	return h
}
