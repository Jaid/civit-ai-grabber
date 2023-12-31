import type {ArgumentsCamelCase, Argv, CommandBuilder} from 'yargs'

import path from 'node:path'
import {pipeline} from 'node:stream/promises'

import chalk from 'chalk'
import fs from 'fs-extra'
import got from 'got'
import * as lodash from 'lodash-es'
import pRetry from 'p-retry'
import prettyBytes from 'pretty-bytes'
import readFileYaml from 'read-file-yaml'

import {cleanString} from '~/lib/cleanString.js'
import {getIdFromInput as parseInput} from '~/lib/getIdFromInput.js'
import {toYamlFile} from '~/lib/toYaml.js'

const authGot = got.extend({
  searchParams: {
    token: `f63ebf63e7d01f53291696c51e49215e`,
  },
})
const apiGot = authGot.extend({
  prefixUrl: `https://civitai.com/api/v1`,
  responseType: `json`,
})

// Don’t fully understand this, taken from here: https://github.com/zwade/hypatia/blob/a4f2f5785c146b4cb4ebff44da609a6500c53887/backend/src/start.ts#L47
export type Args = (typeof builder) extends CommandBuilder<any, infer U> ? ArgumentsCamelCase<U> : never

type CivitModel = {
  creator: ModelCreator
  description: string
  id: number
  modelVersions: CivitModelVersion[]
  name: string
  nsfw: boolean
  tags: string[]
  type: "LoCon" | "VAE" | 'AestheticGradient' | 'Checkpoint' | 'Controlnet' | 'Hypernetwork' | 'LORA' | 'Poses' | 'TextualInversion'
}
type CivitModelVersion = {
  baseModel: "Other" | "SD 1.4" | "SD 1.5" | "SD 2.0 768" | "SD 2.0" | "SD 2.1 768" | "SD 2.1 Unclip" | "SD 2.1" | "SDXL 0.9" | "SDXL 1.0"
  createdAt: string
  description: string
  downloadUrl: string
  files: CivitFile[]
  id: number
  name: string
  trainedWords: string[]
  updatedAt: string
}
type CivitFile = {
  downloadUrl: string
  hashes: {
    AutoV2: string
    BLAKE3: string
    CRC32: string
    SHA256: string
  }
  id: number
  metadata: {
    format: 'Other' | 'PickleTensor' | 'SafeTensor'
    fp: 'bf16' | 'fp16' | 'fp32'
    size: 'full' | 'pruned'
  }
  name: string
  sizeKB: number
  type: 'Config' | 'Model' | 'VAE'
}
type ModelCreator = {
  image: string
  username: string
}

const modelTypeToFolderMap: Record<string, string> = {
  checkpoint: `checkpoint`,
  controlnet: `controlnet`,
  locon: `lycoris`,
  lora: `lora`,
  textualinversion: `embedding`,
  vae: `vae`,
}
const modelGenerationToFolderMap: Record<string, string> = {
  "sd 1.4": `1.4`,
  "sd 1.5": `1.5`,
  "sd 2.0": `2.0`,
  "sd 2.0 768": `2.0`,
  "sd 2.1": `2.1`,
  "sd 2.1 768": `2.1`,
  "sd 2.1 unclip": `2.1`,
  "sdxl 0.9": `xl_0.9`,
  "sdxl 1.0": `xl`,
}
const prependLoraTag = (name: string, model: CivitModel) => {
  const tags = new Set([
    `character`,
    `style`,
    `celebrity`,
    `concept`,
    `clothing`,
    `poses`,
    `background`,
    `buildings`,
    `vehicle`,
    `objects`,
    `animal`,
    `action`,
    `assets`,
  ])
  const tagFromModel = model.tags.find(tag => tags.has(tag))
  if (!tagFromModel) {
    return name
  }
  return `[${lodash.capitalize(tagFromModel)}] ${name}`
}
const main = async (args: Args) => {
  const input = parseInput(args.input)
  if (args.versionId) {
    input.versionId = args.versionId
  }
  const modelResponse = await apiGot(`models/${input.id}`, {
    responseType: `json`,
  })
  if (modelResponse.statusCode !== 200) {
    throw new Error(`Could not fetch model: ${modelResponse.body}`)
  }
  const model = <CivitModel> modelResponse.body
  let selectedVersion
  if (input.versionId) {
    selectedVersion = model.modelVersions.find(version => version.id === input.versionId)
    if (!selectedVersion) {
      throw new Error(`Could not find version ${input.versionId}`)
    }
  } else {
    selectedVersion = model.modelVersions.find(version => version.baseModel === `SDXL 1.0`)
    if (!selectedVersion) {
      throw new Error(`Could not find SDXL 1.0 version`)
    }
    const latestVersion = model.modelVersions[0]
    if (selectedVersion.id !== latestVersion.id) {
      console.log(`- latest version is ${latestVersion.name} (${latestVersion.id}), but SDXL 1.0 version is ${selectedVersion.name} (${selectedVersion.id})`)
    }
  }
  let nameCleaned = cleanString(args.name ?? model.name)
  if (args.appendAuthorName) {
    nameCleaned += ` (${model.creator.username})`
  }
  if ([`lora`, `lycoris`].includes(model.type.toLowerCase()) && args.prependLoraType) {
    nameCleaned = prependLoraTag(nameCleaned, model)
  }
  const outputFolderSegments: string[] = [
    args.outputRootFolder,
    modelGenerationToFolderMap[selectedVersion.baseModel.toLowerCase()] ?? `etc`,
    modelTypeToFolderMap[model.type.toLowerCase()] ?? `etc`,
    nameCleaned,
  ]
  if (args.nsfw) {
    nameCleaned = `NSFW ${nameCleaned}`
  }
  const versionNameCleaned = cleanString(selectedVersion.name)
  console.log(chalk.blue(`Model: ${nameCleaned} (${model.id})`))
  console.log(chalk.blue(`Version: ${versionNameCleaned} (${selectedVersion.id})`))
  const outputFolder = path.join(...outputFolderSegments)
  // console.log(`Output folder: ${path.resolve(outputFolder)}`)
  const jsonFile = path.join(outputFolder, `model.json`)
  const urlFile = path.join(outputFolder, `${nameCleaned}.url`)
  await fs.outputJson(jsonFile, model)
  console.log(chalk.yellowBright(`- save ${jsonFile}`))
  const urlFileExists = await fs.pathExists(urlFile)
  const modelUrl = `https://civitai.com/models/${input.id}`
  if (!urlFileExists) {
    await fs.outputFile(urlFile, `[InternetShortcut]\nURL=${modelUrl}`)
    console.log(chalk.yellowBright(`- save ${urlFile}`))
  }
  const versionFolder = path.join(outputFolder, versionNameCleaned)
  await fs.ensureDir(versionFolder)
  const calculateCheckpointWorth = (civitFile: CivitFile) => {
    let worth = 0
    if (civitFile.metadata.format === `SafeTensor`) {
      worth += 100
    }
    if (civitFile.metadata.size === `full`) {
      worth += 1000
    }
    if (civitFile.metadata.fp) {
      worth += Number(civitFile.metadata.fp.replaceAll(/\D/g, ``))
      const fpType = civitFile.metadata.fp.replaceAll(/\d/g, ``)
      if (fpType === `bf`) {
        worth += 1
      }
    }
    return worth
  }
  const getFileDisplayName = (civitFile: CivitFile, allowSpaces = false) => {
    try {
      if (civitFile.type === `Config`) {
        return `Config`
      }
      const segments: string[] = []
      segments.push(nameCleaned)
      segments.push(versionNameCleaned)
      if (civitFile.metadata.format !== `SafeTensor`) {
        segments.push(civitFile.metadata.format)
      }
      if (civitFile.metadata.fp) {
        segments.push(civitFile.metadata.fp)
      }
      if (civitFile.metadata.size && civitFile.metadata.size !== `full`) {
        segments.push(civitFile.metadata.size)
      }
      if (civitFile.type === `VAE`) {
        segments.push(`VAE`)
      }
      if (model.type === `TextualInversion`) {
        return segments.join(`_`).toLowerCase().replaceAll(` `, `_`).replaceAll(/[^\d\-_a-z]/g, ``).replaceAll(/_+/g, `_`)
      }
      if (allowSpaces) {
        return segments.join(` `)
      } else {
        return segments.join(`_`).replaceAll(` `, `_`)
      }
    } catch (error) {
      console.error(`Could not get file display name for civit file:`, civitFile.id)
      console.dir(civitFile)
      throw error
    }
  }
  const usedTagsRegex = /[^!](?<tag>[^\s!&()]+)/g
  const query = `a b`
  const match = query.match(usedTagsRegex)
  const getFileName = (civitFile: CivitFile) => {
    if (civitFile.type === `Config`) {
      return `config.yml`
    }
    const originalExtension = civitFile.name.split(`.`).at(-1)
    const displayName = getFileDisplayName(civitFile)
    return `${displayName}.${originalExtension}`
  }
  const selectSkippedFiles = (civitVersion: CivitModelVersion) => {
    if (model.type !== `Checkpoint`) {
      return []
    }
    const checkpointFiles = civitVersion.files.filter(file => file.type === `Model`)
    if (checkpointFiles.length === 0) {
      throw new Error(`Could not find any checkpoint files`)
    }
    if (checkpointFiles.length === 1) {
      return []
    }
    const sortedCheckpointFiles = checkpointFiles.sort((a, b) => calculateCheckpointWorth(b) - calculateCheckpointWorth(a))
    const badFiles = sortedCheckpointFiles.slice(1)
    console.log(`- ignoring checkpoints: ${badFiles.map(file => getFileDisplayName(file)).join(`, `)}`)
    const badIds = badFiles.map(file => file.id)
    return badIds
  }
  const skippedFiles = selectSkippedFiles(selectedVersion)
  const chosenFiles: CivitFile[] = []
  for (const civitFile of selectedVersion.files) {
    const fileName = getFileName(civitFile)
    if (skippedFiles.includes(civitFile.id)) {
      console.log(`- skip ${fileName} (not needed)`)
      continue
    }
    chosenFiles.push(civitFile)
  }
  let downloadedFiles = 0
  for (const civitFile of chosenFiles) {
    const fileName = getFileName(civitFile)
    const file = path.join(versionFolder, fileName)
    const fileExists = await fs.pathExists(file)
    if (fileExists) {
      console.log(`- skip ${fileName} (already exists)`)
      continue
    }
    const download = async () => {
      console.log(chalk.yellow(`- down ${fileName} from ${civitFile.downloadUrl} (${Math.floor(civitFile.sizeKB / 1000)} mb)`))
      return pipeline(authGot.stream(civitFile.downloadUrl), fs.createWriteStream(file))
    }
    await pRetry(download, {
      onFailedAttempt: async error => {
        console.log(`- fail ${fileName} (${error.attemptNumber}/${error.retriesLeft})`)
        console.error(error)
        await fs.remove(file)
      },
      retries: 3,
    })
    downloadedFiles++
  }
  const invokeImportFile = path.join(versionFolder, `invokeImport.yml`)
  const invokeImportFileExists = await fs.pathExists(invokeImportFile)
  if (args.forceInvokeImport || downloadedFiles > 0 || !invokeImportFileExists) {
    const formatMap: {[Key in CivitModel["type"]]?: {folder: string, type?: string}} = {
      Checkpoint: {
        folder: `main`,
        type: `checkpoint`,
      },
      LoCon: {
        folder: `lora`,
        type: `lycoris`,
      },
      LORA: {
        folder: `lora`,
        type: `lycoris`,
      },
      TextualInversion: {
        folder: `embedding`,
      },
      VAE: {
        folder: `vae`,
        type: `checkpoint`,
      },
    }
    const formatInfo = formatMap[model.type]
    if (!formatInfo) {
      console.log(`Can’t create invokeImport.yml for model type ${model.type}`)
      return
    }
    const mainFile = chosenFiles.find(file => file.type === `Model`)
    if (!mainFile) {
      console.log(`No main file found, skipping invokeImport.yml creation`)
      return
    }
    const mainFileStat = await fs.stat(path.join(versionFolder, getFileName(mainFile)))
    console.log(chalk.yellowBright(`- save invokeImport.yml`))
    const importDisplayName = getFileDisplayName(mainFile, true)
    const importIdFolder = [`sdxl`, formatInfo.folder].join(`/`)
    const importId = [importIdFolder, importDisplayName].join(`/`)
    const invokeImport: Record<string, number | string | null> = {
      format: formatInfo.type ?? null,
      path: path.resolve(versionFolder, getFileName(mainFile)),
    }
    const invokeImportDescription: string[] = []
    if (!lodash.isEmpty(selectedVersion.trainedWords)) {
      invokeImportDescription.push(`[ ${selectedVersion.trainedWords.map(word => word.trim()).join(` | `)} ]`)
    }
    if (!lodash.isEmpty(model.tags)) {
      invokeImportDescription.push(model.tags.map(tag => tag.trim()).join(`, `))
    }
    invokeImportDescription.push(prettyBytes(mainFileStat.size))
    invokeImportDescription.push(modelUrl)
    invokeImport.description = invokeImportDescription.join(` | `)
    if (model.type === `Checkpoint`) {
      invokeImport.width = 1024
      invokeImport.height = 1024
      invokeImport.variant = `normal`
      const configExists = await fs.pathExists(path.join(versionFolder, `config.yml`))
      if (configExists) {
        invokeImport.config = path.resolve(versionFolder, `config.yml`)
      } else {
        invokeImport.config = `configs/stable-diffusion/sd_xl_base.yaml`
      }
    }
    const invokeImportYaml: Record<string, unknown> = {
      [importId]: invokeImport,
    }
    const vaeFile = chosenFiles.find(file => file.type === `VAE`)
    if (vaeFile) {
      const vaeImportIdFolder = [`sdxl`, formatMap.VAE?.folder].join(`/`)
      const vaeImportDisplayName = getFileDisplayName(vaeFile, true)
      const vaeImportId = [vaeImportIdFolder, vaeImportDisplayName].join(`/`)
      const vaeImport = {
        description: `${invokeImport.description} (VAE)`,
        format: formatMap.VAE?.type,
        path: path.resolve(versionFolder, getFileName(vaeFile)),
      }
      invokeImportYaml[vaeImportId] = vaeImport
    }
    await toYamlFile(invokeImportYaml, invokeImportFile)
  }
}
export const command = `grab <input>`
export const description = `Download and update Civit content`
export const builder = (argv: Argv) => {
  return argv.options({
    appendAuthorName: {
      boolean: true,
      default: true,
      description: `Append author name to the name of the model`,
    },
    forceInvokeImport: {
      boolean: true,
      description: `Always output invokeImport.yml, even if heuristics tell it’s not needed`,
      default: false,
    },
    input: {
      string: true,
      description: `Either Civit model URL or local path to a yaml array with {name, url} objects`,
      required: true,
    },
    nsfw: {
      boolean: true,
      default: false,
      description: `Mark as NSFW`,
    },
    outputRootFolder: {
      default: `.`,
      type: `string`,
    },
    prependLoraType: {
      boolean: true,
      default: true,
      description: `Prepend Lora type to the name (character/concept/etc) of the model`,
    },
    versionId: {
      number: true,
      description: `Force the version of the model instead of using the latest`,
    },
    name: {
      string: true,
      description: `Override the name of the model`,
    },
  })
}
export const handler = async (args: Args) => {
  const jobs: Args[] = []
  if (args.input!.endsWith(`.yml`)) {
    const array = await readFileYaml.default(args.input!)
    for (const item of array) {
      jobs.push({
        ...args,
        input: item.url,
        nsfw: item.nsfw,
        versionId: item.version,
        name: item.name,
      })
    }
  } else {
    jobs.push(args)
  }
  for (const [index, job] of jobs.entries()) {
    const time = (new Date).toLocaleTimeString()
    console.log(chalk.blue(`[${time}] Job ${index + 1}/${jobs.length}: ${job.input}`))
    try {
      await main(job)
    } catch (error) {
      console.log(`Job failed`)
      console.dir(job, {depth: null})
      console.error(error)
    }
  }
}
