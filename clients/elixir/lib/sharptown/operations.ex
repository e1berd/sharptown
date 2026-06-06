defmodule Sharptown.Operations do
  @moduledoc """
  Operation validation, the canonical option set, and per-transport serialization.

  Option keys match `@sharptown/core` — the same names used by the REST query string and
  the JSON-RPC `options` object. Each transport translates this canonical set into its own
  wire format.
  """

  alias Sharptown.Error

  @supported_formats ~w(webp png jpg jpeg avif gif heif)
  @fit_modes ~w(cover contain fill inside outside)

  @order ~w(
    width height dpr aspectRatio fit background smartCrop crop cropOffset trim chromaKey
    composite autoOrient rotate flip blur sharpen oilPaint brightness contrast saturation
    exposure hue gamma colorize sepia invert threshold r g b grayscale removeAlpha
    ensureAlpha convertTo quality progressive stripMetadata
  )

  @doc "Output formats supported by the server."
  def supported_formats, do: @supported_formats

  @doc "Resize fit modes."
  def fit_modes, do: @fit_modes

  @doc "Coerces a value to an integer, raising `Sharptown.Error` on invalid input."
  @spec to_int(term(), String.t()) :: integer()
  def to_int(value, _field) when is_integer(value), do: value
  def to_int(value, _field) when is_float(value) and value == trunc(value), do: trunc(value)

  def to_int(value, field) when is_binary(value) do
    case Integer.parse(value) do
      {int, ""} -> int
      _ -> raise_invalid(field, "an integer", value)
    end
  end

  def to_int(value, field), do: raise_invalid(field, "an integer", value)

  @doc "Coerces a value to a finite number, raising `Sharptown.Error` on invalid input."
  @spec to_number(term(), String.t()) :: number()
  def to_number(value, _field) when is_integer(value), do: value
  def to_number(value, _field) when is_float(value), do: value

  def to_number(value, field) when is_binary(value) do
    case Float.parse(value) do
      {num, ""} -> num
      _ -> raise_invalid(field, "a number", value)
    end
  end

  def to_number(value, field), do: raise_invalid(field, "a number", value)

  @doc "A number constrained to an inclusive range."
  @spec to_range(term(), String.t(), number(), number()) :: number()
  def to_range(value, field, min, max) do
    parsed = to_number(value, field)

    if parsed < min or parsed > max do
      raise Error,
        message:
          "Invalid #{field}: expected #{format_number(min)}–#{format_number(max)}, got #{format_number(parsed)}"
    end

    parsed
  end

  @doc "An integer in the [0, 255] range — for tint colour channels."
  @spec to_color(term(), String.t()) :: integer()
  def to_color(value, field) do
    parsed = to_int(value, field)

    if parsed < 0 or parsed > 255 do
      raise Error, message: "Invalid #{field}: expected 0-255, got #{parsed}"
    end

    parsed
  end

  @doc "A non-negative integer — for sizes and radii."
  @spec to_positive_int(term(), String.t()) :: non_neg_integer()
  def to_positive_int(value, field) do
    parsed = to_int(value, field)

    if parsed < 0 do
      raise Error, message: "Invalid #{field}: expected a non-negative integer, got #{parsed}"
    end

    parsed
  end

  @doc "Asserts that a format is supported by the server."
  @spec assert_format(String.t()) :: String.t()
  def assert_format(format) when format in @supported_formats, do: format

  def assert_format(format) do
    raise Error,
      message:
        ~s(Unsupported format "#{format}". Supported: #{Enum.join(@supported_formats, ", ")})
  end

  @doc "Asserts that a fit mode is supported by the server."
  @spec assert_fit(String.t()) :: String.t()
  def assert_fit(fit) when fit in @fit_modes, do: fit

  def assert_fit(fit) do
    raise Error, message: ~s(Unsupported fit "#{fit}". Supported: #{Enum.join(@fit_modes, ", ")})
  end

  @doc """
  Serializes canonical operations into a REST query string.

  ## Examples

      iex> Sharptown.Operations.to_query(%{"width" => 500, "convertTo" => "webp"})
      "width=500&convertTo=webp"
  """
  @spec to_query(map()) :: String.t()
  def to_query(ops) do
    @order
    |> Enum.flat_map(fn key ->
      case Map.fetch(ops, key) do
        {:ok, value} when value != nil ->
          [URI.encode_www_form(key) <> "=" <> URI.encode_www_form(stringify(value))]

        _ ->
          []
      end
    end)
    |> Enum.join("&")
  end

  @doc "Returns the canonical operations as a JSON-RPC `options` map (already set keys only)."
  @spec to_options(map()) :: map()
  def to_options(ops), do: ops

  @doc """
  Returns the set operations as stringified `key => value` pairs, matching the values the
  server receives as query parameters. Used to build the signed image-proxy URL.
  """
  @spec to_params(map()) :: %{optional(String.t()) => String.t()}
  def to_params(ops) do
    @order
    |> Enum.flat_map(fn key ->
      case Map.fetch(ops, key) do
        {:ok, value} when value != nil -> [{key, stringify(value)}]
        _ -> []
      end
    end)
    |> Map.new()
  end

  defp stringify(value) when is_boolean(value), do: if(value, do: "true", else: "false")
  defp stringify(value) when is_integer(value), do: Integer.to_string(value)
  defp stringify(value) when is_float(value), do: format_number(value)
  defp stringify(value) when is_binary(value), do: value

  defp format_number(value) when is_integer(value), do: Integer.to_string(value)

  defp format_number(value) when is_float(value) do
    if value == trunc(value),
      do: Integer.to_string(trunc(value)),
      else: :erlang.float_to_binary(value, [:short])
  end

  defp raise_invalid(field, expected, value) do
    raise Error, message: "Invalid #{field}: expected #{expected}, got #{inspect(value)}"
  end
end
