import * as functions from 'firebase-functions'
import fetch, { Headers } from 'node-fetch'

const btoa = (s: String) => Buffer.from(s.toString(), 'binary').toString('base64')

async function fetchEndpoint(endpoint: String) {
  const { email, key } = functions.config().donorbox
  const headers = new Headers()
  headers.append('Authorization', 'Basic ' + btoa(`${email}:${key}`))
  const url = `https://donorbox.org/api/v1/${endpoint}`
  const response = await fetch(url, { headers })
  return response.json()
}

export async function donations() {
  const response = await fetchEndpoint('donations')
  return response
}
