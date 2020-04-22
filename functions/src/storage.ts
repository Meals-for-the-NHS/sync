import * as admin from 'firebase-admin'
import fetch from 'node-fetch'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const bucket = admin.storage().bucket()

export async function store({ url, destination } : { url: string, destination: string }) {
  const filepath = path.join(os.tmpdir(), path.basename(destination))
  const filestream = fs.createWriteStream(filepath)

  const response = await fetch(url)
  await new Promise((resolve) => {
    response.body.pipe(filestream)
    response.body.on('end', resolve)
  })

  await new Promise((resolve) => {
    bucket.upload(filepath, {
      destination,
      public: true
    },(err, _, res) => {
      if (err) {
        console.error(res)
      }
      resolve()
    })
  })

  fs.unlinkSync(filepath)
}
