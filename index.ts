import * as core from '@actions/core'
import * as github from '@actions/github'
import {exec, getInput, run} from './lib/actions'
// see https://github.com/actions/toolkit for more github actions libraries
import {
  getCommitDetails,
  getRemoteUrl,
  getRev,
  getCacheDetails,
  readFile,
  getUnmergedFiles,
} from './lib/git'
import {createCommit, CreateCommitArgs, parseRepositoryFromUrl} from './lib/github.js'

const input = {
  token: getInput('token', {required: true})!,
  remoteName: getInput('remoteName', {required: true}),
  message: getInput('message', {required: false}),
  recommitHEAD: getInput('recommitHEAD', {required: false})?.toLowerCase() === 'true' || false,
}

const octokit = github.getOctokit(input.token)

run(async () => {
  const repositoryRemoteUrl = await getRemoteUrl()
  const repository = parseRepositoryFromUrl(repositoryRemoteUrl)

  let createCommitArgs: CreateCommitArgs

  if (input.recommitHEAD) {
    const headCommit = await getCommitDetails('HEAD')
    const messageLines = input.message?.split('\n')

    createCommitArgs = {
      subject: messageLines?.[0].trim() ??
          headCommit.subject,
      body: messageLines?.slice(1).join('\n').trim() ??
          headCommit.body,
      parents: headCommit.parents,
      files: headCommit.files.map((file) => ({
        ...file,
        loadContent: async () => readFile(file.path, headCommit.sha),
      })),
    }
  } else {
    if (!input.message) {
      core.setFailed('input message is required')
      return
    }

    const unmergedFiles = await getUnmergedFiles()
    if (unmergedFiles.length > 0) {
      core.setFailed('Committing is not possible because you have unmerged files.')
      console.error('Unmerged files:', unmergedFiles)
      return
    }

    const headCommitSha = await getRev('HEAD')
    const messageLines = input.message.split('\n')
    const cache = await getCacheDetails()

    createCommitArgs = {
      subject: messageLines[0].trim(),
      body: messageLines.slice(1).join('\n').trim(),
      parents: [headCommitSha],
      files: cache.files.map((file) => ({
        ...file,
        loadContent: async () => readFile(file.path),
      })),
    }
  }

  core.info('Creating commit ...')
  if (createCommitArgs.files.length === 0) {
    core.info('nothing to commit, working tree clean')
    return
  }
  const commit = await createCommit(octokit, repository, createCommitArgs)
  core.setOutput('commit', commit.sha)

  core.info('Syncing local repository ...')
  await exec(`git fetch ${input.remoteName} ${commit.sha}`, undefined)
  await exec(`git reset --soft ${commit.sha}`, undefined)
})

