import * as functions from 'firebase-functions'
import * as sync from './sync'
import * as slack from './slack'
import { api } from './api'
import { Donation, DonationSummary, DonationsTotal, AirtableRecord } from './types'
import { thousands } from './util'

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

exports.onDonationTotalWrite = europeFunctions.firestore
  .document('aggregates/donations')
  .onWrite(async (change) => {
    const before = <DonationsTotal> change.before.data()
    const after = <DonationsTotal> change.after.data()
    const afterTotal = after.donorbox.amount + after.sponsors.amount
    const beforeTotal = before.donorbox.amount + before.sponsors.amount
    const target = 1000000
    if (afterTotal >= target && beforeTotal < target) {
      await slack.postToGeneral(Array(12).fill(':tada:').join(' '))
      return slack.postToGeneral(`It's official, £${thousands(afterTotal)} has been raised`)
    }
    return false
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
          await new Promise((resolve) => { setTimeout(resolve, 20000) })
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

  exports[`update${titledName}`] = europeFunctions.https.onRequest(async (req, res) => {
    const { force } = req.query
    const count = await sync.syncAirTable(name, !!force)
    await new Promise((resolve) => { setTimeout(resolve, 10000) })
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

////////////////////////////////////
/// cases

exports.updateCases = europeFunctions.https.onRequest(async (_, res) => {
  await sync.cases()
  res.send('ok')
})


exports.scheduledCases = europeFunctions.pubsub
  .schedule('0 4,10,16,22 * * *')
  .timeZone('Europe/London')
  .onRun(() => {
    return sync.cases()
  })


exports.updateHospitalsWithCloseProviders = europeFunctions
  .runWith({
    timeoutSeconds: 300
  }).https.onRequest(async (_, res) => {
  await sync.updateHospitalsWithCloseProviders()
  res.send('ok')
})

exports.api = europeFunctions.https.onRequest(api)
