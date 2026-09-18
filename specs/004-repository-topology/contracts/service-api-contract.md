# Contract: Service API and Generated Client

## Package mapping

Each service in `241-services` owns one client package:

| Service | Client package |
| --- | --- |
| `identity-service` | `@241/api-identity` |
| `academic-service` | `@241/api-academic` |
| `admission-service` | `@241/api-admission` |
| `inventory-service` | `@241/api-inventory` |
| `portal-service` | `@241/api-portal` |
| `presence-service` | `@241/api-presence` |
| `hr-service` | `@241/api-hr` |
| `student-service` | `@241/api-student` |
| `assessment-service` | `@241/api-assessment` |

## Source and generated artifacts

For each service:

```text
services/<service>/src/openapi/       provider document emitter
contracts/<service>/openapi.json      tracked generated contract
packages/api-<service>/src/generated.ts  generated TypeScript types
packages/api-<service>/src/client.ts     thin typed transport factory
```

The provider's `openapi:emit` command generates the contract. CI fails if the
generated contract is not committed with the provider change. The client package
is generated from that tracked contract and CI fails if generated output is
stale.

## Client factory surface

Each client package exposes a small factory with:

- `baseUrl` required;
- optional `fetch` implementation for tests or service adapters;
- credentials/header configuration required by the caller;
- typed operation methods generated from paths;
- typed success and error results;
- no provider Prisma, DTO, entity, or controller imports.

Browser consumers configure credentials for the existing refresh-cookie flow.
Service adapters configure the private service URL and provisioning/auth headers
required by their existing contract.

## Consumer boundary

The generated client is an outer boundary adapter. Consumer code MUST map client
responses to local types before domain or application code uses them.

```text
generated client response
  -> consumer HTTP adapter
  -> consumer narrow read model
  -> consumer port/use case
```

Generated types must not become shared domain entities. A service still owns its
own error handling, retry policy, timeout, and failure status.

## Compatibility rules

| Contract change | Client release | Runtime rollout |
| --- | --- | --- |
| Implementation-only fix | patch or no client release | Provider image only |
| New endpoint or optional field | minor | Provider first, consumer adoption later |
| Removed/renamed field, endpoint, or incompatible meaning | major | Preserve old compatible contract until consumers migrate |

The existing routes are not renamed to `/v1` as part of this migration. URL
versioning is introduced only when a real breaking compatibility boundary needs
parallel runtime routes.

## CI contract

For every changed service or client package, CI MUST:

1. build the provider;
2. emit the OpenAPI document;
3. compare it with the tracked document;
4. regenerate the client;
5. typecheck and test the client;
6. run affected service tests and builds;
7. require a Changeset when the public contract or client package changes.

## Registry contract

API clients publish to GitHub Packages as private scoped npm packages. The
package version is the compatibility identity consumed by web repositories and
service adapters.
