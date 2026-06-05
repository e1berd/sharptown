defmodule Sharptown.Error do
  @moduledoc """
  Error raised or returned by the Sharptown client.

  It is raised for invalid operations (validated before the request) and returned in an
  `{:error, %Sharptown.Error{}}` tuple for unsuccessful server responses.

  ## Fields

    * `:message` — human-readable description
    * `:status` — HTTP status or JSON-RPC/gRPC code, when the error came from the server
    * `:body` — parsed error body, when present
  """

  defexception [:message, :status, :body]

  @type t :: %__MODULE__{message: String.t(), status: integer() | nil, body: term()}

  @impl true
  def message(%__MODULE__{message: message}), do: message
end
