defmodule Sharptown.URL do
  @moduledoc """
  Resolves a user-supplied base URL to a concrete scheme. The scheme is optional: a bare
  `localhost:3001` is accepted and defaults to the secure variant. An explicit `http`/`ws`
  selects the insecure variant; any other scheme is treated as secure. The transport owns
  the protocol family (REST → `http`/`https`, JSON-RPC → `ws`/`wss`).
  """

  @scheme ~r{^([a-zA-Z][a-zA-Z0-9+.\-]*)://}

  @doc "Resolves the base URL for the HTTP family (`http`/`https`)."
  @spec http_base(String.t()) :: String.t()
  def http_base(base), do: with_scheme(base, "https://", "http://")

  @doc "Resolves the base URL for the WebSocket family (`ws`/`wss`)."
  @spec ws_base(String.t()) :: String.t()
  def ws_base(base), do: with_scheme(base, "wss://", "ws://")

  defp with_scheme(base, secure, insecure) do
    trimmed = base |> String.trim() |> String.trim_trailing("/")

    case Regex.run(@scheme, trimmed) do
      [match, scheme] ->
        authority = String.replace_prefix(trimmed, match, "")
        prefix = if String.downcase(scheme) in ["http", "ws"], do: insecure, else: secure
        prefix <> authority

      nil ->
        secure <> trimmed
    end
  end
end
