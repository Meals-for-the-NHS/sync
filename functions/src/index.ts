import * as functions from 'firebase-functions'
import * as sync from './sync'
import { Donation, DonationSummary } from './types'

const europeFunctions = functions.region('europe-west2') // London

exports.donations = europeFunctions.https.onRequest(async (_, res) => {
  const count = await sync.donorboxDonations()
  res.send({ updated: count })
})

exports.scheduledDonations = europeFunctions.pubsub
  .schedule('* * * * *')
  .onRun(() => {
  return sync.donorboxDonations()
})


exports.orders = europeFunctions.https.onRequest(async (_, res) => {
  await sync.orders()
  res.send('ok')
})

exports.onNewDonation = europeFunctions.firestore
  .document('donations/{id}')
  .onCreate((snapshot) => {
    return sync.updateDonationDay(<Donation> snapshot.data())
  })

exports.onDonationDayWrite = europeFunctions.firestore
  .document('aggregates/donations/days/{id}')
  .onCreate((snapshot) => {
    return sync.updateDonationsTotal(<DonationSummary> snapshot.data())
  })

