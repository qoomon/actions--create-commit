import * as core from '@actions/core'
import * as github from '@actions/github'
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

  const gitStatus = await getGitInfo()
  if (!gitStatus.branch) {
    return core.setFailed('Commit on a detached HEAD is not supported.')
  }

  if (gitStatus.diff.additions?.length === 0 &&
      gitStatus.diff.deletions?.length === 0) {
    return core.setFailed(`On branch ${gitStatus.branch}\n` +
        'Nothing to commit, working tree clean')
  }

  // --------------------------------------------------------------------------

  const branchTree = await octokit.rest.git.getTree({
    ...gitStatus.repository,
    tree_sha: gitStatus.branch,
  }).catch(async (error) => {
    // TODO create new remote branch, if local branch is not pushed already
    throw error
  })
  console.info('branchTree: ', JSON.stringify(branchTree.data, null, 2))

  // TODO ensure if branchTree.data.sha is the same as headSha

  const fileBlobs = {
    additions: await Promise.all(gitStatus.diff.additions.map(async ({path, mode}) => {
      const {data: blob} = await octokit.rest.git.createBlob({
        ...gitStatus.repository,
        content: fs.readFileSync(path).toString('base64'),
        encoding: 'base64',
      })
      return <TreeFile>{
        path,
        mode,
        sha: blob.sha,
        type: 'blob',
      }
    })),
    deletions: gitStatus.diff.deletions.map(({path}) => {
      return <TreeFile>{
        path,
        mode: '100644',
        sha: null,
        type: 'blob',
      }
    }),
  }
  console.info('fileBlobs: ', JSON.stringify(fileBlobs, null, 2))

  const commitTree = await octokit.rest.git.createTree({
    ...gitStatus.repository,
    base_tree: branchTree.data.sha,
    tree: [...fileBlobs.additions, ...fileBlobs.deletions]
  })
  console.info('commitTree: ', JSON.stringify(commitTree.data, null, 2))

  const commit = await octokit.rest.git.createCommit({
    ...gitStatus.repository,
    parents: [gitStatus.head], // TODO maybe use branchTree.data.sha
    tree: commitTree.data.sha,
    message: input.message,
  })
  console.info('commit: ', JSON.stringify(commit.data, null, 2))

  const ref = await octokit.rest.git.updateRef({
    ...gitStatus.repository,
    ref: 'heads/' + gitStatus.branch,
    sha: commit.data.sha,
  })
  console.info('ref: ', JSON.stringify(ref.data, null, 2))

  // TODO move create tag to separate action or rename action
  // const updateTagResponse = await octokit.rest.git.updateRef({
  //   ...repository,
  //   sha: commit.data.sha,
  //   ref: `refs/tags/${tag}`,
  // })

  // sync local branch with remote
  await exec(`git pull origin ${gitStatus.branch}`)
  // restore stash changes
  await exec('git stash pop')
})

interface TreeFile {
  path: string
  mode: '100644' | '100755' | '040000' | '160000' | '120000'
  sha: string | null,
  type: 'blob'
}
