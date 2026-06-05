package sharptown

import (
	"net/url"
	"testing"
)

func TestSignedURLReferenceVector(t *testing.T) {
	c := New("https://img.example.com", WithProxySecret("shared-secret"))
	got, err := c.SignedURL("https://example.com/a.jpg?v=2&x=1", map[string]any{
		"width": 800, "blur": 3, "convertTo": "webp",
	})
	if err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(got)
	if err != nil {
		t.Fatal(err)
	}
	const want = "dxkY7R4OWb1R8p6QnS5C7w6QRn30mUgOFEteIGiuYiI"
	if sig := u.Query().Get("sig"); sig != want {
		t.Fatalf("sig mismatch:\n got  %s\n want %s\n url  %s", sig, want, got)
	}
}
