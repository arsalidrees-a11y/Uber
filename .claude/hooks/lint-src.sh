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
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO=""
for cand in "$here/../../uber-learn" "$here/../.."; do
  if [ -f "$cand/package.json" ] && [ -d "$cand/src/components" ]; then
    REPO=$(cd "$cand" && pwd); break
  fi
done
[ -n "$REPO" ] || exit 0

file=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -n "$file" ] || exit 0

case "$file" in
  */uber-learn/src/*) ;;
  *) exit 0 ;;                       # not our source tree; stay silent
esac

cd "$REPO" || exit 0
if out=$(npm run lint --silent 2>&1); then
  exit 0
fi

printf 'uber-learn lint failed after editing %s\n\n%s\n' "$file" "$out" >&2
exit 2
