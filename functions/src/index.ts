import * as functions from 'firebase-functions'
import * as sync from './sync'
import { Donation, DonationSummary, Order } from './types'

const europeFunctions = functions.region('europe-west2') // London

////////////////////////////////////
/// donations

exports.donations = europeFunctions.https.onRequest(async (_, res) => {
  const count = await sync.donorboxDonations()
  res.send({ updated: count })
})

exports.scheduledDonations = europeFunctions.pubsub
  .schedule('* * * * *')
  .onRun(() => {
  return sync.donorboxDonations()
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

////////////////////////////////////
/// orders

exports.scheduledOrders = europeFunctions.pubsub
  .schedule('every 10 minutes')
  .timeZone('Europe/London')
  .onRun((context) => {
    const hour = (new Date(context.timestamp)).getHours()
    if (hour > 5 && hour < 10) {
      return sync.orders()
    }
    return true
  })

exports.updateOrders = europeFunctions.https.onRequest(async (_, res) => {
  const count = await sync.orders()
  res.send({ updated: count })
})

exports.onOrderWrite = europeFunctions.firestore
  .document('orders/{id}')
  .onCreate((snapshot) => {
    return sync.updateOrderModifiedTimestamps(<Order> snapshot.data())
  })

