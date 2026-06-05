<?php

declare(strict_types=1);

namespace Sharptown\Client;

/**
 * Resolves a user-supplied base URL to a concrete scheme. The scheme is optional: a bare
 * `localhost:3001` is accepted and defaults to the secure variant. An explicit `http://` or
 * `ws://` selects the insecure variant; any other scheme is treated as secure. The transport
 * owns the protocol family (REST → `http`/`https`, JSON-RPC → `ws`/`wss`).
 */
final class Url
{
    /**
     * Resolves the base URL for the HTTP family (`http`/`https`).
     */
    public static function http(string $base): string
    {
        [$secure, $authority] = self::split($base);
        return ($secure ? 'https://' : 'http://') . $authority;
    }

    /**
     * Resolves the base URL for the WebSocket family (`ws`/`wss`).
     */
    public static function ws(string $base): string
    {
        [$secure, $authority] = self::split($base);
        return ($secure ? 'wss://' : 'ws://') . $authority;
    }

    /**
     * Splits a base URL into its security flag and scheme-less remainder. A `://` separates a
     * real scheme from a bare `host:port`, so `localhost:3001` is left untouched and reported
     * as secure.
     *
     * @return array{0: bool, 1: string} `[secure, authorityAndPath]`
     */
    private static function split(string $base): array
    {
        $trimmed = rtrim(trim($base), '/');
        if (preg_match('#^([a-z][a-z0-9+.\-]*)://#i', $trimmed, $match) === 1) {
            $scheme = strtolower($match[1]);
            $secure = !in_array($scheme, ['http', 'ws'], true);
            return [$secure, substr($trimmed, strlen($match[0]))];
        }
        return [true, $trimmed];
    }
}
