export type Table = {
  [key: string]: { [k: string]: any }
}

export type Donation = {
  source: string
  donor: string,
  amount: number,
  currency: string,
  timestamp: Date,
  comment: string,
  donor_box_fee: number
}

export type DonationSummary = {
  amount: number,
  donors: number
}

export type DonationsTotal = {
  donorbox: DonationSummary,
  sponsors: DonationSummary
}

export type AirtableRecord = {
  record_id: string,
  modified_timestamp: Date
}

export type Cases = { [la:string]: number }

export type TableUpdateData = { [k: string] : any }
