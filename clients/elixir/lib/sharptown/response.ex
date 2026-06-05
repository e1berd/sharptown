defmodule Sharptown.Response do
  @moduledoc """
  The result of a transform: the image bytes plus the response status and headers.
  Returned by `Sharptown.run/1` for every transport.
  """

  @enforce_keys [:status, :headers, :body]
  defstruct [:status, :headers, :body]

  @type t :: %__MODULE__{
          status: non_neg_integer(),
          headers: %{String.t() => String.t()},
          body: binary()
        }

  @doc "Whether the status is in the 2xx range."
  @spec ok?(t()) :: boolean()
  def ok?(%__MODULE__{status: status}), do: status in 200..299

  @doc "Fetches a response header by case-insensitive name."
  @spec header(t(), String.t()) :: String.t() | nil
  def header(%__MODULE__{headers: headers}, name), do: Map.get(headers, String.downcase(name))

  @doc "The `content-type` header, if present."
  @spec content_type(t()) :: String.t() | nil
  def content_type(%__MODULE__{} = response), do: header(response, "content-type")

  @doc "Writes the body to a file. Returns `:ok` or `{:error, reason}`."
  @spec to_file(t(), Path.t()) :: :ok | {:error, File.posix()}
  def to_file(%__MODULE__{body: body}, path), do: File.write(path, body)
end
