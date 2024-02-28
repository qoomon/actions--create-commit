import * as core from '@actions/core'
import * as github from '@actions/github'
import {CreateCommitOnBranchPayload} from '@octokit/graphql-schema'
import {exec, getInput, run} from './lib/actions'
// see https://github.com/actions/toolkit for more github actions libraries
import fs from 'fs'

const input = {
  token: getInput('token', {required: true})!,
  message: getInput('message', {required: true})!,
}
const octokit = github.getOctokit(input.token)

run(async () => {
  const commitMessage = await Promise.resolve(input.message)
      .then((it) => it.split('\n'))
      .then((messageLines) => ({
        headline: messageLines[0].trim(),
        body: messageLines.slice(1).join('\n').trim() || undefined,
      }))

  // stash changes not staged for commit
  await exec('git stash push --keep-index')

  const repositoryNameWithOwner = await exec('git remote get-url --push origin')
      .then(({stdout}) => stdout.trim().replace(/.*?([^/:]+\/[^/]+?)(?:\.git)?$/, '$1'))

  const branchName = await exec('git branch --show-current')
      .then(({stdout}) => stdout.trim())

  const headSha = await exec('git rev-parse HEAD')
      .then(({stdout}) => stdout.trim())

  const diffSummary = await exec('git diff --cached --summary')
  if (diffSummary.stdout.match(/^\s*mode change/m)) {
    return core.setFailed('File mode changes are not supported.')
  }

  const diff = {
    // --diff-filter= A(Added) M(Modified)
    additions: await exec('git diff --cached --name-only --diff-filter=AM')
        .then(({stdout}) => stdout.split('\n').filter((path) => path.trim() !== ''))
        .then((paths) => paths.map((path) => ({
          path,
          contents: fs.readFileSync(path).toString('base64'),
        }))),
    // --diff-filter= D(Deleted)
    deletions: await exec('git diff --cached --name-only --diff-filter=D')
        .then(({stdout}) => stdout.split('\n').filter((path) => path.trim() !== ''))
        .then((paths) => paths.map((path) => ({
          path
        }))),
  }

  if (diff.additions?.length === 0 &&
      diff.deletions?.length === 0) {
    return core.setFailed(`On branch ${branchName}\n` +
        'Nothing to commit, working tree clean')
  }

  const commit = await octokit.graphql<{ createCommitOnBranch: CreateCommitOnBranchPayload }>(
      `mutation ($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } } }`,
      {
        input: {
          branch: {repositoryNameWithOwner, branchName},
          expectedHeadOid: headSha,
          fileChanges: {
            additions: diff.additions,
            deletions: diff.deletions,
          },
          message: commitMessage
        }
      })
  core.debug('Commit: '+ commit.createCommitOnBranch.commit?.oid)

  // sync local branch with remote
  await exec(`git pull origin ${branchName}`)
  // restore stash changes
  await exec('git stash pop')
})
