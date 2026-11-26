#!/usr/bin/env bash
set -euo pipefail

assets=${1:?Provide the prepared release directory}
repo=${GITHUB_REPOSITORY:-wrestle-R/Expenser}
manifest="$assets/expenser-android.json"
version=$(jq -er '.version' "$manifest")
code=$(jq -er '.versionCode' "$manifest")
sha=$(jq -er '.commit' "$manifest")
digest=$(jq -er '.sha256' "$manifest")
tag="expenser-android-v$version"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ && "$sha" == "$(git rev-parse HEAD)" ]]
[[ "$digest" == "$(sha256sum "$assets/expenser-android.apk" | cut -d ' ' -f 1)" ]]
[[ "$(git rev-list -n 1 "$tag")" == "$sha" ]]
remote_tags=$(git ls-remote --exit-code origin "refs/tags/$tag" "refs/tags/$tag^{}")
remote_commit=$(awk 'END { print $1 }' <<< "$remote_tags")
[[ "$remote_commit" == "$sha" ]]

# A published release is immutable here. A partial draft can be resumed.
if existing=$(gh release view "$tag" --repo "$repo" --json isDraft,assets); then
  if [[ "$(jq -r '.isDraft' <<< "$existing")" == false ]]; then
    published=$(gh release download "$tag" --repo "$repo" --pattern expenser-android.json --output -)
    jq -e --arg sha "$sha" --arg version "$version" --argjson code "$code" '
      .commit == $sha and .version == $version and .versionCode == $code
    ' <<< "$published" >/dev/null
    jq -e 'any(.assets[]; .name == "expenser-android.apk")' <<< "$existing" >/dev/null
    gh release view "$tag" --repo "$repo" --json url --jq .url
    exit
  fi
else
  gh release create "$tag" --repo "$repo" --verify-tag --draft \
    --title "Expenser Android $version" --notes-file "$assets/notes.md"
fi

# Keep the latest pointer monotonic when older tags get dispatched again.
latest=$(gh api "repos/$repo/releases/latest" --jq '.tag_name')
if [[ "$latest" == expenser-android-v* ]]; then
  current=$(gh release download "$latest" --repo "$repo" --pattern expenser-android.json --output -)
  current_code=$(jq -er '.versionCode | select(type == "number")' <<< "$current")
  (( code > current_code )) || { echo 'Android version code must increase' >&2; exit 1; }
fi

gh release upload "$tag" --repo "$repo" --clobber "$assets/expenser-android.apk" "$manifest"
gh release edit "$tag" --repo "$repo" --draft=false --latest
