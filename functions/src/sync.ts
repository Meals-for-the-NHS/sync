//import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import 'firebase-functions'
import * as moment from 'moment'
import * as donorbox from './donorbox'
import * as airtable from './airtable'
import { Donation, DonationSummary } from './types'

admin.initializeApp()
const db = admin.firestore()

// exports.date = functions.https.onRequest(async (req, res) => {
//   const donorboxDonations = await donorbox.donations()
//   const privateDonations = await airtable.donations()
//   db.collection('money').doc('donations').set({
//     donorbox: donorboxDonations,
//     other: privateDonations
//   })
//   console.log(donorboxDonations, privateDonations)
//   res.send({})
// })

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
  const results = await airtable.orders()
  console.log(JSON.stringify(results))
  // Object.entries(orders).forEach(([id, fields) => {
  
  // }

  // console.log(Object.keys(orders))
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
