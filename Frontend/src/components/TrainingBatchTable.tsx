import React, { useState, useEffect } from "react";
import { DynamicTable } from "./DataTable/DynamicTable";
import { TableActions } from "./DataTable/TableActions";
import { getTrainingBatches } from "../services/api";




import { DataTable } from "./AdmissionPortal/DataTable";
import { TrainingBatchTableData } from "../types/trainingBatchFormData";
import { Column, FilterBy, StudentStatus } from "../types/columns";
import { DEFAULT_FILTER_BY_TRAINING_BATCH_STATUS, DEFAULT_TRAINING_BATCH_COLUMNS } from "../utils/tableUtils";
import SettingsHeader from "./Settings/SettingsHeader";

const TrainingBatchTable: React.FC = () => {
  const [trainingBatches, setTrainingBatches] = useState<
    TrainingBatchTableData[]
  >([]);
  const [columns, setColumns] = useState<Column[]>(
    DEFAULT_TRAINING_BATCH_COLUMNS
  );
  const [filterStatus, setFilterStatus] = useState<StudentStatus>("all");
  const [filterBy, setFilterBy] = useState<FilterBy[]>(
    DEFAULT_FILTER_BY_TRAINING_BATCH_STATUS
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchTrainingBatchesWithDates = async () => {
    setLoading(true);
    try {
      const TrainingBatchesData = await getTrainingBatches();
      if (Array.isArray(TrainingBatchesData.data)) {
        const updatedTrainingBatches = TrainingBatchesData.data.map(
          (trainingBatche: TrainingBatchTableData) => ({
            ...trainingBatche,
            tbStatus: trainingBatche.tb_status === "1" ? "Active" : "Inactive",
          })
        );
        setTrainingBatches(updatedTrainingBatches);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch TrainingBatches"
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchTrainingBatchesWithDates();
  }, []);

  return (
    <div className="w-full">
      <SettingsHeader
        SettingsHeader="Enrolled TrainingBatches"
        SettingDescription="Enrolled TrainingBatches Data"
      />
      <DataTable
        data={trainingBatches}
        columns={columns}
        filterStatus={filterStatus}
        filterBy={filterBy}
        setFilterStatus={setFilterBy}
        setColumns={setColumns}
        isActionBtn={false}
        onView={(item) => {}}
        onEdit={() => {}}
        onDelete={() => {}}
      />
    </div>
  );
};

export default TrainingBatchTable;
