import type {ArgumentsCamelCase, Argv, CommandBuilder} from 'yargs'

import path from 'node:path'

import fs from 'fs-extra'
import {globby} from 'globby'
import * as lodash from 'lodash-es'
import {pathEqual} from 'path-equal'
import readFileYaml from 'read-file-yaml'

import {getIdFromInput} from '~/lib/getIdFromInput.js'
import {toYamlFile} from '~/lib/toYaml.js'

export type Args = (typeof builder) extends CommandBuilder<any, infer U> ? ArgumentsCamelCase<U> : never

type ModelInfo = {
  id: number | string
}

export const command = `delete <input>`
export const description = `Delete local Civit content`

export const builder = (argv: Argv) => {
  return argv.options({
    input: {
      description: `Either Civit model URL or local path to a yaml array with {name, url} objects`,
      required: true,
      string: true,
    },
    rootFolder: {
      default: `.`,
      required: true,
      type: `string`,
    },
    targetFile: {
      string: true,
    },
  })
}

export const handler = async (args: Args) => {
  const id = getIdFromInput(args.input)
  const modelInfoFiles = await globby(`*/*/*/model.json`, {
    absolute: true,
    cwd: args.rootFolder,
  })
  let modelFolder: string | undefined
  for (const modelInfoFile of modelInfoFiles) {
    const modelInfo = <ModelInfo> await fs.readJson(modelInfoFile)
    if (Number(modelInfo.id) === id) {
      modelFolder = path.dirname(modelInfoFile)
      break
    }
  }
  if (!modelFolder) {
    throw new Error(`Could not find model with ID “${id}”`)
  }
  console.dir({
    id,
    modelFolder,
  })
  await fs.remove(modelFolder)
  console.log(`Deleted`)
  if (args.targetFile) {
    const targetFileExists = await fs.pathExists(args.targetFile)
    if (!targetFileExists) {
      throw new Error(`Target file “${args.targetFile}” does not exist`)
    }
    const yamlObject = <any> await readFileYaml.default(args.targetFile)
    const keysBefore = lodash.size(yamlObject)
    const cleanedYamlObject = lodash.pickBy(yamlObject, (value, key) => {
      if (!value.path) {
        return true
      }
      const reference = <string> value.path
      const referenceBaseFolder = path.dirname(path.dirname(reference))
      if (pathEqual(referenceBaseFolder, modelFolder)) {
        console.log(`Removing “${key}” from models.yaml`)
        return false
      }
      return true
    })
    const keysAfter = lodash.size(cleanedYamlObject)
    if (keysBefore !== keysAfter) {
      console.log(`Removed ${keysBefore - keysAfter} entries`)
      console.log(`Saving to ${args.targetFile}`)
    }
    await toYamlFile(cleanedYamlObject, args.targetFile)
  }
}
