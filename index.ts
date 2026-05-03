import * as core from '@actions/core'
import * as github from '@actions/github'
import {throttling} from '@octokit/plugin-throttling'
// @ts-expect-error No types for "bottleneck/light"
import BottleneckLight from "bottleneck/light.js";
// see https://github.com/actions/toolkit for more github actions libraries
import {bot, exec, getInput, run} from './lib/actions.js'
import {getCacheDetails, getCommitDetails, getCurrentBranch, getRemoteUrl, readFile} from './lib/git.js'
import {createCommit, parseRepositoryFromUrl} from './lib/github.js'

{
  const OriginalGroup = BottleneckLight.Group;

  BottleneckLight.Group = function (options: any) {
    const overrides: Record<string, Partial<typeof options>> = {
      "octokit-global": {maxConcurrent: 10},
      "octokit-write": {maxConcurrent: 10, minTime: 0},
    };

    const patched = {...options, ...(overrides[options.id] ?? {})};
    return new OriginalGroup(patched);
  };

  BottleneckLight.Group.prototype = OriginalGroup.prototype;
}

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

  core.setOutput('commit', null)

  const cacheDetails = await getCacheDetails()
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

  await exec('git', ['commit', ...commitArgs],{
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: bot.name,
      GIT_AUTHOR_EMAIL: bot.email,
      GIT_COMMITTER_NAME: bot.name,
      GIT_COMMITTER_EMAIL: bot.email,
    },
    silent: false,
  })
  console.log('')

  core.startGroup('Creating signed commit via GitHup API ...')

  let throttlingRetryCount = -1
  const octokit = github.getOctokit(input.token, {
    throttle: {
      onRateLimit: (retryAfter, options, octokit, retryCount) => {
        if(retryCount !== throttlingRetryCount){
          octokit.log.warn(`GitHub Api request quota exhausted - Continue after ${retryAfter} seconds...`)
          throttlingRetryCount = retryCount;
        }
        return true
      },
      onSecondaryRateLimit: (retryAfter, options, octokit, retryCount) => {
        if(retryCount !== throttlingRetryCount){
          octokit.log.warn(`GitHub Api request quota exhausted - Continue after ${retryAfter} seconds...`)
          throttlingRetryCount = retryCount;
        }
        return true
      },
    },
  }, throttling);

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

  core.endGroup()

  core.startGroup('Replace local commit with signed commit ...')

  await exec('git fetch', [input.remoteName, githubCommit.sha], {silent: false})
  await exec('git reset', [githubCommit.sha],  {silent: false})

  core.endGroup()

  core.setOutput('commit', githubCommit.sha)
})

if (import.meta.url === `file://${process.argv[1]}`) {
  action()
}
