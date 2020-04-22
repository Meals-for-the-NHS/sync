import fetch from 'node-fetch'
import {Cases} from './types'

const cheerio = require('cheerio')
const axios = require('axios')


export async function casesByLocalAuthority(): Promise<Cases> {
//  const url = 'https://interactive.guim.co.uk/2020/coronavirus-uk-local-data/ladata.json'
    const url = 'https://cf.eip.telegraph.co.uk/embeds/bespoke-coronavirus-api/data/regional.json'
    const response = await fetch(url)
    const caseData = await response.json()
    const output: Cases = {}

    // england
    type Entry = {
        id: string
        name: string,
        pop: number,
        cases: number
    }

    caseData.localAuthorities.forEach((point: Entry) => {
        const {id, name, pop, cases} = point
        output[id] = {name, pop, cases}
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
        const secondParsed = second == '' ? 0 : parseInt(second)

        asJson.push({
            'name': first,
            'id': first,
            'pop': 0,
            'cases': secondParsed
        })
    }

    type Entry = {
        id: string
        name: string,
        pop: number,
        cases: number
    }

    asJson.forEach((point: Entry) => {
        const {id, name, pop, cases} = point
        output[id] = {name, pop, cases}
    })
    console.log(output)

    return output
}


export async function casesWales(): Promise<Cases> {
    const output: Cases = {}
    const asJson = []
    const response = await axios.get('https://www.livescience.com/wales-coronavirus-updates.html')

    const $ = cheerio.load(response.data)
    const rows = $('#article-body > ul > li')

    for (let i = 0; i < rows.length; i++) {
        var text = ($(rows[i]).text()).split(':')
        if ((text[0] != 'Total') && (text[0] != 'Unknown location')) {
            asJson.push(
                {
                    'name': text[0],
                    'id': text[0],
                    'pop': 0,
                    'cases': parseInt(text[1].trim())
                })
        }
    }

    type Entry = {
        id: string
        name: string,
        pop: number,
        cases: number
    }

    asJson.forEach((point: Entry) => {
        const {id, name, pop, cases} = point
        output[id] = {name, pop, cases}
    })
    return output
}

