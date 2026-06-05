defmodule Sharptown.Client do
  @moduledoc """
  A Sharptown client: a base URL plus a chosen transport, default headers and timeout.
  Build one with `Sharptown.client/2`.
  """

  @enforce_keys [:base_url, :transport]
  defstruct [:base_url, :transport, headers: [], timeout: 30_000]

  @type transport :: {module(), keyword()}
  @type t :: %__MODULE__{
          base_url: String.t(),
          transport: transport(),
          headers: [{String.t(), String.t()}],
          timeout: timeout()
        }
end
