## sync

A collection of Firebase Cloud Functions to sync information between Donorbox, Airtable and the Meals for the NHS Firestore database.

### Donations

The `scheduledDonations` function runs every minute and queries the Donorbox API for donations. New donations are added to the database. This triggers the `onNewDonation` function which creates or modifies the document for daily totals. This in turn triggers `onDonationDayWrite` which then updates the grand total document.

At minutes 5 and 36 past the hour the donations by day are updated in the Donations table in airtable (`scheduledDonationsAirtable`).

### Sponsors

Every hour the `scheduledSponsors` function is run, which syncs the Sponsor a Hospital table in Airtable with the DB. 

### Airtable tables

The Orders and Hospital tables are synced with the database every 10 and 30 minutes, respectively.


### Cases

Covid-19 cases are pulled from the Guardian and are inserted into the Cases (All Hospitals) table in Airtable 4 times a day.
