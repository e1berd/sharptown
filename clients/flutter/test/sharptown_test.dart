import 'dart:typed_data';

import 'package:sharptown/sharptown.dart';
import 'package:test/test.dart';

void main() {
  final image = ImageInput.bytes(Uint8List.fromList([1, 2, 3]), 'photo.jpg');

  SharptownClient client() => SharptownClient('http://localhost:3001');

  group('base URL', () {
    test('trims trailing slash', () {
      expect(SharptownClient('http://localhost:3001/').baseUrl,
          'http://localhost:3001');
    });

    test('rejects an empty URL', () {
      expect(() => SharptownClient('   '), throwsA(isA<SharptownError>()));
    });
  });

  group('operation building', () {
    test('accumulates canonical operations', () {
      final ops = client()
          .transform(image)
          .resize(800, 600)
          .blur(3)
          .grayscale()
          .convert('webp')
          .operations;

      expect(ops, {
        'width': 800,
        'height': 600,
        'blur': 3,
        'grayscale': true,
        'convertTo': 'webp',
      });
    });

    test('tint sets r, g and b channels', () {
      final ops = client().transform(image).tint(10, 20, 30).operations;
      expect(ops, {'r': 10, 'g': 20, 'b': 30});
    });

    test('crop is serialized as a comma-separated rectangle', () {
      final ops = client().transform(image).crop(1, 2, 3, 4).operations;
      expect(ops['crop'], '1,2,3,4');
    });
  });

  group('validation', () {
    test('rejects an unsupported format', () {
      expect(
        () => client().transform(image).convert('tga'),
        throwsA(isA<SharptownError>()),
      );
    });

    test('rejects an unsupported fit mode', () {
      expect(
        () => client().transform(image).fit('squeeze'),
        throwsA(isA<SharptownError>()),
      );
    });

    test('rejects an out-of-range tint channel', () {
      expect(
        () => client().transform(image).tint(0, 0, 300),
        throwsA(isA<SharptownError>()),
      );
    });

    test('rejects a negative dimension', () {
      expect(
        () => client().transform(image).width(-1),
        throwsA(isA<SharptownError>()),
      );
    });
  });

  group('serialization', () {
    test('toQuery keeps canonical order', () {
      expect(
        Operations.toQuery({'convertTo': 'webp', 'width': 500}),
        'width=500&convertTo=webp',
      );
    });

    test('toOptions drops nulls and keeps native types', () {
      expect(
        Operations.toOptions({'width': 500, 'height': null, 'grayscale': true}),
        {'width': 500, 'grayscale': true},
      );
    });
  });
}
