defmodule Sharptown.Transport do
  @moduledoc """
  Behaviour for a pluggable transport. Each implementation speaks one Sharptown protocol
  (REST, JSON-RPC, gRPC) but accepts the same canonical request.

  The request is a map with: `:base_url`, `:headers`, `:filename`, `:content_type`,
  `:bytes`, `:operations`, `:timeout`.
  """

  alias Sharptown.{Error, Response}

  @type request :: %{
          base_url: String.t(),
          headers: [{String.t(), String.t()}],
          filename: String.t(),
          content_type: String.t(),
          bytes: binary(),
          operations: map(),
          timeout: timeout()
        }

  @callback transform(request(), keyword()) :: {:ok, Response.t()} | {:error, Error.t()}
end
