import * as admin from 'firebase-admin'
import 'firebase-functions'
import * as moment from 'moment'
import * as donorbox from './donorbox'
import * as airtable from './airtable'
import * as guardian from './guardian'
import { Donation, DonationSummary, Order } from './types'

admin.initializeApp()
const db = admin.firestore()

export async function donorboxDonations() {
  const donations = await donorbox.donations()
  const collectionRef = db.collection('donations')
  let count = 0
  for (; count < donations.length; count++) {
    const donation = donations[count]
    const { id, amount, currency, donation_date, donor, comment, processing_fee } = donation
    const docRef = collectionRef.doc(id.toString())
    const doc = await docRef.get()
    if (doc.exists) {
      break
    } else {
      await docRef.set({
        source: 'donorbox',
        donor: donor.name,
        amount: parseFloat(amount),
        currency,
        timestamp: new Date(donation_date),
        comment,
        donor_box_fee: processing_fee || 0
      })
    }
  }
  console.log(`updated ${count}`)
  return count
}

export async function orders() {
  const allOrders = await airtable.orders()
  const ordersList = Object.entries(allOrders)
  const modifiedDoc = await db.collection('airtable_util').doc('orders_modified').get()
  const modified = modifiedDoc.data()
  let updated = 0
  for (const order of ordersList) {
    const [rec_id, fields] = order
    if (!modified || modified[rec_id] === undefined || modified[rec_id] < fields.modified_timestamp) {
      const doc = Object.assign({}, fields, { record_id: rec_id })
      await db.collection('orders').doc(rec_id).set(doc)
      updated++
    }
  }
  console.log(`updated ${updated}`)
  return updated
}

export async function updateOrderModifiedTimestamps(order: Order) {
  const { record_id, modified_timestamp } = order
  return db.collection('airtable_util').doc('orders_modified').set({
    [record_id]: modified_timestamp
  }, { merge: true })
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

export async function updateDonationsTotal(summary: DonationSummary) {
  const { amount, donors } = summary
  const docRef = db.doc(`aggregates/donations`)
  const doc = await docRef.get()
  const current = doc.data()!
  return docRef.update({
    amount: current.amount + amount,
    donors: current.donors + donors
  })
}

export async function cases() {
  const casesByLA = await guardian.casesByLocalAuthority()
  return airtable.updateCases(casesByLA)
}
