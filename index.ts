import * as core from '@actions/core'
import * as github from '@actions/github'
import {CreateCommitOnBranchInput, CreateCommitOnBranchPayload} from '@octokit/graphql-schema'
import {exec, getInput, run} from './lib/actions'
// see https://github.com/actions/toolkit for more github actions libraries
import fs from 'fs'

const input = {
  token: getInput('token', {required: true})!,
  message: getInput('message', {required: true})!,
}
const octokit = github.getOctokit(input.token)

run(async () => {
  // stash changes not staged for commit
  await exec('git stash push --keep-index')

  const diffSummary = await exec('git diff --cached --summary')
  if (diffSummary.stdout.match(/^\s*mode change/m)) {
    return core.setFailed('File mode changes are not supported.')
  }

  const createCommitOnBranchInput = <CreateCommitOnBranchInput>{
    branch: {
      repositoryNameWithOwner: await exec('git remote get-url --push origin')
          .then(({stdout}) => stdout.trim().replace(/.*?([^/:]+\/[^/]+?)(?:\.git)?$/, '$1')),
      branchName: await exec('git branch --show-current')
          .then(({stdout}) => stdout.trim()),
    },
    expectedHeadOid: await exec('git rev-parse HEAD')
        .then(({stdout}) => stdout.trim()),
    fileChanges: {
      additions: await exec('git diff --cached --diff-filter=AM --name-only')
          .then(({stdout}) => stdout.split('\n').filter((path) => path.trim() !== ''))
          .then((paths) => paths.map((path) => ({
            path,
            contents: fs.readFileSync(path).toString('base64'),
          }))),
      deletions: await exec('git diff --cached --diff-filter=D --name-only')
          .then(({stdout}) => stdout.split('\n').filter((path) => path.trim() !== ''))
          .then((paths) => paths.map((path) => ({path}))),
    },
    message: await Promise.resolve(input.message)
        .then((it) => it.split('\n'))
        .then((messageLines) => ({
          headline: messageLines[0].trim(),
          body: messageLines.slice(1).join('\n').trim() || undefined,
        })),
  }

  if (createCommitOnBranchInput.fileChanges?.additions?.length === 0 &&
      createCommitOnBranchInput.fileChanges?.deletions?.length === 0) {
    return core.setFailed(`On branch ${createCommitOnBranchInput.branch.branchName}\n` +
        'Nothing to commit, working tree clean')
  }

  console.info('CreateCommitOnBranchInput:', JSON.stringify({
    ...createCommitOnBranchInput,
    fileChanges: {
      additions: createCommitOnBranchInput.fileChanges?.additions?.map(({path}) => path),
      deletions: createCommitOnBranchInput.fileChanges?.deletions,
    },
  }, null, 2))

  const commit = await octokit.graphql<{ createCommitOnBranch: CreateCommitOnBranchPayload }>(
      `mutation ($input: CreateCommitOnBranchInput!) {
      createCommitOnBranch(input: $input) {
        commit {
          oid
        }
      }
    } `, {input: createCommitOnBranchInput})

  console.log('Commit:', commit.createCommitOnBranch.commit?.oid)

  // sync local branch with remote
  await exec(`git pull origin ${createCommitOnBranchInput.branch.branchName}`)
  // restore stash changes
  await exec('git stash pop')
})
