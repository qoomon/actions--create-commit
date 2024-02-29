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
- `token` - A GitHub access token
- `message` - Commit message
- `recommitHEAD` - Recommit HEAD after commit. Default: false
