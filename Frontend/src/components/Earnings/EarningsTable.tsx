import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import SettingsHeader from "../../components/Settings/SettingsHeader";
import { useBatch } from "../../context/BatchContext";
import { getEarnings, deleteEarning } from "../../services/api";
import { DataTable } from "../AdmissionPortal/DataTable";
import { DEFAULT_EARNINGS_COLUMNS } from "../../utils/tableUtils";
import { Column } from "../../types/columns";
import { toast } from "../../components/ui/use-toast";

export default function EarningsTable({
  openForm,
}: {
  openForm: (formName: string) => void;
}) {
  const { selectedBatchId, center_id, course_id, user_id, userType } =
    useBatch();
  const [data, setData] = useState<any[]>([]);
  const [viewData, setViewData] = useState<any[]>([]);
  const [columns, setColumns] = useState<Column[]>(DEFAULT_EARNINGS_COLUMNS);
  const [selectedEarning, setSelectedEarning] = useState<any>(null);
  const [mode, setMode] = useState<"create" | "edit" | "view">("create");

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
      if (response.success) {
        toast({
          title: "Success",
          description: "Earning record deleted successfully",
        });
        const updatedEarnings = await getEarnings(selectedBatchId, user_id);
        setData(updatedEarnings.data);
      }
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete earning record",
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <SettingsHeader
        SettingsHeader="Earnings"
        SettingDescription="List of Earnings"
      />
      {userType === "student" && (
        <Button
          onClick={() => {
            setMode("create");
            setSelectedEarning(null);
            openForm("EarningsForm");
          }}
        >
          Add Earnings
        </Button>
      )}
      <DataTable
        data={data}
        columns={columns}
        setColumns={setColumns}
        isActionBtn={true}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
