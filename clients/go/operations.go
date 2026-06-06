package sharptown

import (
	"net/url"
	"strconv"
	"strings"
)

// operationOrder is the canonical option order, matching the JS client's serialization.
var operationOrder = []string{
	"width", "height", "dpr", "aspectRatio", "fit", "background", "smartCrop",
	"crop", "cropOffset", "trim", "chromaKey", "composite", "autoOrient", "rotate", "flip", "blur", "sharpen",
	"oilPaint", "brightness", "contrast", "saturation", "exposure", "hue", "gamma",
	"colorize", "sepia", "invert", "threshold", "r", "g", "b", "grayscale",
	"removeAlpha", "ensureAlpha", "convertTo", "quality", "progressive", "stripMetadata",
}

// SupportedFormats lists the output formats accepted by the server.
var SupportedFormats = []string{"webp", "png", "jpg", "jpeg", "avif", "gif", "heif"}

// FitModes lists the resize fit modes accepted by the server.
var FitModes = []string{"cover", "contain", "fill", "inside", "outside"}

// queryString serializes canonical operations into a REST query string.
func queryString(ops map[string]any) string {
	var sb strings.Builder
	for _, key := range operationOrder {
		value, ok := ops[key]
		if !ok || value == nil {
			continue
		}
		if sb.Len() > 0 {
			sb.WriteByte('&')
		}
		sb.WriteString(url.QueryEscape(key))
		sb.WriteByte('=')
		sb.WriteString(url.QueryEscape(stringify(value)))
	}
	return sb.String()
}

func stringify(value any) string {
	switch v := value.(type) {
	case bool:
		if v {
			return "true"
		}
		return "false"
	case int:
		return strconv.Itoa(v)
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case string:
		return v
	default:
		return ""
	}
}

func contains(list []string, value string) bool {
	for _, item := range list {
		if item == value {
			return true
		}
	}
	return false
}
