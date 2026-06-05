package sharptown

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"

	"github.com/e1berd/sharptown/clients/go/internal/pb"
)

type grpcTransport struct{}

func (g *grpcTransport) Transform(ctx context.Context, req *Request) (*Response, error) {
	conn, err := grpc.NewClient(grpcTarget(req.BaseURL), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, &Error{Message: "grpc dial: " + err.Error()}
	}
	defer conn.Close()

	stream, err := pb.NewImageProcessorClient(conn).Transform(ctx)
	if err != nil {
		return nil, grpcError(err)
	}

	options := &pb.TransformRequest{Payload: &pb.TransformRequest_Options{Options: protoOptions(req.Operations)}}
	if err := stream.Send(options); err != nil {
		return nil, grpcError(err)
	}

	source, err := req.Input.open(ctx, req.HTTPClient)
	if err != nil {
		return nil, err
	}
	if err := streamChunks(stream, source); err != nil {
		source.Close()
		return nil, grpcError(err)
	}
	source.Close()

	if err := stream.CloseSend(); err != nil {
		return nil, grpcError(err)
	}

	var out bytes.Buffer
	for {
		resp, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, grpcError(err)
		}
		out.Write(resp.GetChunk())
	}

	body := out.Bytes()
	header := http.Header{}
	header.Set("Content-Type", http.DetectContentType(body))
	return &Response{Status: 200, Header: header, Body: body}, nil
}

func streamChunks(stream grpc.BidiStreamingClient[pb.TransformRequest, pb.TransformResponse], r io.Reader) error {
	buf := make([]byte, 64*1024)
	for {
		n, err := r.Read(buf)
		if n > 0 {
			chunk := make([]byte, n)
			copy(chunk, buf[:n])
			if serr := stream.Send(&pb.TransformRequest{Payload: &pb.TransformRequest_Chunk{Chunk: chunk}}); serr != nil {
				return serr
			}
		}
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
	}
}

func grpcTarget(base string) string {
	b := strings.TrimSpace(base)
	for _, scheme := range []string{"http://", "https://", "grpc://"} {
		b = strings.TrimPrefix(b, scheme)
	}
	return strings.TrimRight(b, "/")
}

func grpcError(err error) *Error {
	if st, ok := status.FromError(err); ok {
		return &Error{Message: st.Message(), Status: int(st.Code())}
	}
	return &Error{Message: err.Error()}
}

func protoOptions(ops map[string]any) *pb.TransformOptions {
	o := &pb.TransformOptions{}

	u32 := func(key string) *uint32 {
		if v, ok := ops[key]; ok {
			x := uint32(v.(int))
			return &x
		}
		return nil
	}
	i32 := func(key string) *int32 {
		if v, ok := ops[key]; ok {
			x := int32(v.(int))
			return &x
		}
		return nil
	}
	f64 := func(key string) *float64 {
		if v, ok := ops[key]; ok {
			x := v.(float64)
			return &x
		}
		return nil
	}
	str := func(key string) string {
		if v, ok := ops[key]; ok {
			return v.(string)
		}
		return ""
	}
	boolean := func(key string) bool {
		if v, ok := ops[key]; ok {
			return v.(bool)
		}
		return false
	}

	o.Width = u32("width")
	o.Height = u32("height")
	o.Rotate = i32("rotate")
	o.Flip = boolean("flip")
	o.Blur = u32("blur")
	o.TintR = u32("r")
	o.TintG = u32("g")
	o.TintB = u32("b")
	o.Grayscale = boolean("grayscale")
	o.RemoveAlpha = boolean("removeAlpha")
	o.EnsureAlpha = boolean("ensureAlpha")
	o.ConvertTo = str("convertTo")
	o.Crop = str("crop")
	o.CropOffset = str("cropOffset")
	o.SmartCrop = boolean("smartCrop")
	o.Fit = str("fit")
	o.Background = str("background")
	o.AutoOrient = boolean("autoOrient")
	o.Dpr = f64("dpr")
	o.AspectRatio = f64("aspectRatio")
	o.Brightness = f64("brightness")
	o.Contrast = f64("contrast")
	o.Saturation = f64("saturation")
	o.Exposure = f64("exposure")
	o.Hue = f64("hue")
	o.Gamma = f64("gamma")
	o.Colorize = str("colorize")
	o.Sepia = f64("sepia")
	o.Invert = boolean("invert")
	o.Threshold = u32("threshold")
	o.Sharpen = f64("sharpen")
	o.OilPaint = u32("oilPaint")
	o.Quality = u32("quality")
	o.Progressive = boolean("progressive")
	if v, ok := ops["stripMetadata"]; ok {
		x := v.(bool)
		o.StripMetadata = &x
	}

	return o
}
