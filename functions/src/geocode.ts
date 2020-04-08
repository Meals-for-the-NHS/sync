import * as functions from 'firebase-functions'
import { Client } from '@googlemaps/google-maps-services-js'

const client = new Client({})
const { key } = functions.config().maps

export async function geocode(address: string) {
  const response = await client.geocode({
    params: {
      address,
      bounds: { // the UK
        northeast: {
          lat: 58.986315, lng: 0.101558
        },
        southwest: {
          lat: 49.381222, lng: -6.935152
        }
      },
      key
    }
  })
  // throttle requests
  await new Promise((resolve) => { setTimeout(() => resolve(), 40) })

  const { status } = response.data
  if (status === 'OK') {
    return response.data.results[0].geometry.location
  }
  
  throw new Error("can't geocode")
}
