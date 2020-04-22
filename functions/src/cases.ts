import fetch from 'node-fetch'
import { Cases } from './types'

export async function casesByLocalAuthority(): Promise<Cases> {
//  const url = 'https://interactive.guim.co.uk/2020/coronavirus-uk-local-data/ladata.json'
  const url = 'https://cf.eip.telegraph.co.uk/embeds/bespoke-coronavirus-api/data/regional.json'
  const response = await fetch(url)
  const caseData = await response.json()
  const output: Cases  = {}

  // england
  type Entry = {
    id: string
    name: string,
    pop: number,
    cases: number
  }

  caseData.localAuthorities.forEach((point: Entry) => {
    const { id, name, pop, cases } = point
    output[id] = { name, pop, cases }
  })

  return output
}
