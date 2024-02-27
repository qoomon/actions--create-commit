#!/usr/bin/env bash

RELEASE_VERSION="$1"

if [ -z "$RELEASE_VERSION" ]; then
  echo "Usage: $0 <release-version>"
  echo "e.g. $0 1.0.1"
  exit 1
fi

npm ci
npm run build

git add -f dist/
git commit -m "build(release): ${RELEASE_VERSION}"
git push

RELEASE_VERSION_TAG="v$RELEASE_VERSION"
git tag -a -m "${RELEASE_VERSION}" "${RELEASE_VERSION_TAG}"
git push origin "${RELEASE_VERSION_TAG}"

# move the major version tag e.g. v1
git tag --force "${RELEASE_VERSION_TAG%%.*}"
git push --force origin "${RELEASE_VERSION_TAG%%.*}"
