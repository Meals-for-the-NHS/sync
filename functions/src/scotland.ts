const cheerio = require('cheerio')
const axios = require('axios')

import { Cases } from './types'

export async function casesScotland(): Promise<Cases> {
    const output : Cases = {}
    await axios.get('https://www.gov.scot/publications/coronavirus-covid-19-tests-and-cases-in-scotland/').then((response) => {
      // Load the web page source code into a cheerio instance
      const $ = cheerio.load(response.data)
      const rows = $('table:first-of-type tr')

      for (let i = 1; i < rows.length; i++) {

        const first = $($(rows[i]).find('td')[0]).text().trim()
        const second = $($(rows[i]).find('td')[1]).text().trim()
        const secondParsed = second == '' ? 0 : parseInt(second)
        output[first] = secondParsed
      }
    })
    return output
}

