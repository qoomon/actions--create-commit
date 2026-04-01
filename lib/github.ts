import * as github from '@actions/github'
import pLimit from 'p-limit'

const octokitLimit = pLimit(10)

/**
 * Create a commit authored and committed by octokit token identity.
 * In case of octokit token identity is a GitHub App the commit will be signed as well.
 * @param octokit - GitHub client
 * @param repository - target repository
 * @param args - commit details and file content reader
 * @returns created commit
 */
export async function createCommit(octokit: ReturnType<typeof github.getOctokit>, repository: {
  owner: string,
  repo: string
}, args: CreateCommitArgs) {
  console.debug('creating commit ...')

  let commitTreeSha = args.tree
  if (args.files.length > 0) {
    console.debug('  creating commit tree ...')

    const commitTreeEntries = await Promise.all(args.files.map(async ({path, mode, status, loadContent}) => {
      console.debug('     ', path, '...')
      switch (status) {
        case 'A':
        case 'M': {
          const content = await loadContent()
          // Use the content field directly in the tree entry to avoid N separate
          // blob creation API calls — GitHub will create the blobs internally as
          // part of the single createTree call. Binary files (detected by null
          // bytes) must still use explicit blob creation with base64 encoding
          // since the content field only accepts UTF-8 strings.
          const isBinary = isBinaryContent(content)
          if (isBinary) {
              console.debug('    creating blob ...')
              const blob = await octokitLimit(() => octokit.rest.git.createBlob({
                ...repository,
                content: content.toString('base64'),
                encoding: 'base64',
              })).then(({data}) => data)
            
              return <TreeFile>{
                path,
                mode,
                sha: blob.sha,
                type: 'blob',
              }
          }

          return <TreeFile>{
            path,
            mode,
            content: content.toString('utf8'),
            type: 'blob',
          }

        }
        case 'D':
          return <TreeFile>{
            path,
            mode: '100644',
            sha: null,
            type: 'blob',
          }
        default:
          throw new Error(`Unexpected file status: ${status}`)
      }
    }))

    commitTreeSha = await octokit.rest.git.createTree({
      ...repository,
      base_tree: args.parents[0],
      tree: commitTreeEntries,
    }).then(({data}) => data.sha)
    console.debug('  commit tree', '->', commitTreeSha)
  }

  const commit = await octokit.rest.git.createCommit({
    ...repository,
    parents: args.parents,
    tree: commitTreeSha,
    message: args.subject + '\n\n' + args.body,

    // DO NOT set author or committer otherwise commit will not be signed
    // author: {
    //   name: localCommit.author.name,
    //   email: localCommit.author.email,
    //   date: localCommit.author.date.toISOString(),
    // },

    // If used with GitHub Actions GITHUB_TOKEN following values are used
    // author.name:     github-actions[bot]
    // author.email:    41898282+github-actions[bot]@users.noreply.github.com
    // committer.name:  GitHub
    // committer.email: noreply@github.com

  }).then(({data}) => data)
  console.debug('commit', '->', commit.sha)

  return commit
}

/**
 * Get repository owner and name from url.
 * @param url - repository url
 * @returns repository owner and name
 */
export function parseRepositoryFromUrl(url: string) {
  // git@github.com:qoomon/sandbox.git
  // https://github.com/qoomon/sandbox.git
  const urlMatch = url.trim().match(/.*?(?<owner>[^/:]+)\/(?<repo>[^/]+?)(?:\.git)?$/)
  if (!urlMatch) throw new Error(`Invalid github repository url: ${url}`)
  return {
    owner: urlMatch.groups!.owner!,
    repo: urlMatch.groups!.repo!,
  }
}

/**
 * Detect binary content by checking for null bytes (0x00).
 * Text files (including empty files) contain no null bytes,
 * while binary files almost always do.
 * @param content - file content buffer
 * @returns true if the content contains null bytes indicating binary data
 */
function isBinaryContent(content: Buffer): boolean {
  return content.includes(0x00)
}

export type CreateCommitArgs = {
  subject: string
  body: string
  parents: string[]
  tree: string,
  files: {
    path: string
    mode: '100644' | '100755' | '040000' | '160000' | '120000' | string
    status: 'A' | 'M' | 'D',
    loadContent: () => Promise<Buffer>
  }[],
}

export type TreeFile = {
  path: string
  mode: '100644' | '100755' | '040000' | '160000' | '120000'
  sha?: string | null,
  content?: string,
  type: 'blob'
}
