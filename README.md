# commit
Commits made using this action are automatically signed by GitHub and will be marked as verified in the user interface.

> [!NOTE]
> **From GitHub Docs** https://docs.github.com/en/graphql/reference/mutations#authorship
> 
> Similar to the web commit interface, this mutation does not support specifying the author or committer of the commit and will not add support for this in the future.
>
> A commit created by a successful execution of this mutation will be authored by the owner of the credential which authenticates the API request. The committer will be identical to that of commits authored using the web interface.
> 
> If you need full control over author and committer information, please use the Git Database REST API instead.

### Example
```yaml
jobs:
  basic-ubuntu-20:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - runs: |
          date > dummy.txt
          git add dummy.txt

      - uses: qoomon/commit@v1
        with:
          message: 'work, work'
```

### Inputs

- `message` - the commit message
  - if multiline first line is used as headline following as body
