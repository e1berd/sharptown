package sharptown

import (
	"context"
	"net/http"
	"testing"
)

type captureTransport struct{ req *Request }

func (c *captureTransport) Transform(_ context.Context, req *Request) (*Response, error) {
	c.req = req
	return &Response{Status: 200, Header: http.Header{"Content-Type": {"image/webp"}}, Body: []byte("BYTES")}, nil
}

func TestChainSerialization(t *testing.T) {
	cap := &captureTransport{}
	c := New("http://localhost:3001/", WithTransport(cap))

	data, err := c.Transform(Bytes([]byte("raw"), "in.png")).
		Resize(800, 600).
		Blur(3).
		Grayscale().
		Sharpen(2).
		Saturation(1.2).
		AspectRatio(1.5).
		Convert("webp").
		Quality(80).
		Bytes(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(data) != "BYTES" {
		t.Fatalf("body: got %q", data)
	}

	got := queryString(cap.req.Operations)
	want := "width=800&height=600&aspectRatio=1.5&blur=3&sharpen=2&saturation=1.2&grayscale=true&convertTo=webp&quality=80"
	if got != want {
		t.Fatalf("query:\n got %q\nwant %q", got, want)
	}
}

func TestCropAndTintSerialization(t *testing.T) {
	cap := &captureTransport{}
	c := New("http://localhost:3001", WithTransport(cap))

	_, err := c.Transform(Bytes([]byte("x"), "x.png")).
		Crop(10, 20, 300, 200).
		Tint(10, 0, 20).
		Convert("png").
		Bytes(context.Background())
	if err != nil {
		t.Fatal(err)
	}

	got := queryString(cap.req.Operations)
	want := "crop=10%2C20%2C300%2C200&r=10&g=0&b=20&convertTo=png"
	if got != want {
		t.Fatalf("query:\n got %q\nwant %q", got, want)
	}
}

func TestBaseURLTrailingSlashStripped(t *testing.T) {
	c := New("http://localhost:3001/", WithTransport(&captureTransport{}))
	if c.BaseURL() != "http://localhost:3001" {
		t.Fatalf("base url: got %q", c.BaseURL())
	}
}

func TestValidationErrors(t *testing.T) {
	c := New("http://localhost:3001", WithTransport(&captureTransport{}))
	ctx := context.Background()

	if _, err := c.Transform(Bytes([]byte("x"), "x")).Convert("tiff").Bytes(ctx); err == nil {
		t.Fatal("expected error for unsupported format")
	}
	if _, err := c.Transform(Bytes([]byte("x"), "x")).Saturation(9).Bytes(ctx); err == nil {
		t.Fatal("expected error for out-of-range saturation")
	}
	if _, err := c.Transform(Bytes([]byte("x"), "x")).Tint(300, 0, 0).Bytes(ctx); err == nil {
		t.Fatal("expected error for out-of-range tint channel")
	}
}

func TestProtoOptionsMapping(t *testing.T) {
	c := New("localhost:50051", WithTransport(&captureTransport{}))
	tr := c.Transform(Bytes([]byte("x"), "x.png")).
		Width(800).
		Rotate(90).
		Saturation(1.2).
		Sharpen(2).
		Threshold(128).
		Quality(80).
		Tint(1, 2, 3).
		Flip().
		Convert("webp")

	o := protoOptions(tr.Operations())
	if o.GetWidth() != 800 {
		t.Errorf("width: %d", o.GetWidth())
	}
	if o.GetRotate() != 90 {
		t.Errorf("rotate: %d", o.GetRotate())
	}
	if o.GetSaturation() != 1.2 {
		t.Errorf("saturation: %v", o.GetSaturation())
	}
	if o.GetSharpen() != 2 {
		t.Errorf("sharpen: %v", o.GetSharpen())
	}
	if o.GetThreshold() != 128 {
		t.Errorf("threshold: %d", o.GetThreshold())
	}
	if o.GetQuality() != 80 {
		t.Errorf("quality: %d", o.GetQuality())
	}
	if o.GetTintR() != 1 || o.GetTintG() != 2 || o.GetTintB() != 3 {
		t.Errorf("tint: %d %d %d", o.GetTintR(), o.GetTintG(), o.GetTintB())
	}
	if !o.GetFlip() {
		t.Error("flip should be true")
	}
	if o.GetConvertTo() != "webp" {
		t.Errorf("convertTo: %q", o.GetConvertTo())
	}
}
