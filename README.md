# Create Commit

This action will **replace HEAD commit** with a commit created via GitHub api equivalent to HEAD commit,
however with new committer and author according to token identity.
Commits are signed if a GitHub App token (`ghs_***`) is used and will be marked as `verified` in the GitHub web interface.


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
          git commit -m 'work, work'

      - name: Sign HEAD commit
        uses: qoomon/actions--create-commit@v1

      - run: git push

```

### Inputs

```yaml
inputs:
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
