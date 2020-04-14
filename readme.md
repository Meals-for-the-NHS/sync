## sync

A collection of Firebase Cloud Functions to sync information between Donorbox, Airtable and the Meals for the NHS Firestore database.

## Getting started

Install `firebase-tools`, e.g. `npm i -g install firebase-tools`.

Login with your @mealsforthenhs.com account using:

`$ firebase login`

All the cloud functions live in `functions/`, to get started:

```bash
$ cd functions
$ npm install
$ npm run serve
```

This will allow you to test HTTP functions locally. Read the [doc](https://firebase.google.com/docs/functions) for more info!

### Donations

The `scheduledDonations` function runs every minute and queries the Donorbox API for donations. New donations are added to the database. This triggers the `onNewDonation` function which creates or modifies the document for daily totals. This in turn triggers `onDonationDayWrite` which then updates the grand total document.

At minutes 5 and 36 past the hour the donations by day are updated in the Donations table in airtable (`scheduledDonationsAirtable`).

### Sponsors

Every hour the `scheduledSponsors` function is run, which syncs the Sponsor a Hospital table in Airtable with the DB.

### Airtable tables

The Orders, Hospitals, Providres and Team tables are synced with the database periodically.


### Cases

Covid-19 cases are pulled from the Guardian and are inserted into the Cases (All Hospitals) table in Airtable 4 times a day.
