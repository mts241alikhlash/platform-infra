# Contract: Versioned Routing Manifest

## Purpose

Web source keeps its typed `api-routes.config.ts` for local Vite development and
route smoke tests. Each web release emits a JSON routing manifest for
`241-platform-infra`. The infra repository never imports web TypeScript source.

## Schema version 1

Example:

```json
{
  "schemaVersion": 1,
  "app": "academic",
  "webVersion": "0.1.0",
  "servicePrefixes": {
    "identity": ["/auth", "/profiles"],
    "academic": ["/academic-years", "/classrooms"],
    "student": ["/students"],
    "hr": ["/employees"]
  },
  "unroutedPrefixes": [],
  "healthRoutes": [
    { "path": "/health/identity", "service": "identity" },
    { "path": "/health/academic", "service": "academic" }
  ]
}
```

## Validation rules

- `schemaVersion` is a supported positive integer.
- `app` is one of the seven canonical app keys.
- `webVersion` is valid semantic version syntax.
- Every service key is one of the nine canonical service keys.
- Every API prefix starts with `/`, contains lowercase path segments, and contains
  no regex operators, captures, query strings, or fragments.
- Every health route path is unique and maps to one service.
- No prefix occurs in both `servicePrefixes` and `unroutedPrefixes`.
- No service prefix list contains duplicates.
- The manifest is valid without access to any web source repository.

## Release artifact

Each web release publishes:

```text
academic-web-routes-0.1.0.json
sha256:<checksum>
```

The artifact is attached to the web release and contains the exact `webVersion`
that produced it. The infra deployment lock records the artifact version and
checksum beside the web image digest.

## Infra consumption

The infra generator loads only the downloaded or checked-in JSON artifact and a
local service-upstream registry. It MUST:

1. validate the manifest schema;
2. validate route/service ownership;
3. validate route overlap;
4. validate artifact version and checksum against the deployment lock;
5. generate HTTP and TLS Nginx configuration;
6. run `nginx -t` against both generated configurations.

## Authentication invariant

The manifest does not change browser origin behavior. Each app hostname serves
its own SPA image and proxies its declared API paths through the same hostname.
The existing relative API base URL and host-only refresh cookie therefore remain
valid.
