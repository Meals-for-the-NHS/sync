import * as functions from 'firebase-functions'
import * as Airtable from 'airtable'
import { DonationSummary, Cases } from './types'

type Table = {
  [key: string]: { [k: string]: any }
}

const airtable = new Airtable({
  apiKey: functions.config().airtable.key
})

const base = airtable.base(functions.config().airtable.id)

async function fetchTable(tableName: string, options = {}): Promise<Table> {
  const query = base(tableName).select(options)
  const output: Table = {}

  await query.eachPage((records: any, next: any) => {
    records.forEach((row: any) => {
      output[row.id] = row.fields
    })
    next()
  })
  return output
}

export async function donations(): Promise<DonationSummary> {
  const table = await fetchTable('Sponsor a Hospital', { view: 'Website data' })  
  const values = Object.values(table)
  const sum = values.reduce((prev, r) => r['Amount for Website'] + prev, 0)
  return {
    amount: sum,
    donors: values.length
  }
}

export async function orders() {
  const table = await fetchTable('Order Tracker', { view: 'Raw' })
  return table
}

export async function updateCases(casesByLA: Cases) {
  const tableName = 'Cases (All hospitals)'
  const currentTable = await fetchTable(tableName)
  const laMap: { [la:string]: string } = {}
  Object.entries(currentTable).forEach(([id, fields]) => {
    laMap[fields['Local Authority']] = id
  })

  const cases = Object.entries(casesByLA)
  let toUpdate = [], toAdd = []
  for (const laCase of cases) {
    const [la, noCases] = laCase
    const recordId = laMap[la]

    if (recordId) {
      toUpdate.push({
        id: laMap[la],
        fields: {
          'Cumulative Cases': noCases,
          'Updated': new Date()
        }
      })
    } else {
      toAdd.push({
        fields: {
          'Local Authority': la,
          'Cumulative Cases': noCases,
          'Updated': new Date()
        }
      })
    }
      
    if (toUpdate.length >= 10) {
      await base(tableName).update(toUpdate)
      toUpdate = []
    }
    if (toAdd.length >= 10) {
      await base(tableName).create(toAdd)
      toAdd = []
    }
  }

  if (toUpdate.length > 0) {
    await base(tableName).update(toUpdate)
  }
  if (toAdd.length > 0) {
    await base(tableName).create(toAdd)
  }
}
