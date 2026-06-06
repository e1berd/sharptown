import 'error.dart';
import 'operations.dart';

/// The resolved overlay: a wire spec plus optional bytes to upload.
typedef ResolvedMark = ({Map<String, Object?> spec, List<int>? bytes});

/// An overlay passed to `TransformBuilder.composite` — a [Watermark] (image) or a
/// [Textmark] (text).
abstract interface class CompositeMark {
  /// Resolves the overlay into its wire spec, plus optional bytes to upload.
  ResolvedMark resolve();
}

/// An image overlay composited onto the result. Build it from a URL the server fetches (a
/// `String` or `Uri`) or from image bytes uploaded with the request (`List<int>`), then
/// chain the placement and appearance methods.
///
/// ```dart
/// st.transform(input)
///     .composite(Watermark('https://cdn.example.com/logo.png').resize(120).opacity(0.6))
///     .convert('webp');
/// ```
class Watermark implements CompositeMark {
  /// Creates an image watermark from [source]: a URL (`String`/`Uri`) the server fetches, or
  /// image bytes (`List<int>`) uploaded with the request.
  Watermark(Object source) {
    if (source is String) {
      _spec['url'] = source;
    } else if (source is Uri) {
      _spec['url'] = source.toString();
    } else if (source is List<int>) {
      _bytes = source;
    } else {
      throw const SharptownError(
          'Watermark(source): expected a URL String/Uri or image bytes (List<int>)');
    }
  }

  final Map<String, Object?> _spec = {'type': 'image'};
  List<int>? _bytes;

  /// Fits the overlay inside [width]×[height]. Either dimension is optional.
  Watermark resize([int? width, int? height]) {
    if (width != null) _spec['width'] = Operations.positiveInt(width, 'watermark width');
    if (height != null) _spec['height'] = Operations.positiveInt(height, 'watermark height');
    return this;
  }

  /// Sets the overlay width only.
  Watermark width(int value) {
    _spec['width'] = Operations.positiveInt(value, 'watermark width');
    return this;
  }

  /// Sets the overlay height only.
  Watermark height(int value) {
    _spec['height'] = Operations.positiveInt(value, 'watermark height');
    return this;
  }

  /// Rotates the overlay by [degrees].
  Watermark rotate(int degrees) {
    _spec['rotate'] = degrees;
    return this;
  }

  /// Sets the overlay opacity (0–1).
  Watermark opacity(num value) {
    _spec['opacity'] = Operations.range(value, 'watermark opacity', 0, 1);
    return this;
  }

  /// Sets the placement gravity (default `southeast`).
  Watermark gravity(String value) {
    _spec['gravity'] = value;
    return this;
  }

  /// Places the overlay at ([x], [y]) from the top-left instead of a gravity.
  Watermark offset(int x, int y) {
    _spec['x'] = x;
    _spec['y'] = y;
    return this;
  }

  /// Repeats the overlay across the whole image.
  Watermark tile([bool enabled = true]) {
    _spec['tile'] = enabled;
    return this;
  }

  /// Sets the Sharp blend mode (default `over`).
  Watermark blend(String mode) {
    _spec['blend'] = mode;
    return this;
  }

  @override
  ResolvedMark resolve() => (spec: _spec, bytes: _bytes);
}

/// A text overlay composited onto the result, rendered server-side. Pass it to
/// `TransformBuilder.composite`.
///
/// ```dart
/// st.transform(input)
///     .composite(Textmark('© Acme').size(48).color('white').rotate(-30).tile())
///     .convert('webp');
/// ```
class Textmark implements CompositeMark {
  /// Creates a text watermark.
  Textmark(String text) {
    _spec['text'] = text;
  }

  final Map<String, Object?> _spec = {'type': 'text'};

  /// Font size in pixels.
  Textmark size(int value) {
    _spec['size'] = Operations.positiveInt(value, 'textmark size');
    return this;
  }

  /// Text colour (any CSS colour).
  Textmark color(String value) {
    _spec['color'] = value;
    return this;
  }

  /// Font family.
  Textmark font(String value) {
    _spec['font'] = value;
    return this;
  }

  /// Font weight (e.g. `bold`).
  Textmark weight(String value) {
    _spec['weight'] = value;
    return this;
  }

  /// Background colour painted behind the text tile.
  Textmark background(String value) {
    _spec['background'] = value;
    return this;
  }

  /// Rotates the text by [degrees].
  Textmark rotate(int degrees) {
    _spec['rotate'] = degrees;
    return this;
  }

  /// Text opacity (0–1).
  Textmark opacity(num value) {
    _spec['opacity'] = Operations.range(value, 'textmark opacity', 0, 1);
    return this;
  }

  /// Placement gravity.
  Textmark gravity(String value) {
    _spec['gravity'] = value;
    return this;
  }

  /// Places the text at ([x], [y]) from the top-left.
  Textmark offset(int x, int y) {
    _spec['x'] = x;
    _spec['y'] = y;
    return this;
  }

  /// Repeats the text across the whole image.
  Textmark tile([bool enabled = true]) {
    _spec['tile'] = enabled;
    return this;
  }

  @override
  ResolvedMark resolve() => (spec: _spec, bytes: null);
}
