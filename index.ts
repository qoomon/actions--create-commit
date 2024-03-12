import * as core from '@actions/core'
import * as github from '@actions/github'
import {exec, getInput, run} from './lib/actions'
// see https://github.com/actions/toolkit for more github actions libraries
import {getCommitDetails, getRemoteUrl, readFile} from './lib/git'
import {createCommit, CreateCommitArgs, parseRepositoryFromUrl} from './lib/github.js'

const input = {
  token: getInput('token', {required: true})!,
  workingDirectory: getInput('working-directory', {required: true})!,
  remoteName: getInput('remoteName', {required: true})!,
}

process.chdir(input.workingDirectory)

const octokit = github.getOctokit(input.token)

run(async () => {
  const repositoryRemoteUrl = await getRemoteUrl()
  const repository = parseRepositoryFromUrl(repositoryRemoteUrl)

  const headCommit = await getCommitDetails('HEAD')
  if (headCommit.files.length === 0) {
    core.info('nothing to commit, working tree clean')
    return
  }

  core.info('Creating commit ...')
  const createCommitArgs: CreateCommitArgs = {
    subject: headCommit.subject,
    body: headCommit.body,
    parents: headCommit.parents,
    files: headCommit.files.map((file) => ({
      path: file.path,
      mode: file.mode,
      status: file.status,
      loadContent: async () => readFile(file.path, headCommit.sha),
    })),
  }
  const commit = await createCommit(octokit, repository, createCommitArgs)
  core.setOutput('commit', commit.sha)

  core.info('Syncing local repository ...')
  await exec(`git fetch ${input.remoteName} ${commit.sha}`)
  // TODO delete remote blob
  await exec(`git reset --soft ${commit.sha}`)
})

