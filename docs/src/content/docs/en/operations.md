---
title: Operations Reference
description: Every transform parameter, its type, range, and what it does.
group: Operations
order: 1
---

# Operations Reference

Every transport accepts the **same set of operations** — they all flow through
`applyOperations` in `@sharptown/core`. This page is the single source of truth for what
each parameter does. Each operation here is **streaming-safe** (works over the gRPC
stream), so it is available on REST, gRPC and JSON-RPC alike.

## Resize & crop

| Parameter | Type | Range / values | Effect |
| --------- | ---- | -------------- | ------ |
| `width` | number | ≥ 0 | Resize width in pixels. |
| `height` | number | ≥ 0 | Resize height in pixels. |
| `dpr` | number | `0.1`–`5` | Device pixel ratio; multiplies the target width/height. |
| `aspectRatio` | number | > 0 | Target ratio (e.g. `1.7778`). Needs `width` or `height`. |
| `fit` | string | `cover` `contain` `fill` `inside` `outside` | Resize fit mode. |
| `background` | string | colour | Background for `contain` (e.g. `white`, `#000`, `rgba(0,0,0,0)`). |
| `smartCrop` | boolean | — | Crop to the most salient region (faces/contrast) when resizing. |
| `crop` | string | `x,y,w,h` or `WxH` | Crop rectangle, or a size paired with `cropOffset`. |
| `cropOffset` | string | `x,y` | Offset for the `WxH` crop form. |
| `autoOrient` | boolean | — | Rotate by the EXIF orientation tag. |
| `rotate` | number | degrees | Rotate by N degrees. |
| `flip` | boolean | — | Flip horizontally. |

`smartCrop` and `aspectRatio` both default the fit to `cover` (they crop to fill the
target). `crop` accepts two forms: a full rectangle `crop=10,20,300,200`, or a size with a
separate offset `crop=300x200&cropOffset=10,20`.

## Tone & color

| Parameter | Type | Range | Effect |
| --------- | ---- | ----- | ------ |
| `brightness` | number | `-100`–`100` | Brightness adjustment. |
| `contrast` | number | `-100`–`100` | Contrast adjustment. |
| `saturation` | number | `0`–`2` | Saturation (`1` is the original). |
| `exposure` | number | `-3`–`3` | Exposure in EV stops. |
| `hue` | number | `0`–`360` | Hue rotation in degrees. |
| `gamma` | number | `1.0`–`3.0` | Gamma correction. |
| `colorize` | string | colour | Map to shades of one colour (greyscale + tint). |
| `r`, `g`, `b` | number | `0`–`255` | Tint per channel. |
| `grayscale` / `greyscale` | boolean | — | Desaturate the image. |

## Filters & effects

| Parameter | Type | Range | Effect |
| --------- | ---- | ----- | ------ |
| `blur` | number | ≥ 0 (sigma) | Gaussian blur. |
| `sharpen` | number / boolean | `0`–`5` | Sharpen sigma; truthy with no value uses the default. |
| `sepia` | number / boolean | `0`–`1` | Sepia intensity; truthy is full sepia. |
| `invert` | boolean | — | Invert colours. |
| `threshold` | number | `0`–`255` | Binarise to black/white at the threshold. |
| `oilPaint` | number | `1`–`25` | Oil-paint effect via a median filter (window size). |

## Alpha & output

| Parameter | Type | Range / values | Effect |
| --------- | ---- | -------------- | ------ |
| `removeAlpha` | boolean | — | Drop the alpha channel. |
| `ensureAlpha` | boolean | — | Ensure an alpha channel exists. |
| `convertTo` | string | see below | Output format. |
| `quality` | number | `1`–`100` | Output quality (applies when re-encoding via `convertTo`). |
| `progressive` | boolean | — | Progressive (interlaced) JPEG/PNG output. |
| `stripMetadata` | boolean | — | Strip EXIF/profiles. Stripped by default; `false` keeps metadata. |

> Over the REST transport every value arrives as a query string, so booleans are the
> literal strings `"true"` / `"false"` and numbers are strings. The client and core
> normalize this for you.

## Supported output formats

`convertTo` must be one of:

```
webp · png · jpg · jpeg · avif · gif · heif
```

Anything else raises an `InvalidOperationError` → HTTP `400` (`"Invalid convert format
target"`). `quality` and `progressive` take effect when the image is re-encoded (i.e. with
`convertTo`). If you omit `convertTo`, the image keeps its original format and the response
`Content-Type` still reflects what Sharp actually produced.

## Order of operations

`applyOperations` applies steps in a fixed, sensible order regardless of how you list
them:

1. `autoOrient`
2. `crop`
3. `removeAlpha` / `ensureAlpha`
4. `colorize`
5. tint (`r` / `g` / `b`)
6. `brightness` / `exposure` / `saturation` / `hue`
7. `contrast`
8. `gamma`
9. `grayscale`
10. `sepia`
11. `invert`
12. `threshold`
13. `blur`
14. `sharpen`
15. `oilPaint`
16. `flip`
17. `rotate`
18. resize (`width` / `height` / `dpr` / `aspectRatio` / `fit` / `background` / `smartCrop`)
19. `convertTo` (with `quality` / `progressive`)
20. `stripMetadata`

## Validation rules

- `width`, `height`, `blur` must be **non-negative integers**.
- `r`, `g`, `b` must be integers in **`[0, 255]`**.
- Ranged values (`brightness`, `contrast`, `saturation`, `exposure`, `hue`, `gamma`,
  `sepia`, `threshold`, `sharpen`, `oilPaint`, `quality`, `dpr`) are clamped to their
  documented range by the server; the client rejects out-of-range values up front.
- `fit` must be one of the listed modes; `convertTo` one of the supported formats.
- `aspectRatio` requires `width` or `height`.
- Out-of-range or non-numeric values raise `InvalidOperationError`. The client validates
  these **before** sending the request, failing fast with a `SharptownError`.

## Big-file limits (streaming / gRPC)

When processing very large images, keep output-format pixel limits in mind:

- **WebP** — up to `16383 × 16383` px.
- **JPEG** — up to `65535 × 65535` px.

If a map exceeds WebP's limit, convert to JPEG or `resize` in the same request. For
gigabyte-scale inputs, prefer `resize` / `convert` / `flip`; arbitrary `rotate` may
require more memory.
