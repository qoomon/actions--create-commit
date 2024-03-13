import * as core from '@actions/core'
import * as github from '@actions/github'
import {exec, getInput, run} from './lib/actions.js'
// see https://github.com/actions/toolkit for more github actions libraries
import {getCommitDetails, getRemoteUrl, readFile} from './lib/git.js'
import {createCommit, parseRepositoryFromUrl} from './lib/github.js'

export const action = () => run(async () => {
  const input = {
    token: getInput('token', {required: true})!,
    workingDirectory: getInput('working-directory') ?? '.',
    remoteName: getInput('remoteName') ?? 'origin',
  }

  if (!input.token.startsWith('ghs_')) {
    core.setFailed(`Only GitHub app tokens (ghs_***) can be used for signing commits.`)
    return
  }

  process.chdir(input.workingDirectory)

  const headCommit = await getCommitDetails('HEAD')
  if (headCommit.files.length === 0) {
    core.info('nothing to commit, working tree clean')
    return
  }
  const repositoryRemoteUrl = await getRemoteUrl(input.remoteName)

  const repository = parseRepositoryFromUrl(repositoryRemoteUrl)
  const octokit = github.getOctokit(input.token)
  const signedCommit = await createCommit(octokit, repository, {
    subject: headCommit.subject,
    body: headCommit.body,
    parents: headCommit.parents,
    files: headCommit.files.map((file) => ({
      path: file.path,
      mode: file.mode,
      status: file.status,
      loadContent: async () => readFile(file.path, headCommit.sha),
    })),
  })

  core.info('Syncing local repository ...')
  await exec(`git fetch`, [input.remoteName, signedCommit.sha])
  await exec(`git reset --soft ${signedCommit.sha}`)
})

if (import.meta.url === `file://${process.argv[1]}`) {
  action()
}
