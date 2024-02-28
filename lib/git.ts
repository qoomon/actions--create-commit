import {exec} from "./actions";
import {_throw} from "./utils";

export async function getGitInfo() {

  const repository = await exec('git remote get-url --push origin')
      .then(({stdout}) => stdout.trim().replace(/.*?([^/:]+\/[^/]+?)(?:\.git)?$/, '$1'))
      .then((repository) => {
        const repositoryParts = repository.split('/')
        return {
          owner: repositoryParts[0],
          repo: repositoryParts[1],
        }
      })

  const head = await exec('git rev-parse HEAD')
      .then(({stdout}) => stdout.trim())

  const branch = await exec('git branch --show-current')
      .then(({stdout}) => stdout.trim())

  // TODO only list changed files
  const diffFileModes = await exec('git ls-files --cached --stage --full-name')
      .then(({stdout}) => stdout.split('\n').filter((fileInfo) => fileInfo.trim()))
      .then((fileInfos) => fileInfos.map((fileInfo) => {
        const fileInfoMatch = fileInfo.match(/^(?<mode>\d{6}) (?<sha>\w{40}) (?<stage>\d)\s+(?<path>.*)$/)
        if (!fileInfoMatch) throw new Error(`Unexpected file info: ${fileInfo}`)
        return {
          mode: fileInfoMatch?.groups?.mode!,
          path: fileInfoMatch?.groups?.path!,
        }
      }).reduce((acc, fileInfo) => {
        acc[fileInfo.path] = fileInfo
        return acc
      }, <Record<string, { mode: string, path: string }>>{}))

  const diff = {
    // --diff-filter= A(Added) M(Modified)
    additions: await exec('git diff --cached --name-only --diff-filter=AM')
        .then(({stdout}) => stdout.split('\n').filter((path) => path.trim()))
        .then((paths) => paths.map((path) => ({
          path,
          mode: diffFileModes[path]?.mode ?? _throw(new Error(`File mode not found for ${path}`))
        }))),
    // --diff-filter= D(Deleted)
    deletions: await exec('git diff --cached --name-only --diff-filter=D')
        .then(({stdout}) => stdout.split('\n').filter((path) => path.trim() !== ''))
        .then((paths) => paths.map((path) => ({
          path
        }))),
  }

  return {
    repository,
    head,
    branch,
    diff,
  }
}
