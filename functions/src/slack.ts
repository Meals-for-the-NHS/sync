import * as functions from 'firebase-functions'
import fetch from 'node-fetch'

const { hook } = functions.config().slack

export function postToGeneral(text: string) {
  return fetch(hook, {
	method: 'post',
	body: JSON.stringify({ text }),
	headers: { 'Content-Type': 'application/json' }
  })
}
