import fetch from 'node-fetch'
import { Cases } from './types'

export async function casesByLocalAuthority(): Promise<Cases> {
  const url = 'https://interactive.guim.co.uk/2020/coronavirus-uk-local-data/ladata.json'
  const response = await fetch(url)
  const caseData = await response.json()
  const output: Cases  = {}
  // const countries = ['scotdata', 'walesdata']
  // countries.forEach((country) => {
  //   caseData[country].forEach(({ board, cases }: { board: string, cases: string }) => {
  //     if (board !== 'Wales total') {
  //       output[board] = parseInt(cases)
  //     }
  //   })
  // })

  // england
  caseData.ladata.features.forEach(({ attributes }: { attributes: { GSS_NM: string, TotalCases: number } }) => {
    const { GSS_NM, TotalCases } = attributes
    output[GSS_NM] = TotalCases
  })

  return output
}
