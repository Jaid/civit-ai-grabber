export const cleanString = (input: string, maxLength = 30) => {
  const shortInput = input.trim().slice(0, maxLength)
  return shortInput.replaceAll(`.`, `_`).replaceAll(/[^\d \-_a-z]/gi, ``).replaceAll(/\s+/g, ` `)
}
