import * as admin from 'firebase-admin'
import 'firebase-functions'
import * as moment from 'moment'
import * as donorbox from './donorbox'
import * as airtable from './airtable'
import * as guardian from './guardian'
import { geocode } from './geocode'
import { Table, Donation, DonationSummary, AirtableRecord, TableUpdateData } from './types'

admin.initializeApp()
const db = admin.firestore()

export async function donorboxDonations() {
  const donations = await donorbox.donations()
  const collectionRef = db.collection('donations')
  let count = 0
  for (; count < donations.length; count++) {
    const donation = donations[count]
    const {
      id, amount, currency, donation_date, donor,
      comment, processing_fee, join_mailing_list
    } = donation
    const docRef = collectionRef.doc(id.toString())
    const doc = await docRef.get()
    if (doc.exists) {
      break
    } else {
      await docRef.set({
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
        donor_box_fee: processing_fee || 0
      })
    }
  }
  console.log(`updated ${count}`)
  return count
}

export async function syncAirTable(name: string, force = false) {
  const airtableData: Table  = await (<any>airtable)[name]()
  const dataList = Object.entries(airtableData)
  let updated = 0
  try {
    const modifiedDoc = await db.collection('airtable_util').doc(`${name}_modified`).get()
    const modified = modifiedDoc.data()
    let batch = db.batch()
    for (const record of dataList) {
      const [rec_id, fields] = record
      const timestamp = moment(fields.modified_timestamp, 'D/M/YYYY H:ma')
      if (force ||
          (!modified || modified[rec_id] === undefined ||
            modified[rec_id].toDate() < timestamp)) {
        const newData = Object.assign({}, fields, {
          record_id: rec_id,
          modified_timestamp: timestamp
        })

        if (timestamp.isValid()) {
          const doc = db.collection(name).doc(rec_id)
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

export async function createMaster(collection: string) {
  const snapshot = await db.collection(collection).get()
  const docs: { [key:string]: any } = {}
  snapshot.forEach((doc) => {
    docs[doc.id] = doc.data()
  })
  console.log(`creating master for ${collection}`)
  await db.collection('aggregates').doc(collection).set(docs)
}

export async function updateModifiedTimestamps(collection: string, record: AirtableRecord) {
  const { record_id, modified_timestamp } = record
  if (modified_timestamp) {
    return db.collection('airtable_util').doc(`${collection}_modified`).set({
      [record_id]: modified_timestamp
    }, { merge: true })
  }
  return false
}

export async function getAirtable(name: string) {
  const doc = await db.collection('aggregates').doc(name).get()
  return Object.values(doc.data()!)
}

export async function updateDonationDay(donation: Donation) {
  const { amount, timestamp } = donation
  const day = moment(timestamp).format('YYYYMMDD')
  const docRef = db.doc(`aggregates/donations/days/${day}`)
  const doc = await docRef.get()
  if (doc.exists) {
    const existing = doc.data()!
    return docRef.update({
      amount: existing.amount + amount,
      donors: existing.donors + 1
    })
  } else {
    return docRef.set({
      amount,
      donors: 1
    })
  }
}

export async function updateDonationsTotal(before: DonationSummary, after: DonationSummary) {
  let amount = after.amount
  let donors = after.donors
  if (before) {
    amount -= before.amount
    donors -= before.donors
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

export async function cases() {
  const casesByLA = await guardian.casesByLocalAuthority()
  const newData: TableUpdateData = {}
  Object.entries(casesByLA).forEach(([la, _cases]) => {
    newData[la] = {
      'Cumulative Cases': _cases
    }
  })

  return airtable.updateTable({
    tableName: 'Cases (All hospitals)',
    lookupField: 'Local Authority',
    updateFields: ['Cumulative Cases'],
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
    const { amount, donors } = data
    cumulativeAmount += amount
    cumulativeDonors += donors
    const year = id.substr(0, 4)
    const month = id.substr(4, 2)
    const day = id.substr(6, 2)

    newData[`${year}-${month}-${day}`] = {
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
