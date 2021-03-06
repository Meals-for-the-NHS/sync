import * as admin from 'firebase-admin'
import 'firebase-functions'
import * as moment from 'moment'
import * as donorbox from './donorbox'
import * as airtable from './airtable'
import { skyCases } from './cases'
import {geocode} from './maps'
import {
  onlyKeys, toSnakeCase, getExtension,
  summariseDonationDay
} from './util'
import {
  Table, DonationsTotal, AirtableRecord, TableUpdateData,
  AirtablePhoto, DonationDay
} from './types'

admin.initializeApp()
export const db = admin.firestore()

// need to initialize before importing
import * as storage from './storage'

export async function donorboxDonations() {
  const newDonations = await donorbox.donations()
  const collectionRef = db.collection('donations')
  const addedDonations = []

  for (const newDonation of newDonations) {
    const {
      id, amount, currency, donation_date, donor,
      comment, processing_fee, join_mailing_list
    } = newDonation
    const docRef = collectionRef.doc(id.toString())
    const doc = await docRef.get()
    if (doc.exists) {
      break
    } else {
      const donation = {
        source: 'donorbox',
        donor: {
          first_name: donor.first_name,
          last_name: donor.last_name,
        },
        amount: parseFloat(amount),
        currency,
        mailing_list: join_mailing_list,
        timestamp: new Date(donation_date),
        comment,
        commented: !!comment,
        donor_box_fee: processing_fee || 0
      }
      await docRef.set(donation)
      addedDonations.push(donation)
    }
  }

  // add each donation summary to the day aggregates
  const days: { [day: string]: { amount: number, timestamp: Date }[] } = {}
  addedDonations.forEach(({amount, timestamp}) => {
    const day = moment(timestamp).format('YYYY-MM-DD')
    const summary = {amount, timestamp}
    if (days[day]) {
      days[day].push(summary)
    } else {
      days[day] = [summary]
    }
  })

  for (const [day, donations] of Object.entries(days)) {
    await db.doc(`aggregates/donations/days/${day}`).set({
      donations: admin.firestore.FieldValue.arrayUnion(...donations)
    }, { merge: true })
    console.log(`updated ${donations.length} on ${day}`)
  }

  return addedDonations.length
}

export async function syncAirTable(name: string, force = false) {
  const airtableData: Table = await (<any>airtable)[name]()
  const dataList = Object.entries(airtableData)
  const collectionName = toSnakeCase(name)
  let updated = 0
  try {
    const modifiedDoc = await db.collection('airtable_util').doc(`${collectionName}_modified`).get()
    const modified = modifiedDoc.data()
    let batch = db.batch()
    for (const record of dataList) {
      const [rec_id, fields] = record
      let timestamp = moment(fields.modified_timestamp, 'D/M/YYYY H:ma')
      if (!timestamp.isValid()) {
        // if record not retrieved as string
        timestamp = moment(fields.modified_timestamp)
      }
      if (force ||
        (!modified || modified[rec_id] === undefined ||
          modified[rec_id].toDate() < timestamp)) {
        const newData = Object.assign({}, fields, {
          record_id: rec_id,
          modified_timestamp: timestamp
        })

        if (timestamp.isValid()) {
          const doc = db.collection(collectionName).doc(rec_id)
          batch.set(doc, newData, { merge: true })
          updated++
        }

        if (updated % 400 === 0) {
          await batch.commit()
          batch = db.batch()
        }
      }
    }
    await batch.commit()
  } catch (e) {
    console.error(e)
  }

  console.log(`updated ${updated}`)
  return updated
}

const customAggregateDispatch: { [collection: string]: (docs: any) => Promise<unknown> } = {}

customAggregateDispatch['hospitals'] = async (docs) => {
  const websiteHospitals: Table = await airtable.websiteHospitals()
  const receivingHospitals = Object.keys(websiteHospitals)
  const receiving = Object.values(docs)
    .filter((h: any) => receivingHospitals.includes(h.record_id))
    .map((h: any) => onlyKeys(h, ['Hospital Name', 'Hospital Display Name', 'coordinates']))

  await db.doc('aggregates/receiving-hospitals').set({
    hospitals: receiving
  })

  await db.doc('aggregates/summary').set({
    num_hospitals_received: receiving.length,
  }, { merge: true })
}

const COMPLETED_ORDER_STATES = ['CONFIRMED', 'PLACED', 'ALLOCATION', 'READY TO BOOK', 'AMENDMENT']

customAggregateDispatch['orders'] = (days) => {
  const startOfYesterday = moment().subtract(1, 'day').startOf('day')
  const endOfYesterday = moment().subtract(1, 'day').endOf('day')
  const hospitals = new Set()
  const providers = new Set()
  const cities = new Set()
  let meals = 0
  let mealsYesterday = 0
  let futureMeals = 0
  let orders = 0

  Object.values(days).forEach((docs: any) => {
    Object.values(docs).forEach((o: any) => {
      const date = moment(o['Delivery Date'], 'D MMMM YYYY')
      if (o['Order Status'] === 'Confirmed' && date < endOfYesterday && o.Hospital) {
        hospitals.add(o.Hospital)
        providers.add(o['Food Supplier'])
        if (o['Hospital City']) {
          cities.add(o['Hospital City'])
        }
        meals += parseInt(o['Number of Meals']) || 0
        orders += 1
      }

      const status = o['Order Status']
      if (status && COMPLETED_ORDER_STATES.includes(status.toUpperCase().trim())) {
        if (date >= startOfYesterday && date < endOfYesterday) {
          mealsYesterday += parseInt(o['Number of Meals']) || 0
        }
        if (date > endOfYesterday) {
          futureMeals += parseInt(o['Number of Meals']) || 0
        }
      }
    })
  })

  return db.doc('aggregates/summary').set({
    num_providers_used: providers.size,
    cities_covered: Array.from(cities),
    num_meals_delivered: meals,
    num_meals_delivered_yesterday: mealsYesterday,
    num_meals_yet_to_deliver: futureMeals,
    num_orders_completed: orders
  }, { merge: true })
}

customAggregateDispatch['photoOrders'] = async (docs) => {
  const photosDocRef = db.doc('photos/orders')
  const photos = await photosDocRef.get()
  const photosCache = photos.data() || {}
  const orders: any = Object.values(docs)
  const updated: { [k: string]: any } = {}
  const photoDocKeys = ['Hospital City', 'Food Supplier', 'Number of Meals']

  for (const order of orders) {
    const fullOrderDoc = await db.collection('orders').doc(order.record_id).get()
    const fullOrder = fullOrderDoc.data()!

    for (const photo of <AirtablePhoto[]>order['PR Photos']) {
      const {filename, id, thumbnails} = photo
      if (!(id in photosCache) && thumbnails && fullOrder) {
        const photoDoc = onlyKeys(fullOrder, photoDocKeys)
        photoDoc.order_id = order.record_id
        photoDoc.date = moment(fullOrder['Delivery Date'], 'D MMMM YYYY')
        photoDoc.filename = `${id}${getExtension(filename)}`
        photoDoc.sizes = []

        for (let size of Object.keys(thumbnails)) {
          const destination = `photo-orders/${size}/${photoDoc.filename}`
          await storage.store({
            url: thumbnails[size].url,
            destination
          })

          photoDoc.sizes.push(size)
        }
        updated[id] = photoDoc
        console.log('added', id)
        // update as we go so if the function times out we don't lose anything
        await photosDocRef.set(updated, { merge: true })
      }
    }
  }
}

const masterFields: { [c: string]: string[] } = {
  'orders': [
    'Hospital City', 'Delivery Date', 'Food Supplier', 'Hospital',
    'Number of Meals', 'Order Status'
  ],
  'hospitals': [
    'Status Rollup', 'Hospital Name', 'Local Authority', 'City',
    'Postcode', 'coordinates', 'record_id'
  ]
}

export async function createMaster(collection: string) {
  const collectionName = toSnakeCase(collection)
  const snapshot = await db.collection(collectionName).get()

  if (collectionName === 'orders') {
    const days: { [day: string]: { [key: string]: any } } = {}
    snapshot.forEach((doc) => {
      const order = onlyKeys(doc.data(), masterFields['orders'])
      const date = moment(order['Delivery Date'], 'D MMMM YYYY')
      const dateKey = date.format('YYYY-MM-DD')
      const day = days[dateKey]
      if (day) {
        day[doc.id] = order
      } else {
        days[dateKey] = {
          [doc.id]: order
        }
      }
    })
    const batch = db.batch()
    for (const [day, data] of Object.entries(days)) {
      const doc = db.doc(`aggregates/orders/days/${day}`)
      batch.set(doc, data)
    }
    await batch.commit()

    await customAggregateDispatch['orders'](days)
  }
  else {
    const docs: { [key: string]: any } = {}
    snapshot.forEach((doc) => {
      const data = doc.data()
      if (collection in masterFields) {
        docs[doc.id] = onlyKeys(data, masterFields[collection])
      } else {
        docs[doc.id] = data
      }
    })
    console.log(`creating master for ${collectionName}`)
    await db.collection('aggregates').doc(collectionName).set(docs)

    if (collection in customAggregateDispatch) {
      await customAggregateDispatch[collection](docs)
    }
  }
}

export async function updateModifiedTimestamps(collection: string, record: AirtableRecord) {
  const {record_id, modified_timestamp} = record
  if (modified_timestamp) {
    return db.collection('airtable_util').doc(`${toSnakeCase(collection)}_modified`).set({
      [record_id]: modified_timestamp
    }, {merge: true})
  }
  return false
}

export async function getAirtable(name: string) {
  const doc = await db.collection('aggregates').doc(name).get()
  return Object.values(doc.data()!)
}

export async function updateDonationsTotal(before: DonationDay, after: DonationDay) {
  let { amount, donors } = summariseDonationDay(after)
  if (before) {
    const beforeData = summariseDonationDay(before)
    amount -= beforeData.amount
    donors -= beforeData.donors
  }

  const docRef = db.doc('aggregates/donations')
  const doc = await docRef.get()
  const current = doc.data()!
  let ca = 0, cd = 0
  if (current.donorbox) {
    ca = current.donorbox.amount || 0
    cd = current.donorbox.donors || 0
  }
  return docRef.set({
    donorbox: {
      amount: ca + amount,
      donors: cd + donors
    }
  }, { merge: true })
}

export async function hospitalSponsors() {
  const sponsors = await airtable.sponsors()
  return db.doc('aggregates/donations').set({
    sponsors
  }, { merge: true })
}

export function addDonationsToSummary(data: DonationsTotal) {
  return db.doc('aggregates/summary').set({
    donations: data
  }, { merge: true })
}

export async function updateCasesAirtable() {
  const newData: TableUpdateData = {}

  const allCases = await skyCases()
  allCases.forEach(({ name, cases }) => {
    newData[name] = {
      'Cumulative Cases': cases,
    }
  })

  return airtable.updateTable({
    tableName: 'Cases (All hospitals)',
    lookupField: 'Local Authority',
    updateFields: ['Cumulative Cases'], // no population for now  'Population'],
    newData
  })
}

export async function donationsAirtable() {
  const snapshot = await db.collection('aggregates').doc('donations').collection('days').get()
  const newData: TableUpdateData = {}
  const docsList: { id: string, data: any }[] = []

  snapshot.forEach((doc) => {
    docsList.push({
      id: doc.id,
      data: doc.data()
    })
  })

  docsList.sort((a, b) => a.id.localeCompare(b.id))

  let cumulativeAmount = 0, cumulativeDonors = 0
  docsList.forEach((doc) => {
    const { id, data } = doc
    const { amount, donors } = summariseDonationDay(data)
    cumulativeAmount += amount
    cumulativeDonors += donors

    newData[id] = {
      'Amount': amount,
      'Donors': donors,
      'Cumulative Amount': cumulativeAmount,
      'Cumulative Donors': cumulativeDonors
    }
  })

  return airtable.updateTable({
    tableName: 'Donations',
    lookupField: 'Date',
    updateFields: ['Amount', 'Donors', 'Cumulative Amount', 'Cumulative Donors'],
    newData
  })
}


export async function insertCoordinates(snapshot: admin.firestore.DocumentSnapshot) {
  const data = snapshot.data()
  if (data && !data.coordinates) {
    const candidates = ['Location', 'Postcode', 'postcode']
    let key = null
    candidates.forEach((c) => {
      if (c in data) {
        key = c
      }
    })
    if (key) {
      try {
        const coordinates = await geocode(data[key])
        return snapshot.ref.update({
          coordinates
        })
      } catch (e) {
        console.log(`error in geocode ${data[key]}`)
        return false
      }
    }
  }
  return false
}

export async function updateHospitalsWithCloseProviders() {
  const hospitalsQuery = await db.collection('hospitals').get()
  const hospitals: any[] = []
  hospitalsQuery.forEach((doc) => {
    hospitals.push(doc.data())
  })

  for (const hospital of hospitals) {
    if (hospital.close_providers) {
      const providers = hospital.close_providers
        .filter((p: any) => p.Status && p.Status.match(/deliver/i))
        .map((p: any) => p.record_id)
      console.log(providers)
      try {
        await airtable.updateField({
          tableName: 'Hospitals',
          recordID: hospital.record_id,
          field: 'Providers within 30mins',
          value: providers
        })
      } catch (e) {
        console.error(e)
      }
    }
  }
}
