import * as core from '@actions/core'
import {InputOptions} from '@actions/core'
import YAML from 'yaml'
import {HttpClientError} from '@actions/http-client'
import * as _exec from '@actions/exec'
import {ExecOptions} from '@actions/exec'

/**
 * Run action and catch errors
 * @param action - action to run
 * @returns void
 */
export function run(action: () => Promise<void>): void {
  action().catch(async (error: unknown) => {
    core.setFailed('Unhandled error, see job logs')
    console.error('Error:', error)
    if (error instanceof HttpClientError) {
      console.error('Http response:', error.result)
    }
  })
}

/**
 * Gets string value of an input.
 * Unless trimWhitespace is set to false in InputOptions, the value is also trimmed.
 * Returns null if the value is not defined.
 *
 * @param     name     name of the input to get
 * @param     options  optional. See InputOptions.
 * @returns   parsed input as object
 */
export function getInput(name: string, options?: InputOptions): string | null {
  return core.getInput(name, options) || null
}

/* eslint-disable  @typescript-eslint/no-explicit-any */
/**
 * Gets the yaml value of an input.
 * Unless trimWhitespace is set to false in InputOptions, the value is also trimmed.
 * Returns null if the value is not defined.
 *
 * @param     name     name of the input to get
 * @param     options  optional. See InputOptions.
 * @returns   parsed input as object
 */
export function getYamlInput(name: string, options?: InputOptions): any | null {
  const input = getInput(name, options)
  if (input === null) return null
  return YAML.parse(input)
}

/**
 * Execute a command and get the output.
 * @param commandLine - command to execute (can include additional args). Must be correctly escaped.
 * @param options - optional exec options. See ExecOptions
 * @returns status, stdout and stderr
 */
export async function exec(commandLine: string, options?: ExecOptions) {
  const result = {status: 0, stdout: '', stderr: ''}
  result.status = await _exec.exec(commandLine, undefined, {
    ...options,
    listeners: {
      stdout(data) {
        result.stdout += data.toString()
      },
      stderr(data) {
        result.stderr += data.toString()
      },
    },
  })
  return result
}
