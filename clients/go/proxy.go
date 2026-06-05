package sharptown

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/url"
	"sort"
	"strings"
)

// DefaultProxyPath is the server's signed image-proxy endpoint.
const DefaultProxyPath = "/api/v1/fetch"

// WithProxySecret sets the shared HMAC secret (the server's SHARPTOWN_PROXY_KEY) used by
// SignedURL. Sign on a trusted server only; never embed the secret in a public client.
func WithProxySecret(secret string) Option { return func(c *Client) { c.proxySecret = secret } }

// WithProxyPath overrides the signed image-proxy endpoint path (default DefaultProxyPath).
func WithProxyPath(path string) Option { return func(c *Client) { c.proxyPath = path } }

// SignedURL builds a signed image-proxy URL for the server's GET /fetch endpoint. The
// server downloads source, applies ops, and serves a cached result — drop the URL straight
// into an <img> tag. A WithProxySecret option must have been set.
//
//	url, err := c.SignedURL("https://example.com/photo.jpg", map[string]any{
//		"width": 800, "convertTo": "webp",
//	})
func (c *Client) SignedURL(source string, ops map[string]any) (string, error) {
	params := make(map[string]string)
	for _, key := range operationOrder {
		if value, ok := ops[key]; ok && value != nil {
			params[key] = stringify(value)
		}
	}
	return c.signProxyURL(source, params)
}

// SignedURL builds a signed image-proxy URL from the operations accumulated on the builder,
// reusing the same validation as a transform request.
//
//	url, err := c.Transform(nil).Resize(800, 0).Blur(3).Convert("webp").SignedURL(source)
func (t *Transform) SignedURL(source string) (string, error) {
	if t.err != nil {
		return "", t.err
	}
	params := make(map[string]string)
	for _, key := range operationOrder {
		if value, ok := t.ops[key]; ok && value != nil {
			params[key] = stringify(value)
		}
	}
	return t.client.signProxyURL(source, params)
}

// signProxyURL signs the decoded params plus the source URL and returns the full proxy URL
// with a percent-encoded query.
func (c *Client) signProxyURL(source string, params map[string]string) (string, error) {
	if source == "" {
		return "", errors.New("sharptown: SignedURL source is required")
	}
	if c.proxySecret == "" {
		return "", errors.New("sharptown: SignedURL requires WithProxySecret")
	}

	params["url"] = source
	signature := signCanonical(params, c.proxySecret)

	path := c.proxyPath
	if path == "" {
		path = DefaultProxyPath
	}

	u, err := url.Parse(httpBase(c.baseURL))
	if err != nil {
		return "", err
	}
	u.Path = strings.TrimRight(u.Path, "/") + path

	query := url.Values{}
	for key, value := range params {
		query.Set(key, value)
	}
	query.Set("sig", signature)
	u.RawQuery = query.Encode()

	return u.String(), nil
}

// signCanonical builds the canonical string (decoded key=value pairs sorted by key and
// joined with "&") and returns its base64url HMAC-SHA256 signature.
func signCanonical(params map[string]string, secret string) string {
	keys := make([]string, 0, len(params))
	for key := range params {
		if key == "sig" {
			continue
		}
		keys = append(keys, key)
	}
	sort.Strings(keys)

	pairs := make([]string, len(keys))
	for i, key := range keys {
		pairs[i] = key + "=" + params[key]
	}

	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(strings.Join(pairs, "&")))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
