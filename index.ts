import * as core from '@actions/core'
import * as github from '@actions/github'
import {bot, getInput, run} from './lib/actions.js'
import {exec} from '@actions/exec'
import {getCacheDetails, getCommitDetails, getRemoteUrl, readFile} from './lib/git.js'
import {createCommit, parseRepositoryFromUrl} from './lib/github.js'
import * as process from "node:process";
import {colorize, NullWritable} from "./lib/common";

if(process.env['RUNNER_DEBUG'] !== '1') {
  console.debug = (...args) => {}
}

export const action = () => run(async () => {
  const input = {
    token: getInput('token', {required: true})!,
    add: getInput('add'),
    commit: getInput('commit'),
    commitSkipEmpty: getInput('commit-skip-empty')?.toLowerCase() === 'true',
    push: getInput('push'),
    remoteName: getInput('remote-name') || 'origin',
  }

  core.setOutput('commit', null)

  await exec(`git status`, [], {outStream: new NullWritable()})

  if (input.add) {
    await exec(`git add ${input.add}`)
  }

  const cacheDetails = await getCacheDetails()
  if (cacheDetails.files.length === 0 && input.commitSkipEmpty) {
    core.info('nothing to commit, working tree clean')
    return
  }

  await exec(`git commit ${input.commit}`, [], {
    env: {
      GIT_AUTHOR_NAME: bot.name,
      GIT_AUTHOR_EMAIL:bot.email,
      GIT_COMMITTER_NAME: bot.name,
      GIT_COMMITTER_EMAIL:bot.email,
    }
  })

  core.info(colorize('Create commit via GitHub API', 'blue'))
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

  await exec('git fetch', [input.remoteName, githubCommit.sha])
  await exec('git reset', [githubCommit.sha])

  core.setOutput('commit', githubCommit.sha)

  if (input.push) {
    await exec(`git push ${input.push !== 'true' ? ` ${input.push}` : ''}`)
  }
})

if (import.meta.url === `file://${process.argv[1]}`) {
  action()
}
