# Create Commit &nbsp; [![starline](https://starlines.qoo.monster/assets/qoomon/actions--create-commit)](https://github.com/qoomon/starline)
[![Actions](https://img.shields.io/badge/qoomon-GitHub%20Actions-blue)](https://github.com/qoomon/actions)

This action will create a new commit via GitHub API, committer and author are related to given token identity.
Commits getting signed, if a GitHub App token (`ghs_***`) is used and will be marked as `verified` in the GitHub web interface.

### Example

```yaml
jobs:
  example:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.ref }}
      - run: |
          date > dummy.txt
          git add dummy.txt

      - uses: qoomon/actions--create-commit@v1
        id: commit
        with:
          message: work work
          skip-empty: true

      - run: git push
```

### Inputs

```yaml
inputs:
  message:
    description: 'The commit message'
    required: true
  amend:
    description: 'Amend the last commit'
    default: false
  allow-empty:
    description: 'Allow an empty commit'
    default: false
  skip-empty:
    description: 'Skip action, if nothing to commit'
    default: false

  token:
    description: 'A GitHub access token'
    required: true
    default: ${{ github.token }}
  remoteName:
    description: 'The remote name to create the commit at.'
    required: true
    default: 'origin'
```

### Outputs

```yaml
outputs:
  commit:
    description: 'The commit hash, if a commit was created'
```

## Development

### Release New Action Version

Trigger [Release Version workflow](/actions/workflows/action-release.yaml)
