<?php

declare(strict_types=1);

namespace Sharptown\Client\Net;

use Sharptown\Client\SharptownError;

/**
 * A minimal, dependency-free WebSocket client (RFC 6455) — just enough to drive the
 * Sharptown JSON-RPC endpoint: connect, send one text message, read one text reply.
 *
 * It handles the upgrade handshake, client-side masking, fragmented frames and ping/pong.
 */
final class WebSocketClient
{
    private const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

    /** @var resource */
    private $socket;

    /**
     * @param array<string, string> $headers Extra handshake headers (e.g. authorization).
     */
    public function __construct(string $url, array $headers = [], int $timeout = 30)
    {
        $parts = parse_url($url);
        if ($parts === false || !isset($parts['host'])) {
            throw new SharptownError(sprintf('Invalid WebSocket URL: %s', $url));
        }

        $scheme = strtolower($parts['scheme'] ?? 'ws');
        $secure = $scheme === 'wss';
        $host = $parts['host'];
        $port = $parts['port'] ?? ($secure ? 443 : 80);
        $path = ($parts['path'] ?? '/') . (isset($parts['query']) ? '?' . $parts['query'] : '');

        $this->socket = $this->openSocket($secure, $host, $port, $timeout);
        try {
            $this->handshake($host, $port, $path, $headers);
        } catch (\Throwable $error) {
            if (is_resource($this->socket)) {
                fclose($this->socket);
            }
            throw $error;
        }
    }

    /**
     * Sends a text message as a single masked frame.
     */
    public function send(string $message): void
    {
        $this->writeFrame(0x1, $message);
    }

    /**
     * Reads frames until a complete text/binary message arrives, answering pings along the
     * way. Returns the message payload.
     */
    public function receive(): string
    {
        $data = '';
        while (true) {
            [$opcode, $fin, $payload] = $this->readFrame();

            if ($opcode === 0x8) {
                throw new SharptownError('WebSocket closed by server before a reply was received');
            }
            if ($opcode === 0x9) {
                $this->writeFrame(0xA, $payload);
                continue;
            }
            if ($opcode === 0xA) {
                continue;
            }

            $data .= $payload;
            if ($fin) {
                return $data;
            }
        }
    }

    public function close(): void
    {
        if (is_resource($this->socket)) {
            @$this->writeFrame(0x8, '');
            fclose($this->socket);
        }
    }

    /**
     * @return resource
     */
    private function openSocket(bool $secure, string $host, int $port, int $timeout)
    {
        $transport = $secure ? 'ssl' : 'tcp';
        $remote = sprintf('%s://%s:%d', $transport, $host, $port);
        $socket = @stream_socket_client($remote, $errno, $errstr, $timeout);
        if ($socket === false) {
            throw new SharptownError(sprintf('Failed to connect to %s: %s', $remote, $errstr ?: "errno $errno"));
        }
        stream_set_timeout($socket, $timeout);
        return $socket;
    }

    /**
     * @param array<string, string> $headers
     */
    private function handshake(string $host, int $port, string $path, array $headers): void
    {
        $key = base64_encode(random_bytes(16));
        $lines = [
            sprintf('GET %s HTTP/1.1', $path),
            sprintf('Host: %s:%d', $host, $port),
            'Upgrade: websocket',
            'Connection: Upgrade',
            sprintf('Sec-WebSocket-Key: %s', $key),
            'Sec-WebSocket-Version: 13',
        ];
        foreach ($headers as $name => $value) {
            $lines[] = $name . ': ' . $value;
        }
        $this->writeAll(implode("\r\n", $lines) . "\r\n\r\n");

        $statusLine = $this->readLine();
        if (!preg_match('#^HTTP/1\.1 101#', $statusLine)) {
            throw new SharptownError(sprintf('WebSocket handshake failed: %s', trim($statusLine)));
        }

        $accept = null;
        while (($line = $this->readLine()) !== "\r\n" && $line !== '') {
            $parts = explode(':', $line, 2);
            if (count($parts) === 2 && strtolower(trim($parts[0])) === 'sec-websocket-accept') {
                $accept = trim($parts[1]);
            }
        }

        $expected = base64_encode(sha1($key . self::GUID, true));
        if ($accept !== $expected) {
            throw new SharptownError('WebSocket handshake failed: invalid Sec-WebSocket-Accept');
        }
    }

    private function writeFrame(int $opcode, string $payload): void
    {
        $frame = chr(0x80 | $opcode);
        $length = strlen($payload);

        if ($length < 126) {
            $frame .= chr(0x80 | $length);
        } elseif ($length <= 0xFFFF) {
            $frame .= chr(0x80 | 126) . pack('n', $length);
        } else {
            $frame .= chr(0x80 | 127) . pack('J', $length);
        }

        $mask = random_bytes(4);
        $frame .= $mask;
        $frame .= $payload ^ str_repeat($mask, intdiv($length, 4) + 1);

        $this->writeAll($frame);
    }

    /**
     * @return array{0: int, 1: bool, 2: string}
     */
    private function readFrame(): array
    {
        $header = $this->readExactly(2);
        $byte0 = ord($header[0]);
        $byte1 = ord($header[1]);

        $fin = ($byte0 & 0x80) !== 0;
        $opcode = $byte0 & 0x0F;
        $masked = ($byte1 & 0x80) !== 0;
        $length = $byte1 & 0x7F;

        if ($length === 126) {
            $length = unpack('n', $this->readExactly(2))[1];
        } elseif ($length === 127) {
            $length = unpack('J', $this->readExactly(8))[1];
        }

        $mask = $masked ? $this->readExactly(4) : '';
        $payload = $length > 0 ? $this->readExactly($length) : '';

        if ($masked && $length > 0) {
            $payload ^= str_repeat($mask, intdiv($length, 4) + 1);
        }

        return [$opcode, $fin, $payload];
    }

    private function readExactly(int $bytes): string
    {
        $buffer = '';
        while (strlen($buffer) < $bytes) {
            $chunk = fread($this->socket, $bytes - strlen($buffer));
            if ($chunk === false || $chunk === '') {
                if ($this->timedOut()) {
                    throw new SharptownError('WebSocket read timed out');
                }
                throw new SharptownError('WebSocket connection closed unexpectedly');
            }
            $buffer .= $chunk;
        }
        return $buffer;
    }

    private function readLine(): string
    {
        $line = fgets($this->socket);
        if ($line === false) {
            if ($this->timedOut()) {
                throw new SharptownError('WebSocket handshake read timed out');
            }
            throw new SharptownError('WebSocket connection closed during handshake');
        }
        return $line;
    }

    private function writeAll(string $data): void
    {
        $total = strlen($data);
        $written = 0;
        while ($written < $total) {
            $count = fwrite($this->socket, substr($data, $written));
            if ($count === false || $count === 0) {
                throw new SharptownError('Failed to write to WebSocket');
            }
            $written += $count;
        }
    }

    private function timedOut(): bool
    {
        $meta = stream_get_meta_data($this->socket);
        return (bool) ($meta['timed_out'] ?? false);
    }
}
