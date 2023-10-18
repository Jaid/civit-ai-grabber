import fs from 'fs-extra'
import yaml from 'yaml'

export const toYaml = (input: unknown) => yaml.stringify(input, undefined, {
  lineWidth: 0,
  minContentWidth: 0,
  nullStr: `~`,
  schema: `core`,
  singleQuote: true,
})

export const toYamlFile = async (input: unknown, file: string) => {
  await fs.outputFile(file, toYaml(input))
}
