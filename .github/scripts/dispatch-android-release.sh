#!/usr/bin/env bash
set -euo pipefail

assets=${1:?Provide the assets prepared by the Android build script}
manifest="$assets/expenser-android.json"
tag="expenser-android-v$(jq -er '.version' "$manifest")"
build_id=$(jq -er '.easBuildId' "$manifest")
digest=$(jq -er '.sha256' "$manifest")
sha=$(jq -er '.commit' "$manifest")
apk_url=$(< "$assets/apk-source.txt")
repo=${GITHUB_REPOSITORY:-wrestle-R/Expenser}
[[ "$digest" == "$(sha256sum "$assets/expenser-android.apk" | cut -d ' ' -f 1)" ]]
remote_tags=$(git ls-remote --exit-code origin "refs/tags/$tag" "refs/tags/$tag^{}")
[[ "$(awk 'END { print $1 }' <<< "$remote_tags")" == "$sha" ]]
gh workflow run android-release.yml --repo "$repo" --ref main \
  -f "release_tag=$tag" -f "eas_build_id=$build_id" -f "apk_url=$apk_url" -f "apk_sha256=$digest"
