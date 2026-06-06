package sharptown

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCompositeSerialization(t *testing.T) {
	var gotComposite, gotTrim, gotChroma string
	watermarkParts := 0

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotComposite = r.URL.Query().Get("composite")
		gotTrim = r.URL.Query().Get("trim")
		gotChroma = r.URL.Query().Get("chromaKey")
		mr, err := r.MultipartReader()
		if err == nil {
			for {
				part, perr := mr.NextPart()
				if perr != nil {
					break
				}
				if part.FormName() == "watermark" {
					watermarkParts++
				}
				io.Copy(io.Discard, part)
			}
		}
		w.Header().Set("content-type", "image/png")
		w.Write([]byte("ok"))
	}))
	defer srv.Close()

	c := New(srv.URL)
	_, err := c.Transform(Bytes([]byte("x"), "in.png")).
		Trim().
		ChromaKey("#00ff00", 30).
		Composite(NewWatermark("https://cdn/logo.png").Resize(120, 0).Opacity(0.6).Gravity("southeast")).
		Composite(NewWatermarkBytes([]byte("LOGO")).Tile()).
		Composite(NewTextmark("Hi").Size(20).Color("white")).
		Bytes(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	if gotTrim != "true" {
		t.Fatalf("trim = %q, want true", gotTrim)
	}
	if gotChroma != "#00ff00;30" {
		t.Fatalf("chromaKey = %q, want #00ff00;30", gotChroma)
	}
	if watermarkParts != 1 {
		t.Fatalf("watermark uploads = %d, want 1", watermarkParts)
	}

	var specs []map[string]any
	if err := json.Unmarshal([]byte(gotComposite), &specs); err != nil {
		t.Fatalf("composite is not valid JSON: %v (%s)", err, gotComposite)
	}
	if len(specs) != 3 {
		t.Fatalf("composite has %d specs, want 3", len(specs))
	}
	if specs[0]["type"] != "image" || specs[0]["url"] != "https://cdn/logo.png" {
		t.Fatalf("spec[0] = %v", specs[0])
	}
	if specs[1]["type"] != "image" || specs[1]["ref"].(float64) != 0 || specs[1]["tile"] != true {
		t.Fatalf("spec[1] = %v", specs[1])
	}
	if specs[2]["type"] != "text" || specs[2]["text"] != "Hi" {
		t.Fatalf("spec[2] = %v", specs[2])
	}
}
