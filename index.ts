import core from '@actions/core'
import * as _github  from '@actions/github'
import {exec, getInput, getYamlInput, run} from './lib/github-actions-utils'
// see https://github.com/actions/toolkit for more github actions libraries
import {z} from 'zod'
import fs from 'fs'

run(async () => {
  const context = _github.context
  const input = {
    token: getInput('token', {required: true})!,
    message: getInput('message', {required: true})!,

  }
  const github = _github.getOctokit(input.token)

  // --------------------------------------------------------------------------

  const repositoryNameWithOwner = await exec('git remote get-url --push origin')
      .then(({stdout}) => stdout.trim().replace(/.*?([^/:]+\/[^/]+?)(?:\.git)?$/, '$1'))

  const branchName = await exec('git branch --show-current')
      .then(({stdout}) => stdout.trim())

  const expectedHeadOid = await exec('git rev-parse HEAD')
      .then(({stdout}) => stdout.trim())

  const fileChanges = {
    additions: await exec('git diff --cached --name-only --diff-filter=AM')
        .then(({stdout}) => stdout.split('\n').filter(path => path.trim() !== ''))
        .then((paths) => paths.map((path) => ({
          path,
          contents: fs.readFileSync(path).toString('base64'),
        }))),
    deletions: await exec('git diff --cached --name-only --diff-filter=D')
        .then(({stdout}) => stdout.split('\n').filter(path => path.trim() !== ''))
        .then((paths) => paths.map((path) => ({path}))),
  }

  const messageLines = input.message.split('\n')
  const createCommitOnBranchInput = {
    branch: {
      repositoryNameWithOwner,
      branchName,
    },
    expectedHeadOid,
    fileChanges,
    message: {
      headline: messageLines[0].trim(),
      body: messageLines.slice(1).join('\n').trim() || undefined,
    },
  }

  console.info('CreateCommitOnBranchInput:', JSON.stringify({
    ...createCommitOnBranchInput,
    fileChanges: {
      additions: createCommitOnBranchInput.fileChanges.additions.map(({path}) => path),
      deletions: createCommitOnBranchInput.fileChanges.deletions,
    }
  }, null, 2))

  // noinspection GraphQLUnresolvedReference
  const commit: {
    createCommitOnBranch: { commit: { oid: string } }
  } = await github.graphql(`mutation ($input: CreateCommitOnBranchInput!) {
    createCommitOnBranch(input: $input) {
      commit {
        oid
      }
    }
  }`, {input: createCommitOnBranchInput})

  console.log('Commit:', commit.createCommitOnBranch.commit.oid)

  await exec(`git pull origin ${branchName}`)
})
