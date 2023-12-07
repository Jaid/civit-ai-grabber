export const shrinkWhitespace = (input: string) => input.trim().replaceAll(/\s+/g, ` `)

export const trimLength = (input: string, maxLength = 30) => input.trim().slice(0, maxLength)
