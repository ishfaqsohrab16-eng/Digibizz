import { EarningsData } from "../../types/earningFormData";

import {
  DEFAULT_EARNINGS_SUBMISSIONS_COLUMNS,
  DEFAULT_FILTER_BY_EARNINGS_STATUS,
} from "../../utils/tableUtils";
import { Column, FilterBy } from "../../types/columns";
import { useState } from "react";
import { DataTable } from "../AdmissionPortal/DataTable";

export const SuccessStories = ({ data }: { data: any }) => {
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
      data={data}
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
