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

export type Order = {
  record_id: string,
  modified_timestamp: Date
}
