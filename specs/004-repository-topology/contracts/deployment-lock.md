# Contract: Deployment Lock and API Gateway

## Deployment lock schema version 1

```json
{
  "schemaVersion": 1,
  "environment": "production",
  "gatewayImage": "ghcr.io/mts241alikhlash/platform-gateway@sha256:...",
  "apps": {
    "academic": {
      "host": "academic.example.com",
      "webVersion": "0.1.0",
      "webImage": "ghcr.io/mts241alikhlash/academic-web@sha256:...",
      "routesVersion": "0.1.0",
      "routesSha256": "..."
    }
  },
  "services": {
    "identity": {
      "version": "0.1.0",
      "image": "ghcr.io/mts241alikhlash/identity-service@sha256:...",
      "upstream": "identity-service:3000",
      "healthPath": "/health"
    }
  }
}
```

All seven apps and all nine services deployed in an environment have entries.
Development may use a smaller lock for the selected app and its required
services.

## Gateway rules

- Nginx is the public edge and API Gateway.
- The gateway proxies each app's declared API prefixes to the service upstream
  named in the lock.
- The gateway proxies the app hostname's non-API requests to that web image.
- Service-to-service calls use private service DNS and bypass the public gateway.
- Unknown API fetches return JSON 404 rather than the SPA shell.
- Hashed static assets are immutable; `index.html` is not cached.
- HTTP and TLS generated configurations are both checked.
- Route regex is generated only after path validation; raw external strings are
  never inserted without validation.

## Runtime composition

`241-platform-infra` owns the production Compose or deployment definition. It
uses image references, not local source builds or host `dist` bind mounts.

- Seven web containers serve static artifacts.
- Nine service containers expose their internal ports and health checks.
- One gateway container publishes ports 80 and 443.
- All relevant containers join one pre-created external private network.
- Environment files and credentials are injected by the deployment environment,
  not committed to the repository.
- Database migration is an explicit service-specific deployment step, not a
  web/gateway boot side effect.

## Same-origin contract

For each web hostname:

```text
https://<app-host>/             -> that app web image
https://<app-host>/<api-path>   -> declared backend service
https://<app-host>/auth/*       -> identity-service through that same host
```

The migration MUST NOT silently move browser API calls to a different public
origin. If a future design needs a shared auth origin or a public API hostname,
it requires a separate security and cookie contract.
