import 'package:sharptown/sharptown.dart';

Future<void> main() async {
  final st = SharptownClient('http://localhost:3001');

  await st
      .transform(ImageInput.path('photo.jpg'))
      .resize(800, 600)
      .blur(3)
      .grayscale()
      .convert('webp')
      .save('out.webp');

  final thumbnail = await st
      .transform(ImageInput.url('https://example.com/cat.jpg'))
      .width(256)
      .fit('cover')
      .quality(80)
      .convert('webp')
      .bytes();

  print('thumbnail: ${thumbnail.length} bytes');

  final viaJsonRpc = SharptownClient(
    'ws://localhost:3002',
    transport: const JsonRpcTransport(),
  );

  final response = await viaJsonRpc
      .transform(ImageInput.path('photo.jpg'))
      .sepia(0.6)
      .convert('png')
      .response();

  print(
      'json-rpc result: ${response.contentType}, ${response.bytes.length} bytes');

  st.close();
  viaJsonRpc.close();
}
