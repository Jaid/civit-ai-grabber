import {firstMatch} from 'super-regex'

export type Input = {
  id: number
  versionId?: number
}

export const getIdFromInput = (input: number | string): Input => {
  if (/^\d+:\d+$/.test(<string> input)) {
    const [id, versionId] = (<string> input).split(`:`)
    return {
      id: Number(id),
      versionId: Number(versionId),
    }
  }
  if (/^\d+$/.test(<string> input)) {
    return {
      id: Number(input),
    }
  }
  const idMatch = firstMatch(/\/models\/(?<id>.+?)($|\/)/, <string> input)
  if (!idMatch) {
    throw new Error(`Could not find model ID in input “${input}”`)
  }
  return {
    id: Number(idMatch.namedGroups.id),
  }
}
