import {firstMatch} from 'super-regex'

export const getIdFromInput = (input: number | string): number => {
  if (/^\d+$/.test(<string> input)) {
    return Number(input)
  }
  const idMatch = firstMatch(/\/models\/(?<id>.+?)($|\/)/, <string> input)
  if (!idMatch) {
    throw new Error(`Could not find model ID in input “${input}”`)
  }
  return Number(idMatch.namedGroups.id)
}
