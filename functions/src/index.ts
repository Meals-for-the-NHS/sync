import * as functions from 'firebase-functions'
import * as sync from './sync'
import { Donation, DonationSummary, AirtableRecord } from './types'

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
  .onWrite((change) => {
    return sync.updateDonationsTotal(<DonationSummary> change.before.data(),
                                     <DonationSummary> change.after.data())
  })

exports.scheduledSponsors = europeFunctions.pubsub
  .schedule('0 * * * *')
  .timeZone('Europe/London')
  .onRun(() => {
    return sync.hospitalSponsors()
  })

exports.updateDonationsAirtable = europeFunctions.https.onRequest(async (_, res) => {
  await sync.donationsAirtable()
  res.send('ok')
})


exports.scheduledDonationsAirtable = europeFunctions.pubsub
  .schedule('5,36 * * * *')
  .timeZone('Europe/London')
  .onRun(() => {
    return sync.donationsAirtable()
  })


////////////////////////////////////
/// Airtable

function addAirtableExports({ name, schedule }: { name: string, schedule?: string }) {
  const titledName = name.charAt(0).toUpperCase() + name.slice(1)
  
  if (schedule) {
    exports[`scheduled${titledName}`] = europeFunctions.pubsub
      .schedule(schedule)
      .timeZone('Europe/London')
      .onRun((context) => {
        const hour = (new Date(context.timestamp)).getHours()
        if (hour > 5 && hour < 10) {
          return sync.syncAirTable(name)
        }
        return true
      })
  }

  exports[`on${titledName}Write`] = europeFunctions.firestore
    .document(`${name}/{id}`)
    .onWrite(async (change) => {
      const record = <AirtableRecord> change.after.data()
      await sync.insertCoordinates(change.after)
      return sync.updateModifiedTimestamps(name, record)
    })

  exports[`update${titledName}`] = europeFunctions.https.onRequest(async (_, res) => {
    const count = await sync.syncAirTable(name)
    res.send({ updated: count })
  })

  exports[name] = europeFunctions.https.onRequest(async (_, res) => {
    const data = await sync.getAirtable(name)
    res.send(data)
  })
  
}

addAirtableExports({ name: 'hospitals', schedule: 'every 30 minutes' })
//addAirtableExports({ name: 'orders', schedule: 'every 15 minutes' })
addAirtableExports({ name: 'providers',  schedule: 'every 2 hours' })

////////////////////////////////////
/// cases

exports.cases = europeFunctions.https.onRequest(async (_, res) => {
  await sync.cases()
  res.send('ok')
})


exports.scheduledCases = europeFunctions.pubsub
  .schedule('0 4,10,16,22 * * *')
  .timeZone('Europe/London')
  .onRun(() => {
    return sync.cases()
  })

