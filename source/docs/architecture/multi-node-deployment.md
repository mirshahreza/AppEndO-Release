# Multi-node deployment

Operator guide for splitting AppEndO across multiple processes. Runtime model and node capabilities are summarized below.

## Principles

| Topic | Decision |
|-------|----------|
| Node coordination | **None** — no discovery, cluster bus, or in-app load balancer |
| Shared infrastructure | **PostgreSQL** (required) · **Redis** (optional cache) |
| Service scaling | Multiple `service` nodes behind an **external** reverse proxy or cloud LB |
| Platform | Exactly **one** node with `platform` capability |
| Worker | Exactly **one** node with `worker` capability — no internal job sharing |

Nodes do not know about each other. Each process has its own `settings.json` (or env overrides) and connects to the same database.

## Typical topology

```
                 [ Reverse proxy / LB ]
                  /        |         \
         service-1    service-2    (optional)
                  \        |         /
                   \       |        /
                    [ PostgreSQL ]
                    [ Redis (opt.) ]

         platform (1×)          worker (1×)
              \                    /
               \                  /
                [ PostgreSQL ]
                [ Redis (opt.) ]
```

Default install: all three capabilities on one machine (`service`, `platform`, `worker`).

## Environment variables

| Variable | Example | Purpose |
|----------|---------|---------|
| `APPENDO_NODE_NAME` | `service-1` | Human-readable node id (health/readiness payloads) |
| `APPENDO_NODE_CAPABILITIES` | `service` | Comma-separated: `service`, `platform`, `worker` |

These override `runtime.nodeName` and `runtime.capabilities` in `settings.json`.

### Examples

**Dedicated service node (horizontal scale):**

```bash
APPENDO_NODE_NAME=service-1
APPENDO_NODE_CAPABILITIES=service
```

**Platform admin node:**

```bash
APPENDO_NODE_NAME=platform-1
APPENDO_NODE_CAPABILITIES=platform
```

**Background jobs node:**

```bash
APPENDO_NODE_NAME=worker-1
APPENDO_NODE_CAPABILITIES=worker
```

Use the same PostgreSQL connection settings on every node. Point optional Redis cache to the same instance when `cache.driver=redis`.

## Health and readiness

| Endpoint | Role |
|----------|------|
| `GET /api/health` | Liveness — process is up; returns `nodeName` and `capabilities` |
| `GET /api/ready` | Readiness — DB + per-capability checks; `503` when not ready |

Readiness response (ready):

```json
{
  "status": "ready",
  "nodeName": "service-1",
  "capabilities": ["service"],
  "checks": {
    "database": "ready",
    "redis": "skipped",
    "workerQueue": "skipped"
  },
  "capabilityReadiness": {
    "service": "ready"
  }
}
```

- **database** — PostgreSQL `SELECT 1`
- **redis** — `skipped` unless `cache.driver=redis`; then ping shared Redis
- **workerQueue** — `base_jobs` reachable; only when `worker` capability is active
- **capabilityReadiness** — one entry per active capability on this node

Configure your proxy or orchestrator to use `/api/ready` for upstream health checks and `/api/health` for simple liveness.

## Reverse proxy (service nodes)

AppEndO does not ship an internal load balancer. Terminate TLS and balance traffic to service nodes with nginx, HAProxy, Caddy, or a cloud load balancer.

### nginx example

```nginx
upstream appendo_service {
    least_conn;
    server 10.0.0.11:3000 max_fails=2 fail_timeout=10s;
    server 10.0.0.12:3000 max_fails=2 fail_timeout=10s;
}

server {
    listen 443 ssl http2;
    server_name apps.example.com;

    location / {
        proxy_pass http://appendo_service;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ready {
        proxy_pass http://appendo_service;
        proxy_connect_timeout 2s;
        proxy_read_timeout 5s;
    }
}
```

Run platform and worker on separate hosts (or internal networks). Route public user traffic only to `service` nodes. Admin/studio traffic goes to the single `platform` node.

## Rolling updates (manual)

For multi-node app upgrades without in-product orchestration:

1. Drain one service node (remove from proxy upstream).
2. Wait until in-flight requests finish; confirm `/api/ready` is unreachable from the LB.
3. Upgrade and restart that node; verify `/api/ready` returns `ready`.
4. Re-add to upstream; repeat for remaining service nodes.
5. Upgrade `platform` and `worker` nodes during a maintenance window (singleton — brief downtime unless you accept admin/job pause).

Automated rolling is planned under [p-43 platform updates](../../plans/core/next/p-43-platform-updates.md).

## Out of scope

- Leader election or multiple workers
- Distributed job queue inside AppEndO
- Built-in load balancer
- Cross-node rate limiting (optional future: shared Redis for rate limits — not job coordination)

---

*See also: [system-extensions.md](./system-extensions.md) · [p-43 platform updates](../../plans/core/next/p-43-platform-updates.md) (rolling update — planned)*
