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

// we ask Airtable for hospitals fields as strings
export type Hospital = {
  'Hospital Display Name': string,
  Status: string,
  'Hospital Name': string,
  Orders: string,
  'Departments fed': string,
  Area: string,
  'NHS Trust': string,
  'Number of orders': string,
  'Hospital ID': string,
  Region: string,
  'Local Authority': string,
  City: string,
  Postcode: string,
  'Priority Target': string,
  'Meal number': string,
  modified_timestamp: string,
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

export type AirtablePhoto = {
  filename: string,
  id: string,
  type: string,
  thumbnails: {
    [size: string]: {
      width: number,
      height: number,
      url: string
    }
  }
}

export type CasePoint = {
  name: string,
  pop: number,
  cases: number
}

export type Cases = {
  [laID:string]: CasePoint
}

export type TableUpdateData = { [k: string] : any }
