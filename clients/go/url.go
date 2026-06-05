package sharptown

import (
	"regexp"
	"strings"
)

var schemeRE = regexp.MustCompile(`^([a-zA-Z][a-zA-Z0-9+.\-]*)://`)

// httpBase resolves base to the HTTP family (http/https). A missing scheme defaults to the
// secure variant, so "localhost:3001" becomes "https://localhost:3001"; an explicit
// "http://" (or "ws://") selects the insecure variant.
func httpBase(base string) string {
	secure, authority := splitScheme(base)
	if secure {
		return "https://" + authority
	}
	return "http://" + authority
}

// wsBase resolves base to the WebSocket family (ws/wss) using the same rule as httpBase.
func wsBase(base string) string {
	secure, authority := splitScheme(base)
	if secure {
		return "wss://" + authority
	}
	return "ws://" + authority
}

// splitScheme reports whether base is secure and returns it without its scheme. A "://"
// separates a real scheme from a bare "host:port", so "localhost:3001" is left untouched and
// reported as secure.
func splitScheme(base string) (secure bool, authority string) {
	b := strings.TrimRight(strings.TrimSpace(base), "/")
	if m := schemeRE.FindString(b); m != "" {
		scheme := strings.ToLower(strings.TrimSuffix(m, "://"))
		return scheme != "http" && scheme != "ws", b[len(m):]
	}
	return true, b
}
