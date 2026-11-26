#!/usr/bin/env bash
set -euo pipefail

output=${1:?Provide a directory for the release assets}
build_id=${2:-}
artifact=${3:-}
expected_digest=${4:-}
root=$(git rev-parse --show-toplevel)
mkdir -p "$output"
output=$(cd "$output" && pwd)
sdk="${ANDROID_HOME:?ANDROID_HOME is required}/build-tools/36.0.0"
sha=$(git -C "$root" rev-parse HEAD)
version=$(jq -er '.expo.version' "$root/expo/app.json")
code=$(jq -er '.expo.android.versionCode' "$root/expo/app.json")
project=$(jq -er '.expo.extra.eas.projectId' "$root/expo/app.json")
tag="expenser-android-v$version"
release_notes=$(git -C "$root" show "$sha:expo/android-release-notes.json")
certificate=c17989c7c712754628b68736f56b66cb0a4e3f4a5849daa448817c0fd1716176

[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ && "$code" =~ ^[1-9][0-9]*$ ]]
[[ -z "${RELEASE_TAG:-}" || "$RELEASE_TAG" == "$tag" ]]
[[ -z "$(git -C "$root" status --porcelain)" ]]
jq -e --arg version "$version" '
  .version == $version and (.notes | length > 0 and all(.[]; type == "string" and length > 0))
' <<< "$release_notes" >/dev/null
cd "$root/expo"

if [[ -z "$artifact" ]]; then
  : "${EXPO_TOKEN:?An Expo token is required to request or inspect builds}"
  [[ -z "$expected_digest" ]]
  if [[ -z "$build_id" ]]; then
    # Reuse active and finished builds from this exact release commit on reruns.
    candidates=$(eas build:list --platform android --build-profile release --git-commit-hash "$sha" --app-version "$version" --app-build-version "$code" --json --non-interactive)
    build_id=$(jq -r '
      [.[] | select(.status == "FINISHED" or .status == "NEW" or .status == "IN_QUEUE" or .status == "IN_PROGRESS")] |
      sort_by(.status != "FINISHED") | .[0].id // empty
    ' <<< "$candidates")
  fi

  if [[ -z "$build_id" ]]; then
    started=$(eas build --platform android --profile release --non-interactive --freeze-credentials --no-wait --json)
    build_id=$(jq -er '.[0].id' <<< "$started")
  fi

  [[ "$build_id" =~ ^[a-f0-9-]{36}$ ]]
  printf 'EAS build %s\n' "$build_id"

  # Bound the wait even if Expo leaves a build in its queue.
  deadline=$((SECONDS + 9000))
  while (( SECONDS < deadline )); do
    if ! build=$(eas build:view "$build_id" --json); then
      sleep 30
      continue
    fi
    status=$(jq -er '.status' <<< "$build")
    case "$status" in
      FINISHED) break ;;
      ERRORED|CANCELED) printf 'EAS build ended with %s\n' "$status" >&2; exit 1 ;;
      *) sleep 30 ;;
    esac
  done
  [[ "${status:-}" == FINISHED ]] || { echo 'EAS build timed out' >&2; exit 1; }

  artifact=$(jq -er --arg sha "$sha" --arg project "$project" --arg version "$version" --arg code "$code" '
    select(.status == "FINISHED" and .platform == "ANDROID" and .distribution == "INTERNAL" and
      .buildProfile == "release" and .gitCommitHash == $sha and .project.id == $project and .appVersion == $version and .appBuildVersion == $code) |
    .artifacts.applicationArchiveUrl // .artifacts.buildUrl
  ' <<< "$build")
else
  # A trusted local launcher has already checked EAS metadata and hashed the APK.
  [[ "$expected_digest" =~ ^[a-f0-9]{64}$ && "$build_id" =~ ^[a-f0-9-]{36}$ ]]
fi
[[ "$artifact" =~ ^https://expo\.dev/artifacts/eas/[a-zA-Z0-9_-]+\.apk$ ]]

apk="$output/expenser-android.apk"
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --max-time 600 --retry 3 --output "$apk.part" "$artifact"
badging=$("$sdk/aapt" dump badging "$apk.part")
package_line=${badging%%$'\n'*}
[[ "$package_line" == "package: name='com.rdp.expenser' versionCode='$code' versionName='$version'"* ]]
signer=$("$sdk/apksigner" verify --print-certs "$apk.part" | awk '/^Signer #[0-9]+ certificate SHA-256 digest:/ { print $NF }')
[[ "$signer" == "$certificate" ]]
mv "$apk.part" "$apk"
digest=$(sha256sum "$apk" | cut -d ' ' -f 1)
[[ -z "$expected_digest" || "$digest" == "$expected_digest" ]]
printf '%s\n' "$artifact" > "$output/apk-source.txt"
jq -n --arg version "$version" --argjson code "$code" --arg sha "$sha" --arg digest "$digest" --arg id "$build_id" \
  '{version:$version, versionCode:$code, commit:$sha, sha256:$digest, easBuildId:$id}' > "$output/expenser-android.json"
jq -r '.notes[] | "- " + .' <<< "$release_notes" > "$output/notes.md"
