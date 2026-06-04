---
title: Operations Reference
description: Every transform parameter, its type, range, and what it does.
group: Operations
order: 1
---

# Operations Reference

Every transport accepts the **same set of operations** — they all flow through
`applyOperations` in `@sharptown/core`. This page is the single source of truth for what
each parameter does.

## Parameters

| Parameter | Type | Range / values | Effect |
| --------- | ---- | -------------- | ------ |
| `width` | number | ≥ 0 | Resize width in pixels. |
| `height` | number | ≥ 0 | Resize height in pixels. |
| `rotate` | number | degrees | Rotate by N degrees. |
| `flip` | boolean | — | Flip horizontally. |
| `blur` | number | ≥ 0 (sigma) | Gaussian blur. |
| `r` | number | 0–255 | Tint red channel. |
| `g` | number | 0–255 | Tint green channel. |
| `b` | number | 0–255 | Tint blue channel. |
| `grayscale` | boolean | — | Desaturate the image. |
| `greyscale` | boolean | — | British alias of `grayscale`. |
| `removeAlpha` | boolean | — | Drop the alpha channel. |
| `ensureAlpha` | boolean | — | Ensure an alpha channel exists. |
| `convertTo` | string | see below | Output format. |

> Over the REST transport every value arrives as a query string, so booleans are the
> literal strings `"true"` / `"false"`. The client and core normalize this for you.

## Supported output formats

`convertTo` must be one of:

```
webp · png · jpg · jpeg · avif · gif · heif
```

Anything else raises an `InvalidOperationError` → HTTP `400` (`"Invalid convert format
target"`). If you omit `convertTo`, the image keeps its original format and the response
`Content-Type` still reflects what Sharp actually produced.

## Order of operations

`applyOperations` applies steps in a fixed, sensible order regardless of how you list
them:

1. `removeAlpha`
2. `ensureAlpha`
3. tint (`r` / `g` / `b`)
4. `grayscale`
5. `blur`
6. `flip`
7. `rotate`
8. `resize` (`width` / `height`)
9. `convertTo`

## Validation rules

- `width`, `height`, `blur` must be **non-negative integers**.
- `r`, `g`, `b` must be integers in **`[0, 255]`**.
- `rotate` is any integer (degrees).
- Out-of-range or non-numeric values raise `InvalidOperationError`. The client validates
  these **before** sending the request, failing fast with a `SharptownError`.

## Big-file limits (streaming / gRPC)

When processing very large images, keep output-format pixel limits in mind:

- **WebP** — up to `16383 × 16383` px.
- **JPEG** — up to `65535 × 65535` px.

If a map exceeds WebP's limit, convert to JPEG or `resize` in the same request. For
gigabyte-scale inputs, prefer `resize` / `convert` / `flip`; arbitrary `rotate` may
require more memory.
