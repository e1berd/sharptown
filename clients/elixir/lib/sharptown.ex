defmodule Sharptown do
  @moduledoc """
  Expressive, dependency-free Elixir client for the Sharptown image transformation API.

  One pipe-friendly API across all transports — REST (default), JSON-RPC, and gRPC
  (in progress). Build a client, start a transform, chain operations, and finish with a
  terminal.

  ## Example

      Sharptown.client("http://localhost:3001")
      |> Sharptown.transform("photo.jpg")
      |> Sharptown.resize(800, 600)
      |> Sharptown.blur(3)
      |> Sharptown.grayscale()
      |> Sharptown.convert(:webp)
      |> Sharptown.run()
      #=> {:ok, %Sharptown.Response{status: 200, ...}}

  ## Transports

      # REST (default)
      Sharptown.client("http://localhost:3001")

      # JSON-RPC over WebSocket
      Sharptown.client("ws://localhost:3002", transport: Sharptown.jsonrpc())
  """

  alias Sharptown.{Client, Error, Input, Operations, Response, Transform}

  @doc """
  Creates a client for `base_url`.

  ## Options

    * `:transport` — `{module, opts}`, defaults to `rest/1`
    * `:headers` — default headers sent with every request
    * `:timeout` — request timeout in milliseconds (default `30_000`)
  """
  @spec client(String.t(), keyword()) :: Client.t()
  def client(base_url, opts \\ []) when is_binary(base_url) do
    %Client{
      base_url: normalize_base_url(base_url),
      transport: Keyword.get(opts, :transport, rest()),
      headers: Keyword.get(opts, :headers, []),
      timeout: Keyword.get(opts, :timeout, 30_000)
    }
  end

  @doc "The REST transport (default)."
  @spec rest(keyword()) :: Client.transport()
  def rest(opts \\ []), do: {Sharptown.Transport.REST, opts}

  @doc "The JSON-RPC over WebSocket transport."
  @spec jsonrpc(keyword()) :: Client.transport()
  def jsonrpc(opts \\ []), do: {Sharptown.Transport.JSONRPC, opts}

  @doc """
  Starts a transform chain for an image.

  `input` is a path or URL string, an `%Sharptown.Input{}`, or one of the tuples
  `{:file, path}`, `{:url, url}`, `{:bytes, data}`, `{:bytes, data, filename}`.
  """
  @spec transform(Client.t(), term(), keyword()) :: Transform.t()
  def transform(%Client{} = client, input, opts \\ []) do
    %Transform{client: client, input: Input.from(input), filename: Keyword.get(opts, :filename)}
  end

  @doc "Resize. Pass `width` and optionally `height`."
  def resize(%Transform{} = t, width \\ nil, height \\ nil) do
    t
    |> maybe_put("width", width, &Operations.to_positive_int(&1, "width"))
    |> maybe_put("height", height, &Operations.to_positive_int(&1, "height"))
  end

  @doc "Sets the width only."
  def width(%Transform{} = t, value),
    do: put(t, "width", Operations.to_positive_int(value, "width"))

  @doc "Sets the height only."
  def height(%Transform{} = t, value),
    do: put(t, "height", Operations.to_positive_int(value, "height"))

  @doc "Crops a rectangle `(x, y, width, height)`."
  def crop(%Transform{} = t, x, y, w, h) do
    rect =
      [
        Operations.to_positive_int(x, "crop.x"),
        Operations.to_positive_int(y, "crop.y"),
        Operations.to_positive_int(w, "crop.width"),
        Operations.to_positive_int(h, "crop.height")
      ]
      |> Enum.join(",")

    put(t, "crop", rect)
  end

  @doc "Crops to the salient region when resizing."
  def smart_crop(%Transform{} = t, enabled \\ true), do: put(t, "smartCrop", boolean(enabled))

  @doc "Sets the resize fit mode: `cover`, `contain`, `fill`, `inside`, `outside`."
  def fit(%Transform{} = t, mode), do: put(t, "fit", Operations.assert_fit(to_string(mode)))

  @doc "Background colour for `fit: contain`."
  def background(%Transform{} = t, color), do: put(t, "background", to_string(color))

  @doc "Device pixel ratio; multiplies the target size."
  def dpr(%Transform{} = t, value), do: put(t, "dpr", Operations.to_range(value, "dpr", 0.1, 5))

  @doc "Target aspect ratio (width / height)."
  def aspect_ratio(%Transform{} = t, ratio),
    do: put(t, "aspectRatio", Operations.to_range(ratio, "aspectRatio", 0.0001, 1000))

  @doc "Rotates by EXIF orientation."
  def auto_orient(%Transform{} = t, enabled \\ true), do: put(t, "autoOrient", boolean(enabled))

  @doc "Rotates by the given degrees."
  def rotate(%Transform{} = t, degrees),
    do: put(t, "rotate", Operations.to_int(degrees, "rotate"))

  @doc "Flips horizontally."
  def flip(%Transform{} = t, enabled \\ true), do: put(t, "flip", boolean(enabled))

  @doc "Blurs by the given sigma/radius."
  def blur(%Transform{} = t, sigma \\ 1),
    do: put(t, "blur", Operations.to_positive_int(sigma, "blur"))

  @doc "Tints with `(r, g, b)`; pass `nil` to skip a channel (each 0–255)."
  def tint(%Transform{} = t, r, g \\ nil, b \\ nil) do
    t
    |> maybe_put("r", r, &Operations.to_color(&1, "r"))
    |> maybe_put("g", g, &Operations.to_color(&1, "g"))
    |> maybe_put("b", b, &Operations.to_color(&1, "b"))
  end

  @doc "Desaturates the image."
  def grayscale(%Transform{} = t, enabled \\ true), do: put(t, "grayscale", boolean(enabled))

  @doc "British alias of `grayscale/2`."
  def greyscale(%Transform{} = t, enabled \\ true), do: grayscale(t, enabled)

  @doc "Removes the alpha channel."
  def remove_alpha(%Transform{} = t, enabled \\ true), do: put(t, "removeAlpha", boolean(enabled))

  @doc "Ensures an alpha channel exists."
  def ensure_alpha(%Transform{} = t, enabled \\ true), do: put(t, "ensureAlpha", boolean(enabled))

  @doc "Adjusts brightness, `-100`–`100`."
  def brightness(%Transform{} = t, value),
    do: put(t, "brightness", Operations.to_range(value, "brightness", -100, 100))

  @doc "Adjusts contrast, `-100`–`100`."
  def contrast(%Transform{} = t, value),
    do: put(t, "contrast", Operations.to_range(value, "contrast", -100, 100))

  @doc "Adjusts saturation, `0`–`2`."
  def saturation(%Transform{} = t, value),
    do: put(t, "saturation", Operations.to_range(value, "saturation", 0, 2))

  @doc "Adjusts exposure in EV stops, `-3`–`3`."
  def exposure(%Transform{} = t, value),
    do: put(t, "exposure", Operations.to_range(value, "exposure", -3, 3))

  @doc "Rotates hue in degrees, `0`–`360`."
  def hue(%Transform{} = t, value), do: put(t, "hue", Operations.to_range(value, "hue", 0, 360))

  @doc "Gamma correction, `1.0`–`3.0`."
  def gamma(%Transform{} = t, value),
    do: put(t, "gamma", Operations.to_range(value, "gamma", 1, 3))

  @doc "Maps the image to shades of one colour."
  def colorize(%Transform{} = t, color), do: put(t, "colorize", to_string(color))

  @doc "Applies a sepia tone, `0`–`1`."
  def sepia(%Transform{} = t, intensity \\ 1),
    do: put(t, "sepia", Operations.to_range(intensity, "sepia", 0, 1))

  @doc "Inverts colours."
  def invert(%Transform{} = t, enabled \\ true), do: put(t, "invert", boolean(enabled))

  @doc "Binarises the image at a threshold, `0`–`255`."
  def threshold(%Transform{} = t, value),
    do: put(t, "threshold", Operations.to_range(value, "threshold", 0, 255))

  @doc "Sharpens the image. Pass `nil` for the default, or a sigma `0`–`5`."
  def sharpen(transform, sigma \\ nil)
  def sharpen(%Transform{} = t, nil), do: put(t, "sharpen", true)

  def sharpen(%Transform{} = t, sigma),
    do: put(t, "sharpen", Operations.to_range(sigma, "sharpen", 0, 5))

  @doc "Oil-paint effect; the value is the window size, `1`–`25`."
  def oil_paint(%Transform{} = t, size \\ 3),
    do: put(t, "oilPaint", Operations.to_range(size, "oilPaint", 1, 25))

  @doc "Output quality `1`–`100` (applies with `convert/2`)."
  def quality(%Transform{} = t, value),
    do: put(t, "quality", Operations.to_range(value, "quality", 1, 100))

  @doc "Progressive (interlaced) output when re-encoding."
  def progressive(%Transform{} = t, enabled \\ true), do: put(t, "progressive", boolean(enabled))

  @doc "Strips EXIF/metadata (the default). Pass `false` to keep it."
  def strip_metadata(%Transform{} = t, enabled \\ true),
    do: put(t, "stripMetadata", boolean(enabled))

  @doc "Converts to a format (`:webp`, `:png`, `:jpg`, `:jpeg`, `:avif`, `:gif`, `:heif`)."
  def convert(%Transform{} = t, format),
    do: put(t, "convertTo", Operations.assert_format(to_string(format)))

  @doc "Alias of `convert/2`."
  def to_format(%Transform{} = t, format), do: convert(t, format)

  @doc "Runs the request and returns `{:ok, %Sharptown.Response{}}` or `{:error, %Sharptown.Error{}}`."
  @spec run(Transform.t()) :: {:ok, Response.t()} | {:error, Error.t()}
  def run(%Transform{} = t) do
    with {:ok, {bytes, filename, content_type}} <- Input.resolve(t.input, t.client.timeout) do
      {module, opts} = t.client.transport

      request = %{
        base_url: t.client.base_url,
        headers: t.client.headers,
        timeout: t.client.timeout,
        filename: t.filename || filename,
        content_type: content_type,
        bytes: bytes,
        operations: t.ops
      }

      module.transform(request, opts)
    end
  end

  @doc "Like `run/1`, but returns the `%Sharptown.Response{}` or raises `Sharptown.Error`."
  @spec run!(Transform.t()) :: Response.t()
  def run!(%Transform{} = t) do
    case run(t) do
      {:ok, response} -> response
      {:error, error} -> raise error
    end
  end

  @doc "Runs the request and returns `{:ok, bytes}` or `{:error, %Sharptown.Error{}}`."
  @spec bytes(Transform.t()) :: {:ok, binary()} | {:error, Error.t()}
  def bytes(%Transform{} = t) do
    with {:ok, response} <- run(t), do: {:ok, response.body}
  end

  @doc "Like `bytes/1`, but returns the bytes or raises."
  @spec bytes!(Transform.t()) :: binary()
  def bytes!(%Transform{} = t), do: run!(t).body

  @doc "Runs the request and writes the result to `path`. Returns `{:ok, path}` or `{:error, ...}`."
  @spec to_file(Transform.t(), Path.t()) :: {:ok, Path.t()} | {:error, term()}
  def to_file(%Transform{} = t, path) do
    with {:ok, response} <- run(t),
         :ok <- Response.to_file(response, path) do
      {:ok, path}
    end
  end

  @doc "Like `to_file/2`, but returns the path or raises."
  @spec to_file!(Transform.t(), Path.t()) :: Path.t()
  def to_file!(%Transform{} = t, path) do
    response = run!(t)

    case Response.to_file(response, path) do
      :ok -> path
      {:error, reason} -> raise Error, message: "Failed to write file #{path}: #{inspect(reason)}"
    end
  end

  defp put(%Transform{ops: ops} = t, key, value), do: %{t | ops: Map.put(ops, key, value)}

  defp maybe_put(t, _key, nil, _fun), do: t
  defp maybe_put(t, key, value, fun), do: put(t, key, fun.(value))

  defp boolean(value) when is_boolean(value), do: value
  defp boolean(value), do: !!value

  defp normalize_base_url(url) do
    case url |> String.trim() |> String.trim_trailing("/") do
      "" -> raise Error, message: "client/2: base_url must be a non-empty string"
      trimmed -> trimmed
    end
  end
end
