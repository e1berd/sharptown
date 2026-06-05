defmodule Sharptown.HTTP do
  @moduledoc false

  @type method :: :get | :post
  @type header :: {String.t(), String.t()}
  @type result ::
          {:ok, {non_neg_integer(), %{String.t() => String.t()}, binary()}} | {:error, term()}

  @spec request(method(), String.t(), [header()], String.t() | nil, binary() | nil, timeout()) ::
          result()
  def request(method, url, headers, content_type, body, timeout) do
    ensure_started()

    request =
      case method do
        :get ->
          {to_charlist(url), to_headers(headers)}

        _ ->
          {to_charlist(url), to_headers(headers),
           to_charlist(content_type || "application/octet-stream"), body || ""}
      end

    http_options = [timeout: timeout, connect_timeout: timeout, autoredirect: true]
    options = [body_format: :binary]

    case :httpc.request(method, request, http_options, options) do
      {:ok, {{_version, status, _reason}, response_headers, response_body}} ->
        {:ok, {status, normalize_headers(response_headers), response_body}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp ensure_started do
    {:ok, _} = Application.ensure_all_started(:inets)
    {:ok, _} = Application.ensure_all_started(:ssl)
    :ok
  end

  defp to_headers(headers) do
    Enum.map(headers, fn {name, value} -> {to_charlist(name), to_charlist(value)} end)
  end

  defp normalize_headers(headers) do
    Map.new(headers, fn {name, value} ->
      {name |> to_string() |> String.downcase(), to_string(value)}
    end)
  end
end
