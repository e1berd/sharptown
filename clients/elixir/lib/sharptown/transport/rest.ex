defmodule Sharptown.Transport.REST do
  @moduledoc """
  The REST transport — a `multipart/form-data` POST to `{base_url}/api/v1/transform` with
  operations in the query string. This is the default transport.
  """

  @behaviour Sharptown.Transport

  alias Sharptown.{Error, HTTP, JSON, Operations, Response}

  @impl true
  def transform(request, opts) do
    path = Keyword.get(opts, :path, "/api/v1/transform")
    field = Keyword.get(opts, :field, "image")

    {body, content_type} = multipart(field, request.filename, request.content_type, request.bytes)
    url = endpoint(request.base_url, path, Operations.to_query(request.operations))

    case HTTP.request(:post, url, request.headers, content_type, body, request.timeout) do
      {:ok, {status, headers, response_body}} when status in 200..299 ->
        {:ok, %Response{status: status, headers: headers, body: response_body}}

      {:ok, {status, _headers, response_body}} ->
        {:error, error_for(status, response_body)}

      {:error, reason} ->
        {:error, %Error{message: "HTTP request failed: #{inspect(reason)}"}}
    end
  end

  defp error_for(status, body) do
    message =
      case JSON.decode(body) do
        {:ok, %{"error" => error}} when is_binary(error) -> error
        _ -> "Sharptown request failed with status #{status}"
      end

    parsed = with {:ok, decoded} <- JSON.decode(body), do: decoded
    %Error{message: message, status: status, body: parsed}
  end

  defp multipart(field, filename, content_type, bytes) do
    boundary =
      "----SharptownBoundary" <> Base.encode16(:crypto.strong_rand_bytes(16), case: :lower)

    name = String.replace(filename, ["\"", "\r", "\n"], "")

    body =
      "--#{boundary}\r\n" <>
        ~s(Content-Disposition: form-data; name="#{field}"; filename="#{name}"\r\n) <>
        "Content-Type: #{content_type}\r\n\r\n" <>
        bytes <>
        "\r\n--#{boundary}--\r\n"

    {body, "multipart/form-data; boundary=#{boundary}"}
  end

  defp endpoint(base_url, path, ""), do: Sharptown.URL.http_base(base_url) <> path

  defp endpoint(base_url, path, query),
    do: Sharptown.URL.http_base(base_url) <> path <> "?" <> query
end
