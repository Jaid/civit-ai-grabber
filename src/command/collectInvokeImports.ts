import type {CollectInvokeImportsArgs as Args} from '../cli.js'

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

export const collectInvokeImports = async (args: Args) => {
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
