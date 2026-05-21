import { EarningsData } from "../../types/earningFormData";

import {
  DEFAULT_EARNINGS_SUBMISSIONS_COLUMNS,
  DEFAULT_FILTER_BY_EARNINGS_STATUS,
} from "../../utils/tableUtils";
import { Column, FilterBy } from "../../types/columns";
import { useState } from "react";
import { DataTable } from "../AdmissionPortal/DataTable";

export const MasterEarningApprove = ({ data }: { data: any }) => {
  // Combine entries for the same student and sum their amounts
  // Helper to sum amount values, handling string with multiple numbers (e.g., '10.0020.00')
  function sumAmounts(...amounts: any[]): number {
    let total = 0;
    for (const amt of amounts) {
      if (typeof amt === 'number') {
        total += amt;
      } else if (typeof amt === 'string') {
        // Split by regex: one or more digits, dot, two digits (e.g., 10.00)
        const matches = amt.match(/\d+\.\d{2}/g);
        if (matches) {
          total += matches.map(Number).reduce((a, b) => a + b, 0);
        } else {
          const n = parseFloat(amt);
          if (!isNaN(n)) total += n;
        }
      }
    }
    return total;
  }

  const combinedData = Array.isArray(data)
    ? Object.values(
        data.reduce((acc: any, curr: any) => {
          const key = curr.studentId || curr.cnic || curr.id;
          if (!key) return acc;
          if (!acc[key]) {
            acc[key] = { ...curr };
            // Normalize amount to number
            acc[key].amount = sumAmounts(curr.amount);
          } else {
            acc[key].amount = sumAmounts(acc[key].amount, curr.amount);
          }
          return acc;
        }, {})
      )
        .sort((a: any, b: any) => (b.amount ?? 0) - (a.amount ?? 0))
    : [];

  const [columns, setColumns] = useState<Column[]>(
    DEFAULT_EARNINGS_SUBMISSIONS_COLUMNS
  );
  const [filterStatus, setFilterStatus] = useState<FilterBy[]>(
    DEFAULT_FILTER_BY_EARNINGS_STATUS
  );
  const [filterBy, setFilterBy] = useState<FilterBy[]>(
    DEFAULT_FILTER_BY_EARNINGS_STATUS
  );

  return (
    <DataTable
      data={combinedData}
      columns={columns}
      setColumns={setColumns}
      filterStatus={filterStatus}
      setFilterStatus={setFilterStatus}
      filterBy={filterBy}
      isActionBtn={false}
      onView={() => {}}
      onEdit={() => {}}
      onDelete={() => {}}
      photo="studentImage"
    />
  );
};
