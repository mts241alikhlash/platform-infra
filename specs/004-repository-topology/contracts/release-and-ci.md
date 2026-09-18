# Contract: Release and CI

## Repository workflow matrix

| Repository kind | Validation | Release output |
| --- | --- | --- |
| Single web repo | `format:check`, lint, typecheck, test, build, route manifest validation | Web image digest and routing-manifest artifact |
| `241-services` | Affected service and client package validation, OpenAPI generation/diff, package tests | Service image digest, service tag, API client package versions |
| `241-web-packages` | Affected package typecheck, tests, package export fixture, pack inspection | Independent private npm package versions |
| `241-platform-infra` | Lock/schema validation, Nginx generation, `nginx -t`, Compose config | Immutable gateway/deployment release |

## Affected work

- A change limited to one web repository never checks out another web repository.
- A service change selects the changed service and its dependents through pnpm
  workspace filters.
- A client package change selects consumers in `241-services`; external web
  consumers are notified through a package update workflow.
- A shared frontend package change does not release a web app automatically.
- An infra change validates the deployment lock and all referenced artifacts.

## Versioning

- All project and package versions use semantic version syntax.
- Services and web apps have independent versions even when their repository has
  multiple projects.
- Pre-production project and package baselines remain at `0.1.0`; the first
  stable production release uses `1.0.0`, after which SemVer increments follow
  the public compatibility contract.
- Public package releases use Changesets and publish only non-private packages.
- Private service and web projects are versioned and tagged but not npm-published.
- Image tags carry the project version; production locks use image digests.
- A pull request that changes release-relevant application, service, contract,
  client, or shared-package files carries a non-README Changeset. Documentation
  and CI-only changes are exempt.
- A provider contract release precedes a consumer release when a dependency
  update is required.

## GitHub Actions permissions

Workflows declare only required permissions:

- `contents: read` for validation;
- `packages: read` for package consumers;
- `packages: write` for package publishers;
- `contents: write` only in the release workflow that creates tags/releases;
- `id-token: write` only if provenance signing is later enabled.

No workflow stores a registry token in the repository. Package access is granted
through GitHub Packages repository permissions and `GITHUB_TOKEN` where supported.

## Release ordering

1. Publish a compatible provider API or shared package release.
2. Publish its image/package artifact and record the immutable identity.
3. Update consumers to the new package or contract version.
4. Release consumers.
5. Update `241-platform-infra` deployment lock and promote.

For breaking API changes, the old compatible provider route and client remain
available until all consumers have moved. The migration itself does not create
new URL versions.

## Readiness gate

The release workflows are not enabled against production until:

- all ten repository ownership records are complete;
- every clean checkout builds without sibling source;
- package and API client fixture checks pass;
- gateway generation consumes artifacts only;
- deployment lock uses digests and checksums;
- no credentials are present in the snapshot;
- the owner explicitly approves Git initialization and remote creation.
