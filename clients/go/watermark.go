package sharptown

// CompositeMark is an overlay passed to (*Transform).Composite — either a Watermark (image)
// or a Textmark (text). resolve returns its wire spec plus optional bytes to upload.
type CompositeMark interface {
	resolve() (map[string]any, []byte)
}

// Watermark is an image overlay composited onto the result. Create it with NewWatermark (a
// URL the server fetches) or NewWatermarkBytes (uploaded with the request), then chain the
// placement and appearance methods.
type Watermark struct {
	spec  map[string]any
	bytes []byte
}

// NewWatermark builds an image watermark fetched from url by the server.
func NewWatermark(url string) *Watermark {
	return &Watermark{spec: map[string]any{"type": "image", "url": url}}
}

// NewWatermarkBytes builds an image watermark uploaded alongside the request.
func NewWatermarkBytes(data []byte) *Watermark {
	return &Watermark{spec: map[string]any{"type": "image"}, bytes: data}
}

// Resize fits the overlay inside width×height. A non-positive dimension is left unset.
func (w *Watermark) Resize(width, height int) *Watermark {
	if width > 0 {
		w.spec["width"] = width
	}
	if height > 0 {
		w.spec["height"] = height
	}
	return w
}

// Width sets the overlay width only.
func (w *Watermark) Width(value int) *Watermark { w.spec["width"] = value; return w }

// Height sets the overlay height only.
func (w *Watermark) Height(value int) *Watermark { w.spec["height"] = value; return w }

// Rotate rotates the overlay by degrees.
func (w *Watermark) Rotate(degrees int) *Watermark { w.spec["rotate"] = degrees; return w }

// Opacity sets the overlay opacity (0–1).
func (w *Watermark) Opacity(value float64) *Watermark { w.spec["opacity"] = value; return w }

// Gravity sets the placement gravity (default southeast).
func (w *Watermark) Gravity(value string) *Watermark { w.spec["gravity"] = value; return w }

// Offset places the overlay at (x, y) from the top-left instead of a gravity.
func (w *Watermark) Offset(x, y int) *Watermark { w.spec["x"] = x; w.spec["y"] = y; return w }

// Tile repeats the overlay across the whole image.
func (w *Watermark) Tile() *Watermark { w.spec["tile"] = true; return w }

// Blend sets the Sharp blend mode (default over).
func (w *Watermark) Blend(mode string) *Watermark { w.spec["blend"] = mode; return w }

func (w *Watermark) resolve() (map[string]any, []byte) { return w.spec, w.bytes }

// Textmark is a text overlay composited onto the result, rendered server-side.
type Textmark struct {
	spec map[string]any
}

// NewTextmark builds a text watermark.
func NewTextmark(text string) *Textmark {
	return &Textmark{spec: map[string]any{"type": "text", "text": text}}
}

// Size sets the font size in pixels.
func (m *Textmark) Size(value int) *Textmark { m.spec["size"] = value; return m }

// Color sets the text colour (any CSS colour).
func (m *Textmark) Color(value string) *Textmark { m.spec["color"] = value; return m }

// Font sets the font family.
func (m *Textmark) Font(value string) *Textmark { m.spec["font"] = value; return m }

// Weight sets the font weight (e.g. "bold").
func (m *Textmark) Weight(value string) *Textmark { m.spec["weight"] = value; return m }

// Background paints a colour behind the text tile.
func (m *Textmark) Background(value string) *Textmark { m.spec["background"] = value; return m }

// Rotate rotates the text by degrees.
func (m *Textmark) Rotate(degrees int) *Textmark { m.spec["rotate"] = degrees; return m }

// Opacity sets the text opacity (0–1).
func (m *Textmark) Opacity(value float64) *Textmark { m.spec["opacity"] = value; return m }

// Gravity sets the placement gravity.
func (m *Textmark) Gravity(value string) *Textmark { m.spec["gravity"] = value; return m }

// Offset places the text at (x, y) from the top-left.
func (m *Textmark) Offset(x, y int) *Textmark { m.spec["x"] = x; m.spec["y"] = y; return m }

// Tile repeats the text across the whole image.
func (m *Textmark) Tile() *Textmark { m.spec["tile"] = true; return m }

func (m *Textmark) resolve() (map[string]any, []byte) { return m.spec, nil }
