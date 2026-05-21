import React, { useState, useEffect } from "react";
import { DynamicTable } from "./DataTable/DynamicTable";
import { TableActions } from "./DataTable/TableActions";
import { getCentersWithDates, getTrainingBatchById } from "../services/api";

import { DataTable } from "./AdmissionPortal/DataTable";
import { DEFAULT_CENTER_COLUMNS } from "../utils/tableUtils";
import { Column, StudentStatus } from "../types/columns";
import { useBatch } from "../context/BatchContext";
import SettingsHeader from "./Settings/SettingsHeader";


interface CenterWithDates {
  id: number;
  center_id: number;
  center_name: string;
  center_location: string;
  center_type: string;
  center_medium: string;
  center_status: string;
  tb_name: string; // Add this field
  tb_start: Date;
  tb_end: Date;
}

const EnrolledCenterTable: React.FC = () => {
  const [centers, setCenters] = useState<CenterWithDates[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<Column[]>(DEFAULT_CENTER_COLUMNS);
  const [filterStatus, setFilterStatus] = useState<StudentStatus>("all");
  const { selectedBatchId } = useBatch();
  const fetchCentersWithDates = async () => {
    setLoading(true);
    try {
      const centersData = await getCentersWithDates(selectedBatchId);

      // Fetch training batch details for each center
      const enrichedData = await Promise.all(
        centersData.formattedCenters.map(async (center: any) => {
          if (center.tb_id) {
            try {
              const batchData = await getTrainingBatchById(
                center.tb_id.toString()
              );
              return {
                ...center,
                tb_name: batchData.tb_name,
                tb_start: batchData.tb_start,
                tb_end: batchData.tb_end,
              };
            } catch (err) {
              console.error(
                `Error fetching batch data for ID ${center.tb_id}:`,
                err
              );
              return center;
            }
          }
          return center;
        })
      );

      setCenters(enrichedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch centers");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchCentersWithDates();
  }, [selectedBatchId]);

  return (
    <div className="w-full">
      <SettingsHeader
        SettingsHeader="Enrolled Centers"
        SettingDescription="Enrolled Centers Data"
      />
      <DataTable
        data={centers}
        columns={columns}
        filterStatus={filterStatus}
        setColumns={setColumns}
        isActionBtn={false}
        onView={(item) => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    </div>
  );
};

export default EnrolledCenterTable;
