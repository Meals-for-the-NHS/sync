export const thousands = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export const toSnakeCase = (s: string) => s.replace(/([a-z]|(?=[A-Z]))([A-Z])/g, '$1_$2').toLowerCase()

export const getExtension = (s: string) => {
  const m = s.match(/(?:\.([^.]+))?$/)
  return m && m[0] || null
}

export const onlyKeys = (o: any, keys: string[]) => {
  const output: { [k: string] : any } = {}
  Object.entries(o)
    .filter(([k, _]) => keys.includes(k))
    .forEach(([k, v]) => {
      output[k] = v
    })
  return output
}
