#!/usr/bin/env bash
set -euo pipefail

env="${1:?usage: scripts/deploy.sh <staging|production>}"
services=(identity academic admission hr inventory presence portal student assessment)

dc() {
  docker compose -f "compose/docker-compose.$env.yml" -f compose/docker-compose.override.yml "$@"
}

report() {
  dc ps -a --format '{{.Name}} {{.State}} {{.Health}}'
  echo "==> read logs on the VPS: docker logs --tail 100 <name>"
}

echo "==> pull"
dc --profile migrate pull

for service in "${services[@]}"; do
  echo "==> migrate $service"
  if ! dc --profile migrate run --rm "$service-service-migrate"; then
    echo "migration failed: $service" >&2
    exit 1
  fi
done

echo "==> seed permissions"
dc run --rm --entrypoint ./node_modules/.bin/tsx identity-service prisma/seed-permissions.ts

trap report ERR
echo "==> up"
dc up -d --wait --wait-timeout 300

host="$(python3 -c 'import json, sys; print(json.load(open(sys.argv[1]))["apps"]["account"]["sslHost"])' "deployment/$env.lock.json")"
address="$(dc port gateway 80)"
echo "==> health $host via $address"
curl -fsS -m 10 -H "Host: $host" "http://$address/health/identity"
echo

echo "==> deployed $(git rev-parse --short HEAD) to $env"
