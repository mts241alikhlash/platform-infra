#!/usr/bin/env bash
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
entry="$here/deploy-entry.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

g() { git -c user.email=test@example.invalid -c user.name=test -c init.defaultBranch=main "$@"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

g init --quiet "$work/origin"
mkdir -p "$work/origin/scripts"
cat > "$work/origin/scripts/deploy.sh" <<'EOF'
#!/usr/bin/env bash
printf '%s %s\n' "$1" "$(git rev-parse HEAD)" > "$DEPLOY_ROOT/called"
EOF
chmod +x "$work/origin/scripts/deploy.sh"
echo one > "$work/origin/tracked.txt"
g -C "$work/origin" add .
g -C "$work/origin" commit --quiet -m one
g -C "$work/origin" switch --quiet -c side
g -C "$work/origin" commit --quiet --allow-empty -m side
side_sha="$(g -C "$work/origin" rev-parse HEAD)"
g -C "$work/origin" switch --quiet main

for env in staging production; do
  mkdir -p "$work/$env"
  g clone --quiet "$work/origin" "$work/$env/platform-infra"
done

echo two > "$work/origin/tracked.txt"
g -C "$work/origin" commit --quiet -am two
main_sha="$(g -C "$work/origin" rev-parse HEAD)"

run() { SSH_ORIGINAL_COMMAND="$2" DEPLOY_ROOT="$work" bash "$entry" "$1"; }
expect_exit() {
  local want="$1" key="$2" input="$3" got=0
  run "$key" "$input" >/dev/null 2>&1 || got=$?
  [[ "$got" -eq "$want" ]] || fail "'$input' exited $got, expected $want"
  [[ ! -e "$work/called" ]] || fail "'$input' reached deploy.sh"
}

expect_exit 2 staging ""
expect_exit 2 staging "staging"
expect_exit 2 staging "qa $main_sha"
expect_exit 2 staging "production $main_sha"
expect_exit 2 "" "staging $main_sha"
expect_exit 2 qa "qa $main_sha"
expect_exit 2 staging "staging ${main_sha:0:7}"
expect_exit 2 staging "staging ${main_sha^^}"
expect_exit 2 staging "staging $main_sha extra"
expect_exit 2 staging "staging ;id"
expect_exit 2 staging "staging \$(id)"
expect_exit 2 staging "staging $side_sha"
expect_exit 2 staging "staging $(printf '0%.0s' {1..40})"

echo "touch \"\$DEPLOY_ROOT/called\"" >> "$work/staging/platform-infra/scripts/deploy.sh"
expect_exit 1 staging "staging $main_sha"
g -C "$work/staging/platform-infra" checkout --quiet -- scripts/deploy.sh

run production "production $main_sha" >/dev/null
[[ "$(cat "$work/called")" == "production $main_sha" ]] || fail "production deploy did not run $main_sha"
rm "$work/called"

run staging "staging $main_sha" >/dev/null
[[ "$(cat "$work/called")" == "staging $main_sha" ]] || fail "staging deploy did not run $main_sha"

echo "deploy-entry test passed"
