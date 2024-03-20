import * as core from '@actions/core'
import * as github from '@actions/github'
import {exec, getInput, run} from './lib/actions.js'
// see https://github.com/actions/toolkit for more github actions libraries
import {getCacheDetails, getCommitDetails, getRemoteUrl, readFile} from './lib/git.js'
import {createCommit, parseRepositoryFromUrl} from './lib/github.js'

export const action = () => run(async () => {
  const input = {
    token: getInput('token', {required: true})!,
    workingDirectory: getInput('working-directory') ?? '.',
    remoteName: getInput('remoteName') ?? 'origin',
    message: getInput('message', {required: true})!,
    amend: getInput('amend') === 'true',
    allowEmpty: getInput('allow-empty') === 'true',
    skipEmpty: getInput('skip-empty') === 'true',
  }

  process.chdir(input.workingDirectory)

  const cacheDetails = await getCacheDetails()
  console.log('cacheDetails', cacheDetails)
  if (cacheDetails.files.length === 0) {
    if (input.skipEmpty) {
      core.info('nothing to commit, working tree clean')
      return
    } else if (!input.allowEmpty) {
      core.setFailed('nothing to commit, working tree clean')
      return
    }
  }

  const commitArgs = [
    '--message', input.message,
  ]
  if (input.amend) commitArgs.push('--amend')
  if (input.allowEmpty) commitArgs.push('--allow-empty')
  const commitResult = await exec('git', [
    '-c', 'user.name=github-actions[bot]',
    '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com',
    'commit', ...commitArgs,
  ])

  const octokit = github.getOctokit(input.token)
  const headCommit = await getCommitDetails('HEAD')
  const repositoryRemoteUrl = await getRemoteUrl(input.remoteName)
  const repository = parseRepositoryFromUrl(repositoryRemoteUrl)
  const githubCommit = await createCommit(octokit, repository, {
    subject: headCommit.subject,
    body: headCommit.body,
    tree: headCommit.tree,
    parents: headCommit.parents,
    files: headCommit.files.map((file) => ({
      path: file.path,
      mode: file.mode,
      status: file.status,
      loadContent: async () => readFile(file.path, headCommit.sha),
    })),
  })

  core.info('Syncing local repository ...')
  await exec(`git fetch`, [input.remoteName, githubCommit.sha])
  await exec(`git reset ${githubCommit.sha}`)
})

if (import.meta.url === `file://${process.argv[1]}`) {
  action()
}
