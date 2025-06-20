import {exec} from './actions.js'
import {NullWritable} from "./common";

/**
 * Get the remote url of the repository.
 * @param remoteName - remote name
 * @returns remote url
 */
export async function getRemoteUrl(remoteName: string = 'origin'): Promise<string> {
  return await exec('git remote get-url --push', [remoteName], {
    outStream: new NullWritable(),
  }).then(({stdout}) => stdout.toString().trim())
}

/**
 * Get the commit details.
 * @param ref - ref to get the details for.
 * @returns commit details
 */
export async function getCommitDetails(ref: string = 'HEAD'): Promise<CommitDetails> {
  const result = <CommitDetails>{}

  const fieldsSeparator = '---'
  const showOutputLines = await exec('git show --raw --cc', [
    '--format=' + [
      'commit:%H',
      'tree:%T',
      'parent:%P',
      'author.name:%aN',
      'author.email:%aE',
      'author.date:%ai',
      'committer.name:%cN',
      'committer.email:%cE',
      'committer.date:%ci',
      'subject:%s',
      'body:',
      '%b',
      fieldsSeparator,
    ].join('%n'),
    ref,
  ], {
    outStream: new NullWritable(),
  }).then(({stdout}) => stdout.toString().split('\n'))
  const eofBodyIndicatorIndex = showOutputLines.lastIndexOf(fieldsSeparator)
  const showOutputFieldLines = showOutputLines.slice(0, eofBodyIndicatorIndex)
  const showOutputFileLines = showOutputLines.slice(eofBodyIndicatorIndex + 1 + 1, -1)

  const showFieldLinesIterator = showOutputFieldLines.values()
  for (const line of showFieldLinesIterator) {
    const lineMatch = line.match(/^(?<lineValueName>[^:]+):(?<lineValue>.*)$/)
    if (!lineMatch) throw new Error(`Unexpected field line: ${line}`)
    const {lineValueName, lineValue} = lineMatch.groups as { lineValueName: string, lineValue: string }
    switch (lineValueName) {
      case 'commit':
        result.sha = lineValue
        break
      case 'tree':
        result.tree = lineValue
        break
      case 'parent':
        result.parents = lineValue.split(' ')
        break
      case 'author.name':
        result.author = result.author ?? {}
        result.author.name = lineValue
        break
      case 'author.email':
        result.author = result.author ?? {}
        result.author.email = lineValue
        break
      case 'author.date':
        result.author = result.author ?? {}
        result.author.date = new Date(lineValue)
        break
      case 'committer.name':
        result.committer = result.committer ?? {}
        result.committer.name = lineValue
        break
      case 'committer.email':
        result.committer = result.committer ?? {}
        result.committer.email = lineValue
        break
      case 'committer.date':
        result.committer = result.committer ?? {}
        result.committer.date = new Date(lineValue)
        break
      case 'subject':
        result.subject = lineValue
        break
      case 'body':
        // read all remaining lines
        result.body = [...showFieldLinesIterator].join('\n')
        break
      default:
        throw new Error(`Unexpected field: ${lineValueName}`)
    }
  }

  result.files = showOutputFileLines
      .map(parseRawFileDiffLine)
      .filter(({status}) => ['A', 'M', 'D'].includes(status)) as
      (ReturnType<typeof parseRawFileDiffLine> & { status: 'A' | 'M' | 'D' })[]

  return result
}

/**
 * Get the cached details.
 * @returns cached details
 */
export async function getCacheDetails(): Promise<CacheDetails> {
  const result = <CacheDetails>{}

  const diffOutputFileLines = await exec('git diff --cached --raw --cc', [], {
    outStream: new NullWritable(),
  }).then(({stdout}) => stdout.toString().split('\n').filter(Boolean))

  result.files = diffOutputFileLines
      .map(parseRawFileDiffLine)
      .filter(({status}) => ['A', 'M', 'D'].includes(status)) as
      (ReturnType<typeof parseRawFileDiffLine> & { status: 'A' | 'M' | 'D' })[]

  return result
}

/**
 * Parse a line from the raw diff output.
 * @param line - line to parse
 * @returns parsed line
 */
function parseRawFileDiffLine(line: string): RawFileDiff {
  const fileMatch = line.match(/^:+(?:(?<mode>\d{6}) ){2,}(?:\w{7,} ){2,}(?<status>[A-Z])\w*\s+(?<path>.*)$/)
  if (!fileMatch) throw new Error(`Unexpected file line: ${line}`)

  return {
    status: fileMatch.groups!.status,
    mode: fileMatch.groups!.mode,
    path: fileMatch.groups!.path,
  }
}

/**
 * Read the content of the file at the given path.
 * @param path - path to the file
 * @param ref - ref to read the file from. If not set, the cached file is read.
 * @returns file content
 */
export async function readFile(path: string, ref?: string): Promise<Buffer> {
  const object = ref ? `${ref}:${path}` : await getCachedObjectSha(path)
  return await exec('git cat-file blob', [object], {silent: true})
      .then(({stdout}) => stdout)
}

/**
 * Get the sha of the cached object for the given path.
 * @param path - path to the file
 * @returns sha of the cached object
 */
async function getCachedObjectSha(path: string) {
  return await exec('git ls-files --cached --stage', [path], {silent: false})
      // example output: 100644 5492f6d1d15ac444387259da81d19b74b3f2d4d6 0  dummy.txt
      .then(({stdout}) => stdout.toString().split(/\s/)[1])
}

export type CommitDetails = {
  sha: string
  tree: string
  parents: string[]
  author: {
    name: string
    email: string
    date: Date
  }
  committer: {
    name: string
    email: string
    date: Date
  }
  subject: string
  body: string
  files: {
    path: string,
    mode: string
    status: 'A' | 'M' | 'D'
  }[]
}

export type CacheDetails = {
  files: {
    path: string,
    mode: string
    status: 'A' | 'M' | 'D'
  }[]
}

type RawFileDiff = {
  mode: string
  path: string
  status: string
}
