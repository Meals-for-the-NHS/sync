import fetch from 'node-fetch'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { Cases } from './types'

type Entry = {
  id: string
  name: string,
  pop?: number,
  cases: number
}

export async function casesByLocalAuthority(): Promise<Cases> {
  //  const url = 'https://interactive.guim.co.uk/2020/coronavirus-uk-local-data/ladata.json'
  const url = 'https://cf.eip.telegraph.co.uk/embeds/bespoke-coronavirus-api/data/regional.json'
  const response = await fetch(url)
  const caseData = await response.json()
  const output: Cases = {}

  caseData.localAuthorities.forEach((point: Entry) => {
    const { id, name, pop, cases } = point
    output[id] = { name, pop, cases }
  })

  return output
}

export async function casesScotland(): Promise<Cases> {
  const output: Cases = {}
  const response = await axios.get('https://www.gov.scot/publications/coronavirus-covid-19-tests-and-cases-in-scotland/')
  const $ = cheerio.load(response.data)
  const rows = $('table:first-of-type tr')
  const asJson = []

  for (let i = 0; i < rows.length; i++) {
    const first = $($(rows[i]).find('td')[0]).text().trim()
    const second = $($(rows[i]).find('td')[1]).text().trim()
    const secondParsed = parseInt(second)
    if (secondParsed) {
      asJson.push({
        'name': first,
        'id': first,
        'cases': secondParsed
      })
    }
  }

  asJson.forEach((point: Entry) => {
    const { id, name, cases } = point
    output[id] = { name, cases }
  })

  return output
}


export async function casesWales(): Promise<Cases> {
  const output: Cases = {}
  const asJson = []
  const response = await axios.get('https://www.livescience.com/wales-coronavirus-updates.html')

  const $ = cheerio.load(response.data)
  const rows = $('#article-body > ul > li')

  for (let i = 0; i < rows.length - 3; i++) { // don't do last 3 rows
    var text = ($(rows[i]).text()).split(':')
    asJson.push({
      'name': text[0],
      'id': text[0],
      'cases': parseInt(text[1].trim())
    })
  }

  asJson.forEach((point: Entry) => {
    const { id, name, cases } = point
    output[id] = { name, cases }
  })
  return output
}
