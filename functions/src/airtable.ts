import * as functions from 'firebase-functions'
import * as Airtable from 'airtable'
import { Table, DonationSummary, TableUpdateData } from './types'

const airtable = new Airtable({
  apiKey: functions.config().airtable.key
})

const base = airtable.base(functions.config().airtable.id)

async function fetchTable(tableName: string, options = {}): Promise<Table> {
  const query = base(tableName).select(<Airtable.SelectOptions> options)

  const output: Table = {}

  await query.eachPage((records: any, next: any) => {
    records.forEach((row: any) => {
      output[row.id] = row.fields
    })
    next()
  })
  return output
}

export async function sponsors(): Promise<DonationSummary> {
  const table = await fetchTable('Donor pipeline', { view: 'Website data' })
  const values = Object.values(table)
  const sum = values.reduce((prev, r) => r['Amount for Website'] + prev, 0)
  return {
    amount: sum,
    donors: values.length
  }
}

export async function orders() {
  return fetchTable('Order Tracker', {
    view: 'sync',
    fields: [
      'Hospital', 'Food Supplier', 'Order Status', 'Delivery Date',
      'Delivery Time', 'Number of Meals', 'Postcode', 'Delivery steps',
      'Manager User', 'Estimated food cost', 'Order #', 'Hospital City',
      'modified_timestamp'
    ],
    cellFormat: 'string',
    userLocale: 'en-gb',
    timeZone: 'Europe/London'
  })
}

export async function photoOrders() {
  return fetchTable('Order Tracker', {
    view: 'With photos',
    fields: [
      'Hospital', 'Food Supplier', 'Postcode', 'Hospital City',
      'Delivery Date', 'Number of Meals',
      'PR Photos', 'PR Quotes',
      'modified_timestamp'
    ]
  })
}

export async function hospitals() {
  return fetchTable('Hospitals', {
    view: 'sync',
    fields: [
      'Hospital Display Name',
      'Status Rollup', 'Hospital Name', 'Orders', 'Departments fed',
      'Area', 'NHS Trust', 'Number of orders',
      'Region', 'Local Authority', 'City', 'Postcode', 'Priority Target',
      'modified_timestamp'
    ],
    cellFormat: 'string',
    userLocale: 'en-gb',
    timeZone: 'Europe/London'
  })
}

export async function websiteHospitals() {
  return fetchTable('Hospitals', {
    view: 'Website data',
    fields: [
      'Hospital Display Name'
    ]
  })
}

export async function providers() {
  return fetchTable('Providers', {
    view: 'sync',
    fields: [
      'Restaurant Name', 'Status', 'Orders', 'Cuisine', 'Meal number',
      'Location', 'Restaurant city', 'Contact owner', 'Hygiene rating',
      'Meal Price', 'modified_timestamp'
    ],
    cellFormat: 'string',
    userLocale: 'en-gb',
    timeZone: 'Europe/London'
  })
}

export async function team() {
  return fetchTable('Team', {
    view: 'On Website',
    fields: [
      'Name', 'Bio', 'Team', 'Picture', 'Linkedin',
      'modified_timestamp'
    ]
  })
}



type TableUpdate = {
  tableName: string,
  lookupField: string,
  updateFields: string[],
  newData: TableUpdateData
}

export async function updateTable({ tableName, lookupField, updateFields, newData }: TableUpdate) {
  const currentTable = await fetchTable(tableName)
  const lookupMap: { [key:string]: string } = {}
  Object.entries(currentTable).forEach(([id, fields]) => {
    if (lookupField in fields) {
      lookupMap[fields[lookupField].toString()] = id
    }
  })

  let toUpdate = [], toAdd = []
  const commitThreshold = 10 // from the Airtable docs

  const commit = async (method: string, rows: any) => {
    try {
      await (<any>base(tableName))[method](rows)
      return true
    } catch (e) {
      console.log(e)
      return false
    }
  }

  for (const [key, data] of Object.entries(newData)) {
    const recordId = lookupMap[key]
    const fields: any = {
      'Updated': new Date(),
    }

    updateFields.forEach((field) => {
      fields[field] = data[field]
    })

    if (recordId) {
      toUpdate.push({ id: recordId, fields })
    } else {
      toAdd.push({
        fields: Object.assign({}, fields, { [lookupField]: key })
      })
    }

    if (toUpdate.length >= commitThreshold) {
      const ok = await commit('update', toUpdate)
      if (!ok) {
        return
      }
      toUpdate = []
    }
    if (toAdd.length >= commitThreshold) {
      const ok = await commit('create', toAdd)
      if (!ok) {
        return
      }
      toAdd = []
    }
  }

  if (toUpdate.length > 0) {
    const ok = await commit('update', toUpdate)
    if (!ok) {
      return
    }
  }
  if (toAdd.length > 0) {
    const ok = await commit('create', toAdd)
    if (!ok) {
      return
    }
  }
}

type FieldUpdate = { tableName: string, recordID: string, field: string, value: any }

export async function updateField({ tableName, recordID, field, value } : FieldUpdate) {
  return base(tableName).update([{
    id: recordID,
    fields: {
      [field]: value
    }
  }])
}
