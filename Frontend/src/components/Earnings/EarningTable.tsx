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

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchEarnings = async () => {
      setLoading(true);
      try {
        const response = await getEarnings(selectedBatchId, user_id);
        if (cancelled) return;
        setData(Array.isArray(response?.data) ? response.data : []);
      } catch (error: any) {
        if (cancelled) return;
        // Previously unguarded: a failed request threw an unhandled rejection
        // and the table just sat empty with no explanation.
        setData([]);
        toast({
          title: "Could not load your earnings",
          description:
            error?.response?.data?.message ||
            (error instanceof Error ? error.message : "Please try again."),
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchEarnings();
    return () => {
      cancelled = true;
    };
  }, [selectedBatchId, user_id]);

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
        // Refresh only on success. Guarded like the initial load - this used to
        // be a bare await that could throw after the success toast had already
        // been shown, leaving a stale row on screen.
        try {
          const updatedData = await getEarnings(selectedBatchId, user_id);
          setData(Array.isArray(updatedData?.data) ? updatedData.data : []);
        } catch {
          toast({
            variant: "destructive",
            title: "Deleted, but the list could not be refreshed",
            description: "Reload the page to see the current list.",
          });
        }
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
        isLoading={loading}
        onView={handleView}
        onDelete={handleDelete}
      />
    </div>
  );
}
