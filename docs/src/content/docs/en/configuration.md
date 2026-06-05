---
title: Configuration
description: Environment variables and ports for every server host.
group: Introduction
order: 4
---

# Configuration

Every server host is configured through environment variables, loaded from a `.env` file
at the repo root (`node --env-file=.env`). Copy the example to start:

```bash
cp .env.example .env
```

## Environment variables

| Variable | Default | Used by | Description |
| -------- | ------- | ------- | ----------- |
| `SHARPTOWN_PORT` | `3001` | REST | REST server port. |
| `SHARPTOWN_HOST` | `localhost` | REST | REST server bind address. |
| `SHARPTOWN_GRPC_PORT` | `50051` | gRPC | gRPC server port. |
| `SHARPTOWN_GRPC_HOST` | `0.0.0.0` | gRPC | gRPC server bind address. |
| `SHARPTOWN_JSONRPC_PORT` | `3002` | JSON-RPC | WebSocket server port. |
| `SHARPTOWN_JSONRPC_HOST` | `localhost` | JSON-RPC | WebSocket server bind address. |
| `SHARPTOWN_PROXY_KEY` | _(empty)_ | REST | HMAC secret for the [signed image proxy](/docs/image-proxy). Empty disables the proxy. |
| `SHARPTOWN_PROXY_ALLOWED_HOSTS` | `*` | REST | Comma-separated source-host allowlist; `*` allows any public host. Private/loopback addresses are always blocked. |
| `SHARPTOWN_PROXY_TIMEOUT_MS` | `5000` | REST | Upstream fetch timeout in milliseconds. |
| `SHARPTOWN_PROXY_MAX_BYTES` | `20971520` | REST | Maximum upstream image size in bytes. |
| `SHARPTOWN_PROXY_CACHE_CONTROL` | `public, max-age=31536000, immutable` | REST | `Cache-Control` for proxy responses; empty omits the header. |

Example `.env`:

```ini
SHARPTOWN_PORT=3001
SHARPTOWN_HOST=localhost
SHARPTOWN_GRPC_PORT=50051
SHARPTOWN_GRPC_HOST=0.0.0.0
SHARPTOWN_JSONRPC_PORT=3002
SHARPTOWN_JSONRPC_HOST=localhost
SHARPTOWN_PROXY_KEY=
SHARPTOWN_PROXY_ALLOWED_HOSTS=*
```

## Notes

- The servers read these at startup; restart after changing `.env`.
- In Docker, the bind host is forced to `0.0.0.0` so the container is reachable — see
  [Deployment](/docs/deployment).
- `0.0.0.0` binds all interfaces (use inside containers / trusted networks); `localhost`
  restricts to the local machine.
