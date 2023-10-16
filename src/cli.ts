import type {ArgumentsCamelCase, Argv, CommandBuilder} from 'yargs'

import {collectInvokeImports} from './command/collectInvokeImports.js'
import main from './command/main.js'
import readFileYaml from 'read-file-yaml'
import yargs from 'yargs'
import {hideBin} from 'yargs/helpers'

// Don’t fully understand this, taken from here: https://github.com/zwade/hypatia/blob/a4f2f5785c146b4cb4ebff44da609a6500c53887/backend/src/start.ts#L47
export type Args = (typeof builder) extends CommandBuilder<any, infer U> ? ArgumentsCamelCase<U> : never
export type CollectInvokeImportsArgs = (typeof collectInvokeImportsBuilder) extends CommandBuilder<any, infer U> ? ArgumentsCamelCase<U> : never
const handler = async (args: Args) => {
  const jobs: Args[] = []
  if (args.input!.endsWith(`.yml`)) {
    const array = await readFileYaml.default(args.input!)
    for (const item of array) {
      jobs.push({
        ...args,
        input: item.url,
        name: item.name,
      })
    }
  } else {
    jobs.push(args)
  }
  for (const [index, job] of jobs.entries()) {
    const time = (new Date).toLocaleTimeString()
    console.log(`[${time}] Job ${index + 1}/${jobs.length}: ${job.input}`)
    try {
      await main(job)
    } catch (error) {
      console.log(`Job failed`)
      console.dir(job, {depth: null})
      console.error(error)
    }
  }
}
const builder = (argv: Argv) => {
  return argv.options({
    appendAuthorName: {
      boolean: true,
      default: true,
      description: "Append author name to the name of the model",
    },
    forceInvokeImport: {
      boolean: true,
      description: "Always output invokeImport.yml, even if heuristics tell it’s not needed",
      default: false,
    },
    input: {
      string: true,
      description: "Either Civit model URL or local path to a yaml array with {name, url} objects",
    },
    outputRootFolder: {
      default: `.`,
      type: `string`,
    },
    prependLoraType: {
      boolean: true,
      default: true,
      description: "Prepend Lora type to the name (character/concept/etc) of the model",
    },
    name: {
      string: true,
      description: "Override the name of the model",
    }
  })
}
const collectInvokeImportsBuilder = (argv: Argv) => {
  return argv.options({
    rootFolder: {
      default: `.`,
      type: `string`,
    },
    targetFile: {
      required: true,
      string: true,
    },
  })
}
await yargs(hideBin(process.argv))
  .detectLocale(false)
  .scriptName(`civit-ai-grabber`)
  .command({
    builder,
    command: `grab <input>`,
    handler,
  })
  .command({
    builder: collectInvokeImportsBuilder,
    command: `collectInvokeInputs <rootFolder> <targetFile>`,
    handler: collectInvokeImports,
  })
  .strict()
  .parserConfiguration({
    'strip-aliased': true,
    'strip-dashed': true,
  })
  .parse()
