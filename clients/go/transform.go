package sharptown

import (
	"context"
	"fmt"
	"strconv"
	"strings"
)

// Transform is a chainable builder for a single image transformation. Operation methods
// return the same *Transform, so they compose fluently; a terminal (Do, Bytes, Save) runs
// the request. The first invalid operation is captured and returned by the terminal.
type Transform struct {
	client *Client
	input  Input
	ops    map[string]any
	err    error
}

// Operations returns the canonical operation set accumulated so far.
func (t *Transform) Operations() map[string]any { return t.ops }

// Err returns the first validation error captured, if any.
func (t *Transform) Err() error { return t.err }

// Resize sets the target width and height.
func (t *Transform) Resize(width, height int) *Transform {
	return t.putUint("width", width, "width").putUint("height", height, "height")
}

// Width sets the target width only.
func (t *Transform) Width(value int) *Transform { return t.putUint("width", value, "width") }

// Height sets the target height only.
func (t *Transform) Height(value int) *Transform { return t.putUint("height", value, "height") }

// Crop crops a rectangle (left, top, width, height).
func (t *Transform) Crop(left, top, width, height int) *Transform {
	if t.err != nil {
		return t
	}
	for name, value := range map[string]int{"crop.left": left, "crop.top": top, "crop.width": width, "crop.height": height} {
		if value < 0 {
			return t.fail(fmt.Errorf("invalid %s: expected a non-negative integer, got %d", name, value))
		}
	}
	t.ops["crop"] = fmt.Sprintf("%d,%d,%d,%d", left, top, width, height)
	return t
}

// SmartCrop crops to the salient region when resizing.
func (t *Transform) SmartCrop() *Transform { return t.set("smartCrop", true) }

// Fit sets the resize fit mode: cover, contain, fill, inside, outside.
func (t *Transform) Fit(mode string) *Transform {
	m := strings.ToLower(mode)
	if !contains(FitModes, m) {
		return t.fail(fmt.Errorf("unsupported fit %q. Supported: %s", mode, strings.Join(FitModes, ", ")))
	}
	return t.set("fit", m)
}

// Background sets the background colour for fit=contain.
func (t *Transform) Background(color string) *Transform { return t.set("background", color) }

// DPR sets the device pixel ratio (multiplies the target size).
func (t *Transform) DPR(value float64) *Transform { return t.putRange("dpr", value, "dpr", 0.1, 5) }

// AspectRatio sets the target aspect ratio (width / height).
func (t *Transform) AspectRatio(value float64) *Transform {
	return t.putRange("aspectRatio", value, "aspectRatio", 0.0001, 1000)
}

// AutoOrient rotates by EXIF orientation.
func (t *Transform) AutoOrient() *Transform { return t.set("autoOrient", true) }

// Rotate rotates by the given degrees.
func (t *Transform) Rotate(degrees int) *Transform { return t.set("rotate", degrees) }

// Flip flips horizontally.
func (t *Transform) Flip() *Transform { return t.set("flip", true) }

// Blur applies a Gaussian blur of the given sigma/radius.
func (t *Transform) Blur(sigma int) *Transform { return t.putUint("blur", sigma, "blur") }

// Tint tints the image with the given RGB channels (each 0–255).
func (t *Transform) Tint(r, g, b int) *Transform {
	return t.putColor("r", r, "r").putColor("g", g, "g").putColor("b", b, "b")
}

// Grayscale desaturates the image.
func (t *Transform) Grayscale() *Transform { return t.set("grayscale", true) }

// Greyscale is a British alias of Grayscale.
func (t *Transform) Greyscale() *Transform { return t.Grayscale() }

// RemoveAlpha removes the alpha channel.
func (t *Transform) RemoveAlpha() *Transform { return t.set("removeAlpha", true) }

// EnsureAlpha ensures an alpha channel exists.
func (t *Transform) EnsureAlpha() *Transform { return t.set("ensureAlpha", true) }

// Brightness adjusts brightness, -100–100.
func (t *Transform) Brightness(value float64) *Transform {
	return t.putRange("brightness", value, "brightness", -100, 100)
}

// Contrast adjusts contrast, -100–100.
func (t *Transform) Contrast(value float64) *Transform {
	return t.putRange("contrast", value, "contrast", -100, 100)
}

// Saturation adjusts saturation, 0–2.
func (t *Transform) Saturation(value float64) *Transform {
	return t.putRange("saturation", value, "saturation", 0, 2)
}

// Exposure adjusts exposure in EV stops, -3–3.
func (t *Transform) Exposure(value float64) *Transform {
	return t.putRange("exposure", value, "exposure", -3, 3)
}

// Hue rotates hue in degrees, 0–360.
func (t *Transform) Hue(value float64) *Transform { return t.putRange("hue", value, "hue", 0, 360) }

// Gamma applies gamma correction, 1.0–3.0.
func (t *Transform) Gamma(value float64) *Transform { return t.putRange("gamma", value, "gamma", 1, 3) }

// Colorize maps the image to shades of one colour.
func (t *Transform) Colorize(color string) *Transform { return t.set("colorize", color) }

// Sepia applies a sepia tone, intensity 0–1.
func (t *Transform) Sepia(intensity float64) *Transform {
	return t.putRange("sepia", intensity, "sepia", 0, 1)
}

// Invert inverts colours.
func (t *Transform) Invert() *Transform { return t.set("invert", true) }

// Threshold binarises the image at the given threshold, 0–255.
func (t *Transform) Threshold(value int) *Transform {
	return t.putIntRange("threshold", value, "threshold", 0, 255)
}

// Sharpen sharpens the image with the given sigma, 0–5.
func (t *Transform) Sharpen(sigma float64) *Transform {
	return t.putRange("sharpen", sigma, "sharpen", 0, 5)
}

// OilPaint applies an oil-paint effect with the given window size, 1–25.
func (t *Transform) OilPaint(size int) *Transform {
	return t.putIntRange("oilPaint", size, "oilPaint", 1, 25)
}

// Quality sets the output quality 1–100 (applies with Convert).
func (t *Transform) Quality(value int) *Transform {
	return t.putIntRange("quality", value, "quality", 1, 100)
}

// Progressive enables progressive (interlaced) output.
func (t *Transform) Progressive() *Transform { return t.set("progressive", true) }

// StripMetadata strips EXIF/metadata (the server default).
func (t *Transform) StripMetadata() *Transform { return t.set("stripMetadata", true) }

// KeepMetadata keeps EXIF/metadata in the output.
func (t *Transform) KeepMetadata() *Transform { return t.set("stripMetadata", false) }

// Convert sets the output format (webp, png, jpg, jpeg, avif, gif, heif).
func (t *Transform) Convert(format string) *Transform {
	f := strings.ToLower(format)
	if !contains(SupportedFormats, f) {
		return t.fail(fmt.Errorf("unsupported format %q. Supported: %s", format, strings.Join(SupportedFormats, ", ")))
	}
	return t.set("convertTo", f)
}

// ToFormat is an alias of Convert.
func (t *Transform) ToFormat(format string) *Transform { return t.Convert(format) }

// Do runs the request and returns the full Response.
func (t *Transform) Do(ctx context.Context) (*Response, error) {
	if t.err != nil {
		return nil, t.err
	}
	req := &Request{
		BaseURL:    t.client.baseURL,
		Headers:    t.client.headers,
		Input:      t.input,
		Operations: t.ops,
		Timeout:    t.client.timeout,
		HTTPClient: t.client.httpClient,
	}
	if t.client.timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, t.client.timeout)
		defer cancel()
	}
	return t.client.transport.Transform(ctx, req)
}

// Bytes runs the request and returns the raw image bytes.
func (t *Transform) Bytes(ctx context.Context) ([]byte, error) {
	resp, err := t.Do(ctx)
	if err != nil {
		return nil, err
	}
	return resp.Body, nil
}

// Save runs the request and writes the result to a file.
func (t *Transform) Save(ctx context.Context, path string) error {
	resp, err := t.Do(ctx)
	if err != nil {
		return err
	}
	return resp.Save(path)
}

func (t *Transform) set(key string, value any) *Transform {
	if t.err == nil {
		t.ops[key] = value
	}
	return t
}

func (t *Transform) fail(err error) *Transform {
	if t.err == nil {
		t.err = &Error{Message: err.Error()}
	}
	return t
}

func (t *Transform) putUint(key string, value int, field string) *Transform {
	if t.err != nil {
		return t
	}
	if value < 0 {
		return t.fail(fmt.Errorf("invalid %s: expected a non-negative integer, got %d", field, value))
	}
	return t.set(key, value)
}

func (t *Transform) putColor(key string, value int, field string) *Transform {
	if t.err != nil {
		return t
	}
	if value < 0 || value > 255 {
		return t.fail(fmt.Errorf("invalid %s: expected 0-255, got %d", field, value))
	}
	return t.set(key, value)
}

func (t *Transform) putIntRange(key string, value int, field string, min, max int) *Transform {
	if t.err != nil {
		return t
	}
	if value < min || value > max {
		return t.fail(fmt.Errorf("invalid %s: expected %d-%d, got %d", field, min, max, value))
	}
	return t.set(key, value)
}

func (t *Transform) putRange(key string, value float64, field string, min, max float64) *Transform {
	if t.err != nil {
		return t
	}
	if value < min || value > max {
		return t.fail(fmt.Errorf("invalid %s: expected %s-%s, got %s", field, ftoa(min), ftoa(max), ftoa(value)))
	}
	return t.set(key, value)
}

func ftoa(value float64) string { return strconv.FormatFloat(value, 'f', -1, 64) }
