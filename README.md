# Create Commit

This action will create a new commit via GitHub API, committer and author are related to token identity.
Commits getting signed, if a GitHub App token (`ghs_***`) is used and will be marked as `verified` in the GitHub web interface.

### Example

```yaml
jobs:
  example:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: qoomon/actions--setup-git-user@v1
      - run: |
          date > dummy.txt
          git add dummy.txt

      - name: Sign HEAD commit
        uses: qoomon/actions--create-commit@v1
        with:
          message: work work

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

  token:
    description: 'A GitHub access token'
    required: true
    default: ${{ github.token }}
  working-directory:
    description: 'The working directory'
    required: true
    default: '.'
  remoteName:
    description: 'The remote name to create the commit at.'
    required: true
    default: 'origin'
```

## Development

### Release New Action Version

Trigger [Release Version workflow](/actions/workflows/action-release.yaml)
