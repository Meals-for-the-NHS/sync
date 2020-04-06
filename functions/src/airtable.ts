import * as functions from 'firebase-functions'
import * as Airtable from 'airtable'
import { DonationSummary } from './types'

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
