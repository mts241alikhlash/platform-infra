#!/usr/bin/env bash
set -euo pipefail

root="${DEPLOY_ROOT:-/srv/mts241alikhlash}"
read -r -a args <<< "${SSH_ORIGINAL_COMMAND:-}"

if [[ "${#args[@]}" -ne 2 ]]; then
  echo "usage: <staging|production> <40-character sha>" >&2
  exit 2
fi
env="${args[0]}"
sha="${args[1]}"

case "$env" in
  staging | production) ;;
  *)
    echo "unknown environment: $env" >&2
    exit 2
    ;;
esac
if [[ "$env" != "${1:-}" ]]; then
  echo "this key may only deploy ${1:-nothing}" >&2
  exit 2
fi
if [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "invalid sha: $sha" >&2
  exit 2
fi

exec 9> "$root/$env.lock"
if ! flock -w 900 9; then
  echo "another $env deploy is still running" >&2
  exit 1
fi

cd "$root/$env/platform-infra"
git fetch --quiet --prune --tags origin
if ! git merge-base --is-ancestor "$sha" origin/main 2> /dev/null; then
  echo "$sha is not on origin/main" >&2
  exit 2
fi
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "tracked files are modified in $PWD" >&2
  exit 1
fi
git checkout --quiet --detach "$sha"
exec scripts/deploy.sh "$env"
