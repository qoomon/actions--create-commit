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

- `message` - the commit message
  - if multiline first line is used as headline following as body
