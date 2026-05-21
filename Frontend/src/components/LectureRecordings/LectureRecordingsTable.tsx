import { useState, useEffect } from "react";
import { DataTable } from "../AdmissionPortal/DataTable";
import { Column } from "../../types/columns";
import { DEFAULT_LECTURE_RECORDING_COLUMNS } from "../../utils/tableUtils";
import {
  getLectureRecordings,
  deleteLectureRecording,
} from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import SettingsHeader from "../Settings/SettingsHeader";
import { Button } from "../../components/ui/button";
import { storeFormData } from "../../utils/formStorage";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import Loader from "../Loader";

const LectureRecordingsTable = ({ openForm }: { openForm: (formName: string) => void; }) => {
  const [columns, setColumns] = useState<Column[]>(
    DEFAULT_LECTURE_RECORDING_COLUMNS
  );
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { selectedBatchId, user_id, center_id, course_id, userType } = useBatch();

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await getLectureRecordings({
        tb_id: selectedBatchId,
        center_id: center_id,
        course_id: course_id,
        t_id: user_id,
        userType: userType
      });
      
      if (response.success && Array.isArray(response.data)) {
        // Format the data for the DataTable
        const formattedData = response.data.map((record: any) => ({
          ...record,
          trainer_name: record.trainers?.user_id || 'N/A',
          batch_name: record.training_batches?.tb_name || 'N/A', 
          center_name: record.centers?.center_name || 'N/A',
          course_name: record.courses?.course_name || 'N/A',
          proof: record.lr_attachment || 'N/A',
        }));
        
        setData(formattedData);
      } else {
        console.error("Invalid response format:", response);
        setData([]);
      }
    } catch (error) {
      console.error("Error fetching lecture recordings:", error);
      toast.error("Failed to fetch lecture recordings");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this recording?")) {
      try {
        await deleteLectureRecording(id);
        toast.success("Recording deleted successfully");
        fetchData();
      } catch (error) {
        toast.error("Failed to delete recording");
      }
    }
  };

  const handleEdit = (recording: any) => {
    storeFormData('lectureRecordingEdit', recording);
    openForm("LectureRecordingForm");
  };
  
  const handleView = (recording: any) => {
    storeFormData('lectureRecordingView', recording);
    openForm("LectureRecordingView");
  };

  useEffect(() => {
    if (selectedBatchId) {
      fetchData();
    }
  }, [selectedBatchId]);

  return (
    <div className="container max-w-8xl p-6">
      
        <SettingsHeader
          SettingsHeader="Recorded Lectures"
          SettingDescription="Access recorded lecture sessions"
        />
        

      {userType === "trainer"&&(
      <div className="flex justify-between items-center mb-6">
        <Button onClick={() => openForm("LectureRecordingForm")}>Add New Recording</Button>
      </div>
      )}
      
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader />
          <p className="text-muted-foreground">Loading lecture recordings...</p>
        </div>
      )}
      { userType === "trainer" ? (
        <DataTable
          data={data}
          columns={columns}
          setColumns={setColumns}
          isLoading={isLoading}
          isActionBtn={true}
          isProofBtn={true}
          isLink={true}
          linkColumn="lr_link"
          onView={(item) => handleView(item)}
          onEdit={(item) => handleEdit(item)}
          onDelete={(item) => handleDelete(item.lr_id)}
        />
      ) : (
        <DataTable
          data={data}
          columns={columns}
          setColumns={setColumns}
          isLoading={isLoading}
          isActionBtn={true}
          isProofBtn={true}
          isLink={true}
          linkColumn="lr_link"
          onView={(item) => handleView(item)}
        />
      )}
    </div>
  );
};

export default LectureRecordingsTable;
