import type {InputOptions} from '~/lib/types/InputOptions.js'

// "sd 1.4": `1.4`,
// "sd 1.5": `1.5`,
// "sd 2.0": `2.0`,
// "sd 2.0 768": `2.0`,
// "sd 2.1": `2.1`,
// "sd 2.1 768": `2.1`,
// "sd 2.1 unclip": `2.1`,
// "sdxl 0.9": `xl_0.9`,
// "sdxl 1.0": `xl`,

type StableDiffusionVersion = `1.4` | `1.5` | `2.0` | `2.1` | `xl_0.9` | `xl`
type OptionsMeta = InputOptions<{
  defaultsType: typeof defaultOptions
  optionalOptions: {
    title: string
  }
  requiredOptions: {
    url: string
  }
}>

export type Options = OptionsMeta["parameter"]
export const defaultOptions = {
  stableDiffusionVersion: <StableDiffusionVersion> `xl`,
}

export default class RemoteModel {
  private readonly options: OptionsMeta["merged"]
  constructor(options: Options) {
    this.options = {
      ...defaultOptions,
      ...options,
    }
  }
  get downloadUrl() {
    return this.options.url
  }
  get stableDiffusionVersion() {
    return this.options.stableDiffusionVersion
  }
  get title() {
    if (this.options.title) {
      return this.options.title
    }
    return this.downloadUrl.toLowerCase().replaceAll(/[^\da-z]+/g, `-`)
  }
}
