import * as admin from 'firebase-admin'
import fetch from 'node-fetch'
import { pipeline } from 'stream'
import * as util from 'util'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const bucket = admin.storage().bucket()
const streamPipeline = util.promisify(pipeline)

export async function store({ url, destination } : { url: string, destination: string }) {
  const filepath = path.join(os.tmpdir(), path.basename(destination))
  const filestream = fs.createWriteStream(filepath)

  const response = await fetch(url)
  await streamPipeline(response.body, filestream)

  await new Promise((resolve) => {
    bucket.upload(filepath, {
      destination,
      public: true
    },(err, _, response) => {
      if (err) {
        console.error(response)
      }
      resolve()
    })
  })

  fs.unlinkSync(filepath)
}
