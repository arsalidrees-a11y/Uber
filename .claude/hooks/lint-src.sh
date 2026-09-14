#!/usr/bin/env bash
# PostToolUse hook: lint the component kit whenever a source file is saved.
#
# Reads the hook payload on stdin, and does nothing unless the edited file is
# under uber-learn/src/. On a lint failure it exits 2, which Claude Code treats
# as a blocking error and feeds the output back to the model so it gets fixed
# in the same turn rather than at build time.
set -uo pipefail

# Find the kit by walking out from this script, so the hook keeps working if
# the repo is handed over and lands at a different absolute path.
# -P resolves symlinks. .claude at the parent is a symlink into this repo,
# so a logical `cd ..` reports the PARENT of the repo while the -f/-d tests
# below, which hit the filesystem physically, see the repo. That mismatch
# sent the linter to a directory that has no scripts/ at all.
here=$(cd -P "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=""
for cand in "$here/../.." "$here/../../uber-learn"; do
  # Test for the exact file we are about to run, not a proxy for it.
  if [ -f "$cand/scripts/lint.mjs" ]; then
    REPO=$(cd -P "$cand" && pwd); break
  fi
done
[ -n "$REPO" ] || exit 0

command -v jq >/dev/null 2>&1 || exit 0
file=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -n "$file" ] || exit 0

case "$file" in
  */uber-learn/src/*) ;;
  *) exit 0 ;;                       # not our source tree; stay silent
esac

# A hook does not inherit the interactive shell's PATH, so nvm's node is not
# on it and `npm` resolves to nothing. That came back as exit 127 and was
# reported as a lint failure - a broken toolchain masquerading as broken code.
# Resolve node ourselves and call the linter directly; npm was never needed.
NODE=$(command -v node 2>/dev/null)
if [ -z "$NODE" ]; then
  for n in "$HOME"/.nvm/versions/node/*/bin/node /usr/local/bin/node /opt/homebrew/bin/node; do
    [ -x "$n" ] && NODE=$n && break
  done
fi
# No node at all is an environment problem, not a lint failure. Say so on
# stderr and get out of the way rather than blocking the edit.
if [ -z "$NODE" ]; then
  echo "lint-src hook: no node binary found; skipping lint for $file" >&2
  exit 0
fi

cd "$REPO" || exit 0
if out=$("$NODE" scripts/lint.mjs 2>&1); then
  exit 0
fi

printf 'uber-learn lint failed after editing %s\n\n%s\n' "$file" "$out" >&2
exit 2
