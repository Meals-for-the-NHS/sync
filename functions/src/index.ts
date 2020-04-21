import * as functions from 'firebase-functions'
import * as sync from './sync'
import { api } from './api'
import { DonationDay, DonationsTotal, AirtableRecord } from './types'

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

exports.onDonationDayWrite = europeFunctions.firestore
  .document('aggregates/donations/days/{id}')
  .onWrite((change) => {
    return sync.updateDonationsTotal(<DonationDay> change.before.data(),
                                     <DonationDay> change.after.data())
  })

exports.onDonationTotalWrite = europeFunctions.firestore
  .document('aggregates/donations')
  .onWrite(async (change) => {
    return sync.addDonationsToSummary(<DonationsTotal> change.after.data())
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
const wantsCoordinates = ['providers', 'hospitals']

function addAirtableExports({ name, schedule }: { name: string, schedule?: string }) {
  const titledName = name.charAt(0).toUpperCase() + name.slice(1)

  if (schedule) {
    exports[`scheduled${titledName}`] = europeFunctions.pubsub
      .schedule(schedule)
      .timeZone('Europe/London')
      .onRun(async (context) => {
        const hour = (new Date(context.timestamp)).getHours()
        if (hour > 5 && hour < 10) {
          await sync.syncAirTable(name)
          await new Promise((resolve) => { setTimeout(resolve, 5000) })
          return sync.createMaster(name)
        }
        return true
      })
  }

  exports[`on${titledName}Write`] = europeFunctions.firestore
    .document(`${name}/{id}`)
    .onWrite(async (change) => {
      const record = <AirtableRecord> change.after.data()
      if (wantsCoordinates.some(e => e === name)) {
        await sync.insertCoordinates(change.after)
      }
      return sync.updateModifiedTimestamps(name, record)
    })

  exports[`update${titledName}`] = europeFunctions.runWith({
    timeoutSeconds: 300
  }).https.onRequest(async (req, res) => {
    const { force } = req.query
    const count = await sync.syncAirTable(name, !!force)
    await new Promise((resolve) => { setTimeout(resolve, 5000) })
    await sync.createMaster(name)
    res.send({ updated: count })
  })

  exports[name] = europeFunctions.https.onRequest(async (_, res) => {
    const data = await sync.getAirtable(name)
    res.send(data)
  })
}

addAirtableExports({ name: 'hospitals', schedule: 'every 15 minutes' })
addAirtableExports({ name: 'orders', schedule: 'every 15 minutes' })
addAirtableExports({ name: 'providers',  schedule: 'every 15 minutes' })
addAirtableExports({ name: 'team',  schedule: 'every 8 hours' })
addAirtableExports({ name: 'photoOrders',  schedule: 'every 8 hours' })

////////////////////////////////////
/// cases

exports.updateCases = europeFunctions.https.onRequest(async (_, res) => {
  await sync.updateCasesAirtable()
  res.send('ok')
})


exports.scheduledCases = europeFunctions.pubsub
  .schedule('0 4,10,16,22 * * *')
  .timeZone('Europe/London')
  .onRun(() => {
    return sync.updateCasesAirtable()
  })


exports.updateHospitalsWithCloseProviders = europeFunctions
  .runWith({
    timeoutSeconds: 300
  }).https.onRequest(async (_, res) => {
  await sync.updateHospitalsWithCloseProviders()
  res.send('ok')
})

exports.api = europeFunctions.https.onRequest(api)
