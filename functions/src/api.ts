import * as express from 'express'
import * as cors from 'cors'
import * as moment from 'moment'
import * as sync from './sync'

export const api = express()
api.use(cors())

function exposeCollection(name: string) {
  api.get(`/${name}`, async (_, res) => {
    const data = await sync.getAirtable(name)
    res.send(data)
  })
}

exposeCollection('hospitals')
exposeCollection('providers')
exposeCollection('team')

api.get('/commented-donations', async (req, res) => {
  const num = Math.min(100, parseInt(<string>req.query.num) || 50)

  let queryRef = sync.db.collection('donations')
    .where('commented', '==', true)
    .orderBy('timestamp')

  const { start } = req.query
  if (start) {
    const nextDocRef = await sync.db.collection('donations').doc(<string>start).get()
    queryRef = queryRef.startAt(nextDocRef)
  }

  const query = await queryRef.limit(num).get()

  const output: { donations: any[], next: string | null } = {
    donations: [],
    next: null
  }

  query.forEach((doc) => {
    const { comment, donor, timestamp, amount } = doc.data()!
    output.donations.push({
      first_name: donor.first_name,
      comment,
      amount,
      date: moment(timestamp).format('DD/MM/YYYY')
    })
    output.next = doc.id
  })

  res.send(output)
})
