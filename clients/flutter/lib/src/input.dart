import 'dart:io';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import 'error.dart';

/// A resolved image: its raw bytes plus the filename and content type used in the request.
class ResolvedInput {
  /// Creates a resolved input.
  const ResolvedInput(this.bytes, this.filename, this.contentType);

  /// The raw image bytes.
  final Uint8List bytes;

  /// The filename sent in the multipart request.
  final String filename;

  /// The MIME type guessed from the filename.
  final String contentType;
}

/// An image source for a transform. It is resolved lazily, when the transform runs.
///
/// Use [ImageInput.bytes] for an in-memory buffer, [ImageInput.file] for a `dart:io`
/// [File], [ImageInput.path] to read from disk, or [ImageInput.url] to fetch over HTTP.
///
/// ```dart
/// ImageInput.bytes(buffer, 'photo.jpg');
/// ImageInput.file(File('photo.jpg'));
/// ImageInput.path('photo.jpg');
/// ImageInput.url('https://example.com/cat.jpg');
/// ```
class ImageInput {
  const ImageInput._(this._resolve, this._filename);

  final Future<ResolvedInput> Function(http.Client httpClient) _resolve;
  final String _filename;

  /// Wraps an in-memory image buffer.
  factory ImageInput.bytes(Uint8List data, [String filename = 'image']) {
    return ImageInput._(
      (_) async => ResolvedInput(data, filename, _guessContentType(filename)),
      filename,
    );
  }

  /// Wraps a `dart:io` [File], taking its base name as the filename.
  factory ImageInput.file(File file) => ImageInput.path(file.path);

  /// Reads the image from a file path when the transform runs.
  factory ImageInput.path(String path) {
    final name = _basename(path);
    return ImageInput._(
      (_) async {
        final file = File(path);
        if (!file.existsSync()) {
          throw SharptownError('Input file not found: $path');
        }
        return ResolvedInput(
            await file.readAsBytes(), name, _guessContentType(name));
      },
      name,
    );
  }

  /// Fetches the image over HTTP when the transform runs.
  factory ImageInput.url(String url) {
    var name = 'image';
    final parsed = Uri.tryParse(url);
    if (parsed != null && parsed.pathSegments.isNotEmpty) {
      final last = parsed.pathSegments.last;
      if (last.isNotEmpty) name = last;
    }
    return ImageInput._(
      (httpClient) async {
        final http.Response response;
        try {
          response = await httpClient.get(Uri.parse(url));
        } catch (error) {
          throw SharptownError('Failed to fetch input from $url: $error');
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw SharptownError(
            'Failed to fetch input from $url: ${response.statusCode}',
            status: response.statusCode,
          );
        }
        return ResolvedInput(response.bodyBytes, name, _guessContentType(name));
      },
      name,
    );
  }

  /// The filename this input will report in the request.
  String get filename => _filename;

  /// Resolves the input to bytes, using [httpClient] for [ImageInput.url] sources.
  Future<ResolvedInput> resolve(http.Client httpClient) => _resolve(httpClient);

  static String _basename(String path) {
    final normalized = path.replaceAll('\\', '/');
    final segment = normalized.split('/').last;
    return segment.isEmpty ? 'image' : segment;
  }

  static String _guessContentType(String filename) {
    final dot = filename.lastIndexOf('.');
    final ext = dot == -1 ? '' : filename.substring(dot + 1).toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'avif':
        return 'image/avif';
      case 'heif':
      case 'heic':
        return 'image/heif';
      case 'tif':
      case 'tiff':
        return 'image/tiff';
      case 'bmp':
        return 'image/bmp';
      default:
        return 'application/octet-stream';
    }
  }
}
