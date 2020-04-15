const cheerio = require('cheerio')
const axios = require('axios')

import { Cases } from './types'

export async function casesScotland(): Promise<Cases> {
    const output : Cases = {}
    axios.get('https://public.tableau.com/views/RapidCOVID-19virology-Mobilefriendly/Summary?%3AshowVizHome=no&%3Aembed=true#2').then((response) => {
      // Load the web page source code into a cheerio instance
      const $ = cheerio.load(response.data)
      const rows = $('tr')

      for (let i = 1; i < rows.length; i++) {
        console.log(rows[i])
        const first = $($(rows[i]).find('td')[0]).text().trim()
        const second = $($(rows[i]).find('td')[1]).text().trim()
        const secondParsed = second == '' ? 0 : parseInt(second)
        console.log(first,second)
        output[first] = secondParsed
      }
    })
    return output
}

console.log('starting up')
console.log(casesScotland())

