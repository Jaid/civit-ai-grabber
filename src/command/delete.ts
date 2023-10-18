import type {ArgumentsCamelCase, Argv, CommandBuilder} from 'yargs'

import {globby} from 'globby'
import * as lodash from 'lodash-es'
import readFileYaml from 'read-file-yaml'

import {toYaml, toYamlFile} from '~/lib/toYaml.js'

export type Args = (typeof builder) extends CommandBuilder<any, infer U> ? ArgumentsCamelCase<U> : never

export const command = `delete <input>`
export const description = 'Delete local Civit content'

export const builder = (argv: Argv) => {
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

export const handler = async (args: Args) => {
console.dir(args)
}
