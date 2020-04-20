import {TableUpdateData} from "./types";
import * as guardian from "./guardian";
import * as wales from "./wales";
import * as scotland from "./scotland";

export async function cases() {
  const newData: TableUpdateData = {}
  const casesByLA = await guardian.casesByLocalAuthority()
  Object.entries(casesByLA).forEach(([la, _cases]) => {
    newData[la] = {
      'Cumulative Cases': _cases
    }
  })

  const casesByLAWales = await wales.casesWales()
  Object.entries(casesByLAWales).forEach(([la, _cases]) => {
    newData[la] = {
      'Cumulative Cases': _cases
    }
  })

  const casesByLAScotland = await scotland.casesScotland()
  Object.entries(casesByLAScotland).forEach(([la, _cases]) => {
    newData[la] = {
      'Cumulative Cases': _cases
    }
  })
  //
  // return airtable.updateTable({
  //   tableName: 'Cases (All hospitals)',
  //   lookupField: 'Local Authority',
  //   updateFields: ['Cumulative Cases'],
  //   newData
  // })


}