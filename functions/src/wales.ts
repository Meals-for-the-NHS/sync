const cheerio = require('cheerio')
const axios = require('axios')

import { Cases } from './types'

export async function casesWales(): Promise<Cases> {

    const output : Cases = {}
    await axios.get('https://www.livescience.com/wales-coronavirus-updates.html').then((response: { data: any }) => {
      // Load the web page source code into a cheerio instance
      const $ = cheerio.load(response.data)
      const rows = $('#article-body > ul > li')

      for (let i = 0; i < rows.length; i++) {
          var text = ($(rows[i]).text()).split(':')
          if ((text[0] != 'Total') && (text[0] != 'Unknown location')) {
              output[text[0]] = parseInt(text[1].trim())
          }
      }
    })
    return output
}


