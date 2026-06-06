defmodule Sharptown.Textmark do
  @moduledoc """
  A text overlay composited onto the result, rendered server-side. Pass it to
  `Sharptown.composite/2`.

  ## Example

      Sharptown.Textmark.new("© Acme")
      |> Sharptown.Textmark.size(48)
      |> Sharptown.Textmark.color("white")
      |> Sharptown.Textmark.tile()
  """

  defstruct spec: %{"type" => "text"}

  @type t :: %__MODULE__{spec: map()}

  @doc "Creates a text watermark."
  def new(text) when is_binary(text), do: %__MODULE__{spec: %{"type" => "text", "text" => text}}

  @doc "Font size in pixels."
  def size(%__MODULE__{} = m, value), do: put(m, "size", value)

  @doc "Text colour (any CSS colour)."
  def color(%__MODULE__{} = m, value), do: put(m, "color", value)

  @doc "Font family."
  def font(%__MODULE__{} = m, value), do: put(m, "font", value)

  @doc "Font weight (e.g. `bold`)."
  def weight(%__MODULE__{} = m, value), do: put(m, "weight", value)

  @doc "Background colour painted behind the text tile."
  def background(%__MODULE__{} = m, value), do: put(m, "background", value)

  @doc "Rotates the text by degrees."
  def rotate(%__MODULE__{} = m, degrees), do: put(m, "rotate", degrees)

  @doc "Text opacity (0–1)."
  def opacity(%__MODULE__{} = m, value), do: put(m, "opacity", value)

  @doc "Placement gravity."
  def gravity(%__MODULE__{} = m, value), do: put(m, "gravity", value)

  @doc "Places the text at `(x, y)` from the top-left."
  def offset(%__MODULE__{} = m, x, y), do: m |> put("x", x) |> put("y", y)

  @doc "Repeats the text across the whole image."
  def tile(%__MODULE__{} = m, enabled \\ true), do: put(m, "tile", enabled)

  @doc false
  def resolve(%__MODULE__{spec: spec}), do: {spec, nil}

  defp put(%__MODULE__{spec: spec} = m, key, value), do: %{m | spec: Map.put(spec, key, value)}
end
