---
"241-platform-infra": patch
---

Rename the Compose project name (`241-platform-production`/`-staging`/`-dev`) and the shared external network (`241-platform-net`) to `mts241alikhlash-*`, matching the org/domain identity used everywhere else. Docker treats a different project name as a different stack: recreating on the VPS means bringing up the new stack under the new name and removing the old `241-platform-*` containers and the old `241-platform-net` network by hand — not a rolling update.
