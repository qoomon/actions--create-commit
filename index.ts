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
  await exec('git', [
    '-c', `user.name=${bot.name}`,
    '-c', `user.email=${bot.email}`,
    'commit', ...commitArgs,
  ])

  let throttlingRetryCount = -1
  const octokit = github.getOctokit(input.token, {
    throttle: {
      onRateLimit: (retryAfter, options, octokit, retryCount) => {
        if(retryCount !== throttlingRetryCount){
          octokit.log.warn(`GitHub Api request quota exhausted - Retrying after ${retryAfter} seconds...`)
          throttlingRetryCount = retryCount;
        }
        return true

      },
      onSecondaryRateLimit: (retryAfter, options, octokit, retryCount) => {
        if(retryCount !== throttlingRetryCount){
          octokit.log.warn(`GitHub Api request quota exhausted - Retrying after ${retryAfter} seconds...`)
          throttlingRetryCount = retryCount;
        }
        return true
      },
    },
  }, throttling);

  const headCommit = await getCommitDetails('HEAD')
  const repositoryRemoteUrl = await getRemoteUrl(input.remoteName)
  const repository = parseRepositoryFromUrl(repositoryRemoteUrl)

  core.startGroup('creating commit...')
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
  await exec('git fetch', [input.remoteName, githubCommit.sha])
  await exec('git reset', [githubCommit.sha])
  core.endGroup()

  console.log()
  exec(`git show -s --format="[${await getCurrentBranch()} %h] %s" --shortstat --summary`, [githubCommit.sha])
      .then(({stdout}) => console.info(stdout.toString()))

  core.setOutput('commit', githubCommit.sha)
})

if (import.meta.url === `file://${process.argv[1]}`) {
  action()
}
