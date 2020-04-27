import fetch from 'node-fetch'
import { Cases } from './types'

export async function skyCases(): Promise<Cases> {
  // https://news.sky.com/story/coronavirus-uk-tracker-how-many-cases-are-in-your-area-updated-daily-11956258
  const url = 'https://dy24yas6mnljt.cloudfront.net/files/uk-nhs-covid19.json'
  const response = await fetch(url)
  const payload = await response.json()
  const output: Cases = []

  const keys = {
    england: 'authorities',
    wales: 'boards',
    scotland: 'boards'
  }

  Object.entries(keys).forEach(([country, key]) => {
    const dailyCases = payload[country][key]
    const latestCases: { [k:string]: number }  = dailyCases[dailyCases.length - 1]
    Object.entries(latestCases).forEach(([placeOrKey, n]) => {
      if (placeOrKey.match(/^[A-Z]/)) {
        output.push({ name: placeOrKey, cases: n })
      }
    })
  })

  return output
}
