defmodule Sharptown.Transport.JSONRPC do
  @moduledoc """
  The JSON-RPC transport — calls `image.transform` over a WebSocket at `{base_url}/rpc`.
  The image travels base64-encoded; the result is decoded back to raw bytes, so the returned
  `Sharptown.Response` matches the REST transport's shape.

  The scheme is optional: a bare `localhost:3002` resolves to `wss://localhost:3002`. Without
  a scheme the secure variant is used; pass `ws` (or `http`) explicitly to opt out.
  """

  @behaviour Sharptown.Transport

  alias Sharptown.{Error, JSON, Operations, Response}
  alias Sharptown.Net.WebSocket

  @impl true
  def transform(request, opts) do
    path = Keyword.get(opts, :path, "/rpc")
    method = Keyword.get(opts, :method, "image.transform")

    payload = %{
      "jsonrpc" => "2.0",
      "id" => 1,
      "method" => method,
      "params" => %{
        "image" => Base.encode64(request.bytes),
        "options" => Operations.to_options(request.operations)
      }
    }

    url = ws_endpoint(request.base_url, path)

    case WebSocket.connect(url, request.headers, request.timeout) do
      {:ok, conn} ->
        result = call(conn, JSON.encode(payload))
        WebSocket.close(conn)
        result

      {:error, %Error{} = error} ->
        {:error, error}
    end
  end

  defp call(conn, json) do
    with :ok <- WebSocket.send_text(conn, json),
         {:ok, raw} <- WebSocket.receive_text(conn) do
      decode(raw)
    end
  end

  defp decode(raw) do
    case JSON.decode(raw) do
      {:ok, %{"error" => error}} ->
        {:error, %Error{message: error_message(error), status: error_code(error), body: error}}

      {:ok, %{"result" => %{"image" => image} = result}} ->
        case Base.decode64(image) do
          {:ok, bytes} ->
            content_type = Map.get(result, "contentType", "application/octet-stream")
            {:ok, %Response{status: 200, headers: %{"content-type" => content_type}, body: bytes}}

          :error ->
            {:error, %Error{message: "JSON-RPC result.image is not valid base64"}}
        end

      _ ->
        {:error, %Error{message: "Malformed JSON-RPC response"}}
    end
  end

  defp error_message(%{"message" => message}) when is_binary(message), do: message
  defp error_message(_), do: "JSON-RPC error"

  defp error_code(%{"code" => code}) when is_integer(code), do: code
  defp error_code(_), do: nil

  defp ws_endpoint(base_url, path) do
    base = Sharptown.URL.ws_base(base_url)
    if has_path?(base), do: base, else: base <> path
  end

  defp has_path?(url) do
    case URI.parse(url).path do
      nil -> false
      "" -> false
      "/" -> false
      _ -> true
    end
  end
end
