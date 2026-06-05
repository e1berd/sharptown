defmodule Sharptown.JSON do
  @moduledoc false

  @spec encode(term()) :: binary()
  def encode(term), do: term |> :json.encode() |> IO.iodata_to_binary()

  @spec decode(binary()) :: {:ok, term()} | {:error, :invalid_json}
  def decode(binary) do
    {:ok, :json.decode(binary)}
  rescue
    _ -> {:error, :invalid_json}
  end
end
