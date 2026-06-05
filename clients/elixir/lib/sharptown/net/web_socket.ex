defmodule Sharptown.Net.WebSocket do
  @moduledoc """
  A minimal, dependency-free WebSocket client (RFC 6455) — enough to drive the Sharptown
  JSON-RPC endpoint: connect, send one text message, read one text reply. It handles the
  upgrade handshake, client-side masking, fragmented frames and ping/pong.
  """

  alias Sharptown.Error

  @guid "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

  @enforce_keys [:transport, :socket, :timeout]
  defstruct [:transport, :socket, :timeout]

  @type t :: %__MODULE__{transport: :tcp | :ssl, socket: term(), timeout: timeout()}

  @doc "Connects and performs the upgrade handshake."
  @spec connect(String.t(), [{String.t(), String.t()}], timeout()) ::
          {:ok, t()} | {:error, Error.t()}
  def connect(url, headers, timeout) do
    uri = URI.parse(url)
    {transport, default_port} = if uri.scheme == "wss", do: {:ssl, 443}, else: {:tcp, 80}
    host = to_charlist(uri.host)
    port = uri.port || default_port
    path = (uri.path || "/") <> if(uri.query, do: "?" <> uri.query, else: "")

    with {:ok, socket} <- open(transport, host, port, timeout) do
      conn = %__MODULE__{transport: transport, socket: socket, timeout: timeout}

      case handshake(conn, uri.host, port, path, headers) do
        :ok -> {:ok, conn}
        {:error, %Error{} = error} -> close(conn) && {:error, error}
      end
    end
  end

  @doc "Sends a text message as a single masked frame."
  @spec send_text(t(), binary()) :: :ok | {:error, Error.t()}
  def send_text(conn, message), do: write_frame(conn, 0x1, message)

  @doc "Reads frames until a complete text/binary message arrives, answering pings."
  @spec receive_text(t()) :: {:ok, binary()} | {:error, Error.t()}
  def receive_text(conn), do: receive_loop(conn, "")

  @doc "Sends a close frame and closes the socket."
  @spec close(t()) :: :ok
  def close(conn) do
    _ = write_frame(conn, 0x8, "")
    transport_close(conn)
    :ok
  end

  defp open(:tcp, host, port, timeout) do
    case :gen_tcp.connect(host, port, [:binary, active: false, packet: :http_bin], timeout) do
      {:ok, socket} -> {:ok, socket}
      {:error, reason} -> {:error, %Error{message: "Failed to connect: #{inspect(reason)}"}}
    end
  end

  defp open(:ssl, host, port, timeout) do
    {:ok, _} = Application.ensure_all_started(:ssl)

    opts = [
      :binary,
      active: false,
      packet: :http_bin,
      verify: :verify_none,
      server_name_indication: host
    ]

    case :ssl.connect(host, port, opts, timeout) do
      {:ok, socket} -> {:ok, socket}
      {:error, reason} -> {:error, %Error{message: "Failed to connect (TLS): #{inspect(reason)}"}}
    end
  end

  defp handshake(conn, host, port, path, headers) do
    key = Base.encode64(:crypto.strong_rand_bytes(16))

    extra = Enum.map_join(headers, "", fn {name, value} -> "#{name}: #{value}\r\n" end)

    request =
      "GET #{path} HTTP/1.1\r\n" <>
        "Host: #{host}:#{port}\r\n" <>
        "Upgrade: websocket\r\n" <>
        "Connection: Upgrade\r\n" <>
        "Sec-WebSocket-Key: #{key}\r\n" <>
        "Sec-WebSocket-Version: 13\r\n" <>
        extra <>
        "\r\n"

    with :ok <- transport_send(conn, request),
         {:ok, accept} <- read_handshake_response(conn) do
      expected = Base.encode64(:crypto.hash(:sha, key <> @guid))

      if accept == expected do
        :ok = transport_setopts(conn, packet: :raw)
        :ok
      else
        {:error, %Error{message: "WebSocket handshake failed: invalid Sec-WebSocket-Accept"}}
      end
    end
  end

  defp read_handshake_response(conn) do
    case transport_recv(conn, 0) do
      {:ok, {:http_response, _version, 101, _reason}} ->
        read_handshake_headers(conn, nil)

      {:ok, {:http_response, _version, status, reason}} ->
        {:error, %Error{message: "WebSocket handshake failed: #{status} #{reason}"}}

      {:error, reason} ->
        {:error, %Error{message: "WebSocket handshake read failed: #{inspect(reason)}"}}
    end
  end

  defp read_handshake_headers(conn, accept) do
    case transport_recv(conn, 0) do
      {:ok, :http_eoh} ->
        if accept,
          do: {:ok, accept},
          else: {:error, %Error{message: "WebSocket handshake missing Sec-WebSocket-Accept"}}

      {:ok, {:http_header, _, name, _, value}} ->
        if String.downcase(to_string(name)) == "sec-websocket-accept" do
          read_handshake_headers(conn, to_string(value))
        else
          read_handshake_headers(conn, accept)
        end

      {:error, reason} ->
        {:error, %Error{message: "WebSocket handshake read failed: #{inspect(reason)}"}}
    end
  end

  defp receive_loop(conn, acc) do
    case read_frame(conn) do
      {:ok, {0x8, _fin, _payload}} ->
        {:error, %Error{message: "WebSocket closed by server before a reply was received"}}

      {:ok, {0x9, _fin, payload}} ->
        with :ok <- write_frame(conn, 0xA, payload), do: receive_loop(conn, acc)

      {:ok, {0xA, _fin, _payload}} ->
        receive_loop(conn, acc)

      {:ok, {_opcode, true, payload}} ->
        {:ok, acc <> payload}

      {:ok, {_opcode, false, payload}} ->
        receive_loop(conn, acc <> payload)

      {:error, %Error{} = error} ->
        {:error, error}
    end
  end

  defp read_frame(conn) do
    with {:ok, <<fin::1, _rsv::3, opcode::4, mask_flag::1, len0::7>>} <- transport_recv(conn, 2),
         {:ok, length} <- frame_length(conn, len0),
         {:ok, mask} <- frame_mask(conn, mask_flag),
         {:ok, payload} <- frame_payload(conn, length) do
      {:ok, {opcode, fin == 1, unmask(payload, mask)}}
    end
  end

  defp frame_length(conn, 126),
    do: with({:ok, <<len::16>>} <- transport_recv(conn, 2), do: {:ok, len})

  defp frame_length(conn, 127),
    do: with({:ok, <<len::64>>} <- transport_recv(conn, 8), do: {:ok, len})

  defp frame_length(_conn, len0), do: {:ok, len0}

  defp frame_mask(conn, 1), do: transport_recv(conn, 4)
  defp frame_mask(_conn, 0), do: {:ok, ""}

  defp frame_payload(_conn, 0), do: {:ok, ""}
  defp frame_payload(conn, length), do: transport_recv(conn, length)

  defp unmask(payload, ""), do: payload

  defp unmask(payload, mask) do
    length = byte_size(payload)
    stream = binary_part(:binary.copy(mask, div(length, 4) + 1), 0, length)
    :crypto.exor(payload, stream)
  end

  defp write_frame(conn, opcode, payload) do
    length = byte_size(payload)

    length_part =
      cond do
        length < 126 -> <<1::1, length::7>>
        length <= 0xFFFF -> <<1::1, 126::7, length::16>>
        true -> <<1::1, 127::7, length::64>>
      end

    mask = :crypto.strong_rand_bytes(4)
    masked = unmask(payload, mask)
    frame = <<1::1, 0::3, opcode::4>> <> length_part <> mask <> masked
    transport_send(conn, frame)
  end

  defp transport_send(%{transport: :tcp, socket: socket}, data), do: :gen_tcp.send(socket, data)
  defp transport_send(%{transport: :ssl, socket: socket}, data), do: :ssl.send(socket, data)

  defp transport_recv(%{transport: :tcp, socket: socket, timeout: timeout}, length),
    do: :gen_tcp.recv(socket, length, timeout)

  defp transport_recv(%{transport: :ssl, socket: socket, timeout: timeout}, length),
    do: :ssl.recv(socket, length, timeout)

  defp transport_setopts(%{transport: :tcp, socket: socket}, opts),
    do: :inet.setopts(socket, opts)

  defp transport_setopts(%{transport: :ssl, socket: socket}, opts), do: :ssl.setopts(socket, opts)

  defp transport_close(%{transport: :tcp, socket: socket}), do: :gen_tcp.close(socket)
  defp transport_close(%{transport: :ssl, socket: socket}), do: :ssl.close(socket)
end
