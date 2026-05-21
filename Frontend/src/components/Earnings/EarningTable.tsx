import { useEffect, useState, Dispatch, SetStateAction } from "react";
import { Button } from "../../components/ui/button";
import SettingsHeader from "../../components/Settings/SettingsHeader";
import { useBatch } from "../../context/BatchContext";
import { getEarnings, deleteEarning } from "../../services/api";
import { DataTable } from "../AdmissionPortal/DataTable";
import { DEFAULT_EARNINGS_COLUMNS } from "../../utils/tableUtils";
import { Column } from "../../types/columns";
import { toast } from "../../components/ui/use-toast";

interface EarningsTableProps {
  openForm: (formName: string) => void;
  setMode: Dispatch<SetStateAction<"create" | "edit" | "view">>;
  setSelectedEarning: Dispatch<SetStateAction<any>>;
}

export default function EarningsTable({
  openForm,
  setMode,
  setSelectedEarning,
}: EarningsTableProps) {
  const { selectedBatchId, center_id, course_id, user_id } = useBatch();

  const [data, setData] = useState<any[]>([]);
  const [viewData, setViewData] = useState<any[]>([]);
  const [columns, setColumns] = useState<Column[]>(DEFAULT_EARNINGS_COLUMNS);

  useEffect(() => {
    const fetchEarnings = async () => {
      const response = await getEarnings(selectedBatchId, user_id);
      setData(response.data);
    };
    fetchEarnings();
  }, [selectedBatchId]);

  const handleView = (item: any) => {
    setSelectedEarning(item);
    setMode("view");
    openForm("EarningsForm");
  };

  const handleEdit = (item: any) => {
    setSelectedEarning(item);
    setMode("edit");
    openForm("EarningsForm");
  };

  const handleDelete = async (item: any) => {
    try {
      const response = await deleteEarning(item.earning_id);

      // Always show toast for both success and error cases
      toast({
        variant: response.success ? "default" : "destructive",
        title: response.success ? "Success" : "Error",
        description: response.message,
      });

      if (response.success) {
        // Refresh the data only on success
        const updatedData = await getEarnings(selectedBatchId, user_id);
        setData(updatedData.data);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.message || "An unexpected error occurred while deleting",
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <SettingsHeader
        SettingsHeader="Earnings"
        SettingDescription="List of Earnings"
      />
      <Button
        onClick={() => {
          setMode("create");
          setSelectedEarning(null);
          openForm("EarningsForm");
        }}
      >
        Add Earnings
      </Button>

      <DataTable
        data={data}
        columns={columns}
        setColumns={setColumns}
        isActionBtn={true}
        onView={handleView}
        onDelete={handleDelete}
      />
    </div>
  );
}
