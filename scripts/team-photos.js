const fs = require('fs')
const path = require('path')
const admin = require('firebase-admin')
const download = require('download-file')
const serviceAccount = require('./meals4nhs-ac29a2938e2e.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'meals4nhs.appspot.com'
})

const db = admin.firestore()
const bucket = admin.storage().bucket()

async function main() {
  const teamDoc = await db.collection('aggregates').doc('team').get()
  const teamList = Object.entries(teamDoc.data())

  for (const [id, person] of teamList) {
    if (!person.photo) {
        try {
          const { url } = person.Picture[0].thumbnails.large
          const { type } = person.Picture[0]
          const basename = path.basename(url)
          const extension = basename.match(/\./) ? '' : `.${type.split('/')[1]}`
          const filename = `${basename}${extension}`
          const directory = 'team-photos'
          const filepath = `${directory}/${filename}`
          try {
            if (!fs.existsSync(filepath)) {
              await new Promise((resolve, reject) => {
                download(url, {
                  filename,
                  directory
                }, (error) => {
                  if (error) {
                    reject()
                  } else {
                    resolve()
                  }
                })
              })
              console.log('downloaded', filename)
            }
            console.log('uploading', filepath)
            await new Promise((resolve) => {
              bucket.upload(`${filepath}`, {
                destination: `${filepath}`,
                public: true
              },(err, file, response) => {
                if (err) {
                  console.log(response)
                }
                resolve()
              })
            })
            await db.collection('team').doc(id).update({
              photo: `https://storage.googleapis.com/meals4nhs.appspot.com/${filepath}`
            })
            console.log('set doc for', id)

          }
          catch (e) {
            console.error(`can't download ${url}`, e)
          }
        } catch (e) {
          console.log('fail on', person.Name)
        }
    }
  }
}

main()
