# commit
Commits made using this action are automatically signed by GitHub and will be marked as verified in the user interface.

### Example
```yaml
jobs:
  example:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - runs: |
          date > dummy.txt
          git add dummy.txt

      - uses: qoomon/actions--commit@v1
        with:
          message: 'work, work'
```

### Inputs
```yaml
  token:
    description: 'A GitHub access token'
    required: true
    default: ${{ github.token }}
  remoteName:
    description: 'The remote name to create the commit on'
    required: true
    default: 'origin'
  message:
    description: 'The commit message'
  recommitHead:
    description: 'If true, the HEAD commit will be re-committed, instead creating commit of the index changes'
  push:
    description: 'If true, the commit will be pushed to the remote'
```

### Outputs
```yaml
  commitSha:
    description: 'The SHA of the commit'
```

## Development
### Release New Action Version
Trigger [Release Version workflow](/actions/workflows/action-release.yaml)
