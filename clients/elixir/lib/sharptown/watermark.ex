defmodule Sharptown.Watermark do
  @moduledoc """
  An image overlay composited onto the result. Build it from a URL the server fetches
  (`url/1`), or from local bytes/a file uploaded with the request (`bytes/1`, `file/1`),
  then pipe through the placement and appearance functions.

  ## Example

      Sharptown.Watermark.url("https://cdn.example.com/logo.png")
      |> Sharptown.Watermark.resize(120)
      |> Sharptown.Watermark.opacity(0.6)
      |> Sharptown.Watermark.gravity("southeast")
  """

  defstruct spec: %{"type" => "image"}, bytes: nil

  @type t :: %__MODULE__{spec: map(), bytes: binary() | nil}

  @doc "An image watermark fetched from `url` by the server."
  def url(url) when is_binary(url), do: %__MODULE__{spec: %{"type" => "image", "url" => url}}

  @doc "An image watermark uploaded from raw bytes."
  def bytes(data) when is_binary(data), do: %__MODULE__{spec: %{"type" => "image"}, bytes: data}

  @doc "An image watermark uploaded from a local file path."
  def file(path), do: bytes(File.read!(path))

  @doc "Fits the overlay inside `width`×`height`. Either dimension is optional."
  def resize(%__MODULE__{} = w, width, height \\ nil) do
    w |> maybe_put("width", width) |> maybe_put("height", height)
  end

  @doc "Sets the overlay width only."
  def width(%__MODULE__{} = w, value), do: put(w, "width", value)

  @doc "Sets the overlay height only."
  def height(%__MODULE__{} = w, value), do: put(w, "height", value)

  @doc "Rotates the overlay by degrees."
  def rotate(%__MODULE__{} = w, degrees), do: put(w, "rotate", degrees)

  @doc "Sets the overlay opacity (0–1)."
  def opacity(%__MODULE__{} = w, value), do: put(w, "opacity", value)

  @doc "Sets the placement gravity (default `southeast`)."
  def gravity(%__MODULE__{} = w, value), do: put(w, "gravity", value)

  @doc "Places the overlay at `(x, y)` from the top-left instead of a gravity."
  def offset(%__MODULE__{} = w, x, y), do: w |> put("x", x) |> put("y", y)

  @doc "Repeats the overlay across the whole image."
  def tile(%__MODULE__{} = w, enabled \\ true), do: put(w, "tile", enabled)

  @doc "Sets the Sharp blend mode (default `over`)."
  def blend(%__MODULE__{} = w, mode), do: put(w, "blend", mode)

  @doc false
  def resolve(%__MODULE__{spec: spec, bytes: bytes}), do: {spec, bytes}

  defp put(%__MODULE__{spec: spec} = w, key, value), do: %{w | spec: Map.put(spec, key, value)}
  defp maybe_put(w, _key, nil), do: w
  defp maybe_put(w, key, value), do: put(w, key, value)
end
