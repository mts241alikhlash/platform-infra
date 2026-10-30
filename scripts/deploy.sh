#!/usr/bin/env bash
set -euo pipefail

env="${1:?usage: scripts/deploy.sh <staging|production>}"
services=(identity academic admission hr inventory presence portal student assessment exam)

dc() {
  docker compose -f "compose/docker-compose.$env.yml" -f compose/docker-compose.override.yml "$@"
}

report() {
  dc ps -a --format '{{.Name}} {{.State}} {{.Health}}'
  echo "==> read logs on the VPS: docker logs --tail 100 <name>"
}

network="$(dc config --format json | python3 -c 'import json, sys; print(json.load(sys.stdin)["networks"]["platform-net"]["name"])')"
if [[ "$env" == production && "$network" == mts241alikhlash-net ]]; then
  echo "production is on the staging network; set its own network in compose/docker-compose.override.yml" >&2
  exit 1
fi

docker_root="$(docker info --format '{{.DockerRootDir}}')"
free_kb="$(df --output=avail -k "$docker_root" | tail -1)"
if (( free_kb < 5 * 1024 * 1024 )); then
  echo "less than 5 GB free under $docker_root; free space before deploying" >&2
  exit 1
fi

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

checks="$(python3 - "$env" "${services[@]}" <<'PY'
import json
import sys

env, *services = sys.argv[1:]
lock = json.load(open(f"deployment/{env}.lock.json"))
routes = {}
for app, pin in sorted(lock["apps"].items()):
    manifest = json.load(open(f"gateway/manifests/{app}-{pin['routesVersion']}.json"))
    for route in manifest["healthRoutes"]:
        routes.setdefault(route["service"], (pin["sslHost"], route["path"]))
missing = [service for service in services if service not in routes]
if missing:
    sys.exit(f"no health route for: {' '.join(missing)}")
for service in services:
    print(*routes[service])
PY
)"
address="$(dc port gateway 80)"
while read -r host path; do
  echo "==> health $host$path"
  curl -fsS -m 10 --retry 6 --retry-delay 5 --retry-all-errors -o /dev/null -H "Host: $host" "http://$address$path"
done <<< "$checks"

echo "==> remove unused platform images"
# Dangling images carry no tag and no container reference, so dropping them is
# always safe. This is the case that used to leak: a re-pinned digest untags the
# previous image, and the old awk filter skipped it because .Repository was
# empty for those rows.
docker image prune -f > /dev/null 2>&1 || true

# Tagged platform images that no container (running or stopped) references.
# Other projects on the host keep their images: the awk filter only matches
# this registry.
used_images="$(docker ps -aq | xargs -r docker inspect --format '{{.Image}}' 2>/dev/null | sort -u)"
docker image ls --no-trunc --format '{{.ID}} {{.Repository}}' |
  awk '$2 ~ /^ghcr\.io\/mts241alikhlash\// { print $1 }' |
  sort -u |
  while read -r id; do
    printf '%s\n' "$used_images" | grep -qx "$id" ||
      docker image rm "$id" > /dev/null 2>&1 || true
  done

echo "==> deployed $(git rev-parse --short HEAD) to $env"
