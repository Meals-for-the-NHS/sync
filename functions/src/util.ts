export const thousands = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

export const onlyKeys = (o: any, keys: string[]) => {
  const output: { [k: string] : any } = {}
  Object.entries(o)
    .filter(([k, _]) => keys.includes(k))
    .forEach(([k, v]) => {
      output[k] = v
    })
  return output
}
