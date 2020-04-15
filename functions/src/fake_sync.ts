import * as guardian from './guardian'
import * as scotland from './scotland'
import { Table, Donation, DonationSummary, AirtableRecord, TableUpdateData } from './types'



export async function cases() {
  const newData: TableUpdateData = {}
  const scotsCases = await scotland.casesScotland()
  Object.entries(scotsCases).forEach(([la, _cases]) => {
    newData[la] = {
      'Cumulative Cases': _cases
    }
  })
  const casesByLA = await guardian.casesByLocalAuthority()
  Object.entries(casesByLA).forEach(([la, _cases]) => {
    newData[la] = {
      'Cumulative Cases': _cases
    }
  })
  console.log(newData)


//   return airtable.updateTable({
//     tableName: 'Cases (All hospitals)',
//     lookupField: 'Local Authority',
//     updateFields: ['Cumulative Cases'],
//     newData
//   })
}

