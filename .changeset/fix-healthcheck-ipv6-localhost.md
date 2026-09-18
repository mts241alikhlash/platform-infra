---
"241-platform-infra": patch
---

Fix healthchecks using `http://localhost:<port>/...` for the 7 web apps and 9 backend services: `localhost` resolves to `::1` (IPv6) first inside the container, but every service's own `listen <port>;` (nginx web apps) or Node default bind only accepts IPv4, so `wget` (BusyBox, no IPv4 fallback on a failed IPv6 attempt) failed every check. Containers stayed permanently "unhealthy", and `gateway`'s `depends_on: condition: service_healthy` on all 16 meant it never started. Changed every healthcheck to `http://127.0.0.1:<port>/...`.
