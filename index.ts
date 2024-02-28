import * as core from '@actions/core'
import * as github from '@actions/github'
import {CreateCommitOnBranchInput, CreateCommitOnBranchPayload} from '@octokit/graphql-schema'
import {exec, getInput, run} from './lib/actions'
// see https://github.com/actions/toolkit for more github actions libraries
import fs from 'fs'
import {getGitInfo} from "./lib/git";

const input = {
  token: getInput('token', {required: true})!,
  message: getInput('message', {required: true})!,
}
const octokit = github.getOctokit(input.token)

run(async () => {
  // stash changes not staged for commit
  await exec('git stash push --keep-index')

  const gitInfo = await getGitInfo()
  console.log('gitInfo: ', JSON.stringify(gitInfo, null, 2))
  if (!gitInfo.branch) {
    return core.setFailed('Commit on a detached HEAD is not supported.')
  }

  if (gitInfo.diff.additions?.length === 0 &&
      gitInfo.diff.deletions?.length === 0) {
    // TODO maybe ignore
    return core.setFailed(`On branch ${gitInfo.branch}\n` +
        'Nothing to commit, working tree clean')
  }

  // --------------------------------------------------------------------------

  const diffSummary = await exec('git diff --cached --summary')
  if (diffSummary.stdout.match(/^\s*mode change/m)) {
    return core.setFailed('File mode changes are not supported.')
  }

  const commit = await octokit.graphql<{ createCommitOnBranch: CreateCommitOnBranchPayload }>(
      `mutation ($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } } }`,
      {
        input: <CreateCommitOnBranchInput>{
          branch: {
            repositoryNameWithOwner: `${gitInfo.repository.owner}/${gitInfo.repository.repo}`,
            branchName: gitInfo.branch,
          },
          expectedHeadOid: gitInfo.head,
          fileChanges: {
            additions: gitInfo.diff.additions.map(({path}) => ({
              path,
              contents: fs.readFileSync(path).toString('base64'),
            })),
            deletions: gitInfo.diff.deletions,
          },
          message: messageObjectOf(input.message)
        }
      })
  core.debug('Commit: ' + commit.createCommitOnBranch.commit?.oid)

  // sync local branch with remote
  await exec(`git pull origin ${gitInfo.branch}`)
  // restore stash changes
  await exec('git stash pop')
})

function messageObjectOf(message: string) {
  const messageLines = message.split('\n')
  return {
    headline: messageLines.shift()?.trim(),
    body: messageLines.join('\n').trim() || undefined,
  }
}
