import { db } from './sync'
import * as airtable from './airtable'

export async function hospitalsSummary() {
  const doc = await db.doc('aggregates/hospitals').get()
  const hospitals = doc.data()!

  const hospitalsList = Object.values(hospitals)

  let orders = 0
  const localAuthorities = new Set()

  for (const hospital of hospitalsList) {
    orders += parseInt(hospital['Number of orders'])

    const la = hospital['Local Authority']
    console.log(la)
    localAuthorities.add(hospital['Local Authority'])
  }

  return {
    orders, // same as orders: orders
    localAuthorities: Array.from(localAuthorities)
  }
}

export async function exampleAirtableUpdate() {
  const newData = {
    id1: {
      Field1: 23,
      Field2: 45
    },
    id2: {
      Field1: 91,
      Field2: 56
    }
  }

  await airtable.updateTable({
    tableName: 'SomeTableName',
    lookupField: 'the field that we index by',
    updateFields: ['Field1', 'Field2'],
    newData
  })
}
