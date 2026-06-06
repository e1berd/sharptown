import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import 'input.dart';
import 'operations.dart';
import 'response.dart';
import 'transport/transport.dart';
import 'watermark.dart';

/// A chainable builder for transforming a single image. Every operation method returns
/// `this`, so calls compose fluently; a terminal ([bytes], [response], [save]) runs the
/// request.
///
/// Operations are validated as you build — an out-of-range value or unsupported format
/// throws a `SharptownError` immediately, before any request is sent.
///
/// ```dart
/// final data = await st
///     .transform(ImageInput.file(file))
///     .resize(800, 600)
///     .blur(3)
///     .grayscale()
///     .convert('webp')
///     .bytes();
/// ```
class TransformBuilder {
  /// Creates a builder. Prefer `SharptownClient.transform` over calling this directly.
  TransformBuilder({
    required Transport transport,
    required String baseUrl,
    required Map<String, String> headers,
    required Duration timeout,
    required http.Client httpClient,
    required ImageInput input,
  })  : _transport = transport,
        _baseUrl = baseUrl,
        _headers = headers,
        _timeout = timeout,
        _httpClient = httpClient,
        _input = input;

  final Transport _transport;
  final String _baseUrl;
  final Map<String, String> _headers;
  final Duration _timeout;
  final http.Client _httpClient;
  final ImageInput _input;
  final Map<String, Object?> _ops = {};
  final List<CompositeMark> _marks = [];

  /// The canonical operation set accumulated so far.
  Map<String, Object?> get operations => Map.unmodifiable(_ops);

  /// Trims uniform edges. Pass no argument for the default threshold, or a 1–255 threshold.
  TransformBuilder trim([int? threshold]) =>
      _set('trim', threshold == null ? true : Operations.positiveInt(threshold, 'trim'));

  /// Makes a colour transparent (chroma key). Pass the colour (`#rrggbb`, `r,g,b` or a name)
  /// and an optional tolerance percentage (0–100, default 12). Applied on the REST server.
  TransformBuilder chromaKey(String color, [int? tolerance]) =>
      _set('chromaKey', tolerance == null ? color : '$color;$tolerance');

  /// Overlays a [Watermark] (image) or [Textmark] (text) onto the result. Call it more than
  /// once to stack overlays; they are composited in order. Applied on the REST server.
  TransformBuilder composite(CompositeMark mark) {
    _marks.add(mark);
    return this;
  }

  /// Sets the target [width] and/or [height].
  TransformBuilder resize([int? width, int? height]) {
    if (width != null) {
      _ops['width'] = Operations.positiveInt(width, 'width');
    }
    if (height != null) {
      _ops['height'] = Operations.positiveInt(height, 'height');
    }
    return this;
  }

  /// Sets the target width only.
  TransformBuilder width(int value) =>
      _set('width', Operations.positiveInt(value, 'width'));

  /// Sets the target height only.
  TransformBuilder height(int value) =>
      _set('height', Operations.positiveInt(value, 'height'));

  /// Crops a rectangle ([left], [top], [width], [height]).
  TransformBuilder crop(int left, int top, int width, int height) {
    Operations.positiveInt(left, 'crop.left');
    Operations.positiveInt(top, 'crop.top');
    Operations.positiveInt(width, 'crop.width');
    Operations.positiveInt(height, 'crop.height');
    return _set('crop', '$left,$top,$width,$height');
  }

  /// Crops to the salient region when resizing.
  TransformBuilder smartCrop() => _set('smartCrop', true);

  /// Sets the resize fit mode: `cover`, `contain`, `fill`, `inside`, `outside`.
  TransformBuilder fit(String mode) =>
      _set('fit', Operations.assertFit(mode.toLowerCase()));

  /// Sets the background colour used by `fit: contain`.
  TransformBuilder background(String color) => _set('background', color);

  /// Sets the device pixel ratio (multiplies the target size), 0.1–5.
  TransformBuilder dpr(num value) =>
      _set('dpr', Operations.range(value, 'dpr', 0.1, 5));

  /// Sets the target aspect ratio (width / height).
  TransformBuilder aspectRatio(num value) =>
      _set('aspectRatio', Operations.range(value, 'aspectRatio', 0.0001, 1000));

  /// Rotates by EXIF orientation.
  TransformBuilder autoOrient() => _set('autoOrient', true);

  /// Rotates by the given [degrees].
  TransformBuilder rotate(int degrees) => _set('rotate', degrees);

  /// Flips horizontally.
  TransformBuilder flip() => _set('flip', true);

  /// Adjusts brightness, -100–100.
  TransformBuilder brightness(num value) =>
      _set('brightness', Operations.range(value, 'brightness', -100, 100));

  /// Adjusts contrast, -100–100.
  TransformBuilder contrast(num value) =>
      _set('contrast', Operations.range(value, 'contrast', -100, 100));

  /// Adjusts saturation, 0–2.
  TransformBuilder saturation(num value) =>
      _set('saturation', Operations.range(value, 'saturation', 0, 2));

  /// Adjusts exposure in EV stops, -3–3.
  TransformBuilder exposure(num value) =>
      _set('exposure', Operations.range(value, 'exposure', -3, 3));

  /// Rotates hue in degrees, 0–360.
  TransformBuilder hue(num value) =>
      _set('hue', Operations.range(value, 'hue', 0, 360));

  /// Applies gamma correction, 1.0–3.0.
  TransformBuilder gamma(num value) =>
      _set('gamma', Operations.range(value, 'gamma', 1, 3));

  /// Maps the image to shades of one [color].
  TransformBuilder colorize(String color) => _set('colorize', color);

  /// Tints the image with the given RGB channels (each 0–255).
  TransformBuilder tint(int r, int g, int b) {
    _ops['r'] = Operations.color(r, 'r');
    _ops['g'] = Operations.color(g, 'g');
    _ops['b'] = Operations.color(b, 'b');
    return this;
  }

  /// Desaturates the image.
  TransformBuilder grayscale() => _set('grayscale', true);

  /// British alias of [grayscale].
  TransformBuilder greyscale() => grayscale();

  /// Applies a Gaussian blur of the given [sigma]/radius.
  TransformBuilder blur(int sigma) =>
      _set('blur', Operations.positiveInt(sigma, 'blur'));

  /// Sharpens the image with the given [sigma], 0–5.
  TransformBuilder sharpen(num sigma) =>
      _set('sharpen', Operations.range(sigma, 'sharpen', 0, 5));

  /// Applies a sepia tone, [intensity] 0–1.
  TransformBuilder sepia(num intensity) =>
      _set('sepia', Operations.range(intensity, 'sepia', 0, 1));

  /// Inverts colours.
  TransformBuilder invert() => _set('invert', true);

  /// Binarises the image at the given [value], 0–255.
  TransformBuilder threshold(int value) =>
      _set('threshold', Operations.intRange(value, 'threshold', 0, 255));

  /// Applies an oil-paint effect with the given window [size], 1–25.
  TransformBuilder oilPaint(int size) =>
      _set('oilPaint', Operations.intRange(size, 'oilPaint', 1, 25));

  /// Removes the alpha channel.
  TransformBuilder removeAlpha() => _set('removeAlpha', true);

  /// Ensures an alpha channel exists.
  TransformBuilder ensureAlpha() => _set('ensureAlpha', true);

  /// Sets the output [format] (webp, png, jpg, jpeg, avif, gif, heif).
  TransformBuilder convert(String format) =>
      _set('convertTo', Operations.assertFormat(format.toLowerCase()));

  /// Alias of [convert].
  TransformBuilder toFormat(String format) => convert(format);

  /// Sets the output quality 1–100 (applies with [convert]).
  TransformBuilder quality(int value) =>
      _set('quality', Operations.intRange(value, 'quality', 1, 100));

  /// Enables progressive (interlaced) output.
  TransformBuilder progressive() => _set('progressive', true);

  /// Strips EXIF/metadata (the server default).
  TransformBuilder stripMetadata() => _set('stripMetadata', true);

  /// Keeps EXIF/metadata in the output.
  TransformBuilder keepMetadata() => _set('stripMetadata', false);

  /// Runs the request and returns the full [TransformResponse].
  Future<TransformResponse> response() {
    final operations = Map<String, Object?>.of(_ops);
    final attachments = <List<int>>[];
    if (_marks.isNotEmpty) {
      final specs = <Map<String, Object?>>[];
      for (final mark in _marks) {
        final resolved = mark.resolve();
        final spec = resolved.spec;
        if (resolved.bytes != null) {
          spec['ref'] = attachments.length;
          attachments.add(resolved.bytes!);
        }
        specs.add(spec);
      }
      operations['composite'] = jsonEncode(specs);
    }

    return _transport.transform(TransformRequest(
      baseUrl: _baseUrl,
      headers: _headers,
      input: _input,
      operations: operations,
      timeout: _timeout,
      httpClient: _httpClient,
      attachments: attachments,
    ));
  }

  /// Runs the request and returns the raw image bytes.
  Future<Uint8List> bytes() async => (await response()).bytes;

  /// Runs the request and writes the result to [path], returning the written [File].
  Future<File> save(String path) async => (await response()).save(path);

  TransformBuilder _set(String key, Object value) {
    _ops[key] = value;
    return this;
  }
}
