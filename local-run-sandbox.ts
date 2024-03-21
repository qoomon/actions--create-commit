import * as process from 'process'
import {exec} from './lib/actions.js'
import {action} from './index.js'

const actionDir = process.cwd()
console.log('actionDir', actionDir)
process.chdir('/tmp/uKbOisIc7J/sandbox')

// Prepare the repository
await exec('git reset --hard origin/master')
for (let i = 0; i < 100; i++) {
  await exec(`sh -c "date > dummy${i}.txt"`)
  await exec(`git add dummy${i}.txt`)
}

// await exec('sh -c "curl https://raster.shields.io/badge/date-$(date |  tr \' \' \'_\')-blue > dummy.png')
// await exec('git add dummy.png')

// ---------------------------------------------------------------------------------------------------------------------

// Set action input environment variables
setActionInputs({
  // 'skip-empty': 'true',
  'allow-empty': 'true',
  'message': 'work work',
  'token': process.env['GITHUB_TOKEN']!,
})

// Run the action
action()

// ---------------------------------------------------------------------------------------------------------------------

/**
 * Set action input environment variables
 * @param inputs - input values
 * @returns void
 */
function setActionInputs(inputs: Record<string, string | undefined>) {
  Object.entries(inputs).forEach(([name, value]) => {
    process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] = value
  })
}
