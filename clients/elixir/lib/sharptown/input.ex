defmodule Sharptown.Input do
  @moduledoc """
  A deferred image source, resolved to raw bytes at request time.

  A bare binary passed to `from/1` is treated as an `http(s)` URL or an existing file path —
  never as raw image bytes. For in-memory bytes use `from_bytes/2`.
  """

  alias Sharptown.{Error, HTTP}

  @enforce_keys [:kind, :source]
  defstruct [:kind, :source, :filename]

  @type t :: %__MODULE__{
          kind: :path | :bytes | :url,
          source: binary(),
          filename: String.t() | nil
        }

  @content_types %{
    "jpg" => "image/jpeg",
    "jpeg" => "image/jpeg",
    "png" => "image/png",
    "webp" => "image/webp",
    "gif" => "image/gif",
    "avif" => "image/avif",
    "heif" => "image/heif",
    "heic" => "image/heif",
    "tif" => "image/tiff",
    "tiff" => "image/tiff",
    "bmp" => "image/bmp",
    "svg" => "image/svg+xml"
  }

  @doc "An image read from a file path."
  def from_path(path, filename \\ nil),
    do: %__MODULE__{kind: :path, source: path, filename: filename}

  @doc "An image from raw bytes already in memory."
  def from_bytes(bytes, filename \\ "image"),
    do: %__MODULE__{kind: :bytes, source: bytes, filename: filename}

  @doc "An image fetched from an `http(s)` URL."
  def from_url(url, filename \\ nil), do: %__MODULE__{kind: :url, source: url, filename: filename}

  @doc """
  Normalizes any accepted input into an `t:t/0`.

  Accepts an existing `%Sharptown.Input{}`, a bare string (URL or file path), or the tuples
  `{:file, path}`, `{:url, url}`, `{:bytes, data}`, `{:bytes, data, filename}`.
  """
  def from(%__MODULE__{} = input), do: input
  def from({:file, path}), do: from_path(path)
  def from({:url, url}), do: from_url(url)
  def from({:bytes, bytes}), do: from_bytes(bytes)
  def from({:bytes, bytes, filename}), do: from_bytes(bytes, filename)

  def from(input) when is_binary(input) do
    cond do
      Regex.match?(~r/^https?:\/\//i, input) ->
        from_url(input)

      File.exists?(input) ->
        from_path(input)

      true ->
        raise Error,
          message:
            ~s|transform/2: "#{input}" is not an http(s) URL or an existing file. For raw bytes use {:bytes, data}.|
    end
  end

  @doc """
  Reads the source into `{bytes, filename, content_type}`.
  """
  @spec resolve(t(), timeout()) :: {:ok, {binary(), String.t(), String.t()}} | {:error, Error.t()}
  def resolve(input, timeout \\ 30_000)

  def resolve(%__MODULE__{kind: :bytes, source: bytes, filename: filename}, _timeout) do
    name = filename || "image"
    {:ok, {bytes, name, content_type_for(name)}}
  end

  def resolve(%__MODULE__{kind: :path, source: path, filename: filename}, _timeout) do
    case File.read(path) do
      {:ok, bytes} ->
        name = filename || Path.basename(path)
        {:ok, {bytes, name, content_type_for(name)}}

      {:error, reason} ->
        {:error, %Error{message: "Failed to read image file #{path}: #{inspect(reason)}"}}
    end
  end

  def resolve(%__MODULE__{kind: :url, source: url, filename: filename}, timeout) do
    case HTTP.request(:get, url, [], nil, nil, timeout) do
      {:ok, {status, headers, body}} when status in 200..299 ->
        name = filename || url |> URI.parse() |> Map.get(:path) |> basename_or_default()
        content_type = Map.get(headers, "content-type") || content_type_for(name)
        {:ok, {body, name, content_type}}

      {:ok, {status, _headers, _body}} ->
        {:error, %Error{message: "Failed to fetch input from #{url}: #{status}", status: status}}

      {:error, reason} ->
        {:error, %Error{message: "Failed to fetch input from #{url}: #{inspect(reason)}"}}
    end
  end

  defp basename_or_default(nil), do: "image"

  defp basename_or_default(path) do
    case Path.basename(path) do
      "" -> "image"
      name -> name
    end
  end

  defp content_type_for(filename) do
    extension = filename |> Path.extname() |> String.trim_leading(".") |> String.downcase()
    Map.get(@content_types, extension, "application/octet-stream")
  end
end
