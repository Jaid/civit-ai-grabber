import type {ArgumentsCamelCase, Argv, CommandBuilder} from 'yargs'

import {globby} from 'globby'
import * as lodash from 'lodash-es'
import readFileYaml from 'read-file-yaml'

import {toYaml, toYamlFile} from '~/lib/toYaml.js'

type InvokeYaml = Record<string, InvokeImport>
type InvokeImport = {
  description?: string
  format: string | null
  height?: number
  path: string
  variant?: string
  width?: number
}

// Don’t fully understand this, taken from here: https://github.com/zwade/hypatia/blob/a4f2f5785c146b4cb4ebff44da609a6500c53887/backend/src/start.ts#L47
export type Args = (typeof builder) extends CommandBuilder<any, infer U> ? ArgumentsCamelCase<U> : never

export const command = `collectInvokeInputs <rootFolder> <targetFile>`
export const description = `Copy import definitions from local Civit content folder to Invoke`

export const builder = (argv: Argv) => {
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

export const handler = async (args: Args) => {
  const readInvokeYaml = async () => {
    const yamlObject = <InvokeYaml> await readFileYaml.default(args.targetFile)
    return yamlObject
  }
  const readInvokeImports = async () => {
    const yamls = await globby(`**/invokeImport.yml`, {
      absolute: true,
      cwd: args.rootFolder,
    })
    const merge: InvokeYaml = {}
    for (const yaml of yamls) {
      const yamlObject = <InvokeImport> await readFileYaml.default(yaml)
      Object.assign(merge, yamlObject)
    }
    return merge
  }
  const [invokeYaml, invokeImports] = await Promise.all([
    readInvokeYaml(),
    readInvokeImports(),
  ])
  const missingImports = <InvokeYaml> lodash.omit(invokeImports, Object.keys(invokeYaml))
  for (const missingImport of Object.values(missingImports)) {
    console.log(`New:    ${missingImport.path}`)
  }
  const matchingKeys = lodash.intersection(Object.keys(invokeYaml), Object.keys(invokeImports))
  const changes = {}
  for (const key of matchingKeys) {
    const externalInvokeImport = invokeImports[key]
    const internalInvokeImport = invokeYaml[key]
    if (lodash.isEqual(externalInvokeImport, internalInvokeImport)) {
      continue
    }
    changes[key] = externalInvokeImport
    console.log(`Update: ${key}`)
  }
  Object.assign(invokeYaml, changes)
  Object.assign(invokeYaml, missingImports)
  console.log(`New entries: ${lodash.size(missingImports)}`)
  console.log(`Updated entries: ${lodash.size(changes)}`)
  if (!lodash.isEmpty(changes) || !lodash.isEmpty(missingImports)) {
    console.log(`Writing ${args.targetFile}`)
    await toYamlFile(invokeYaml, args.targetFile)
  }
}
