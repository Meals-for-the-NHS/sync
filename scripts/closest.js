const fs = require('fs')
const admin = require('firebase-admin')
const serviceAccount = require('./meals4nhs-ac29a2938e2e.json')
const MapsClient = require("@googlemaps/google-maps-services-js").Client
const Distance = require('geo-distance')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})

const coords = (place) => {
  const { lat, lng } = place.coordinates
  return { lat, lon: lng }
}

async function main() {
  const db = admin.firestore()
  const mapsClient = new MapsClient({})
  const keys = JSON.parse(fs.readFileSync('./keys.json', 'utf8'))

  const hospitalsQuery = await db.collection('hospitals')
//        .limit(3)
        .get()

  const hospitals = []
  hospitalsQuery.forEach((doc) => {
    hospitals.push(doc.data())
  })

  const providersDoc = await db.collection('aggregates').doc('providers').get()
  const allProviders = providersDoc.data()

  const providerDistances = {}
  let totalFound = 0

  for (const hospital of hospitals) {
    if (!hospital.coordinates) {
      continue
    }

    const cacheDoc = `hospital_provider_distances/${hospital.record_id}`

    const distances = []

    for (const provider of Object.values(allProviders)) {
      if (provider.coordinates) {
        const distance = Distance.between(coords(hospital), coords(provider))
        if (distance < Distance('25 km')) {
          distances.push({
            distance: distance.radians,
            provider
          })
        }
      }
    }

    const toProcess = distances
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 32)


    console.log(`processing ${toProcess.length} for ${hospital['Hospital Name']}`)

    let currentClosest = []
    const distanceCacheDoc = await db.doc(cacheDoc).get()
    if (distanceCacheDoc.exists) {
      currentClosest = distanceCacheDoc.data().providers

      // backwards compatibilty
      currentClosest.forEach((p) => p.Status = allProviders[p.record_id].Status || null)
    }

    const alreadyCalced = new Set(currentClosest.map(p => p.record_id))
    const newProviders = []

    for (const { provider } of toProcess) {
      if (alreadyCalced.has(provider.record_id)) {
        // console.log('already calced', provider['Restaurant Name'])
        continue
      }

      const response = await mapsClient.directions({
        params: {
          origin: hospital.coordinates,
          destination: provider.coordinates,
          mode: 'driving',
          key: keys.maps
        }
      })
      await new Promise((resolve) => { setTimeout(() => resolve(), 100) })
      try {
        const minutes = response.data.routes[0].legs[0].duration.value / 60
        console.log(provider.record_id, minutes)
        newProviders.push({
          name: provider['Restaurant Name'],
          drive_time: minutes,
          record_id: provider.record_id,
          status: provider.Status || null
        })
      } catch (e) {
        console.error(keys.maps)
        console.error(response.data)
      }
    }

    if (newProviders.length > 0) {
      const closestProviders = newProviders
            .concat(currentClosest)
            .sort((a, b) => a.distance - b.distance)

      const within30mins = closestProviders.filter(p => p.drive_time < 30)
      console.log(`${closestProviders.length} for ${hospital['Hospital Name']}, ${within30mins.length} in range (${hospital.record_id})`)

      await db.collection('hospitals').doc(hospital.record_id).update({
        close_providers: within30mins
      })

      await db.doc(cacheDoc).set({
        providers: closestProviders,
        record_id: hospital.record_id,
        name: hospital['Hospital Name'],
        display_name: hospital['Hospital Display Name']
      })
    }

    newProviders.concat(currentClosest).forEach((p) => {
      if (providerDistances[p.record_id]) {
        providerDistances[p.record_id][hospital['Hospital Display Name']] = p.drive_time
      } else {
        providerDistances[p.record_id] = {
          'Provider Name': `${p.name} ${p.location}`,
          Provider: p.record_id,
          [hospital['Hospital Display Name']]: p.drive_time
        }
      }
      totalFound++
    })

  }

  fs.writeFileSync('provider_distances.json', JSON.stringify({
    columns: ['Provider Name', 'Provider'].concat(hospitals.map(h => h['Hospital Display Name'])),
    rows: Object.values(providerDistances)
  }))
  console.log('found', totalFound)
}

main()
