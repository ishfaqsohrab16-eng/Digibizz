import { useState, useEffect } from "react";
import { DataTable } from "../AdmissionPortal/DataTable";
import { Column } from "../../types/columns";
import { DEFAULT_LEARNING_RESOURCE_COLUMNS } from "../../utils/tableUtils";
import {
  getLearningResources,
  deleteLearningResource,
} from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import SettingsHeader from "../Settings/SettingsHeader";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { storeFormData } from "../../utils/formStorage";
import { Loader2 } from "lucide-react";
import Loader from "../Loader";

interface ResourceData {
  ls_id: number;
  ls_title: string;
  ls_description: string;
  ls_attachment: string | null;
  proof: string | null;
  t_id: number;
  course_id: number;
  center_id: number;
  tb_id: number;
  ls_added_on: string;
  trainers?: {
    t_id: number;
    user_id: number;
  };
  training_batches?: {
    tb_id: number;
    tb_name: string;
  };
  centers?: {
    center_id: number;
    center_name: string;
  };
  courses?: {
    course_id: number;
    course_name: string;
  };
}

const LearningResourcesTable = ({ openForm }: { openForm: (formName: string) => void; }) => {
  const [columns, setColumns] = useState<Column[]>(
    DEFAULT_LEARNING_RESOURCE_COLUMNS
  );
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { selectedBatchId, user_id, userType, center_id, course_id } = useBatch();

  const fetchData = async () => {
    try {
      setIsLoading(true);
      console.log("Fetching learning resources for batch ID:", course_id);
      const response = await getLearningResources({
        tb_id: selectedBatchId,
        center_id: center_id,
        course_id: course_id,
        t_id: user_id,
        userType: userType
      });
      
      if (response.success && Array.isArray(response.data)) {
        // Format the data for the DataTable
        const formattedData = response.data.map((resource: ResourceData) => ({
          ...resource,
          trainer_name: resource.trainers?.user_id || 'N/A',
          batch_name: resource.training_batches?.tb_name || 'N/A', 
          center_name: resource.centers?.center_name || 'N/A',
          course_name: resource.courses?.course_name || 'N/A',
          proof: resource.ls_attachment || null,
          // Add formatted date
          added_date: new Date(resource.ls_added_on).toLocaleDateString()
        }));
        
        setData(formattedData);
      } else {
        console.error("Invalid response format:", response);
        setData([]);
      }
    } catch (error) {
      console.error("Error fetching learning resources:", error);
      toast.error("Failed to fetch learning resources");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this resource?")) {
      try {
        await deleteLearningResource(id);
        toast.success("Resource deleted successfully");
        fetchData();
      } catch (error) {
        toast.error("Failed to delete resource");
      }
    }
  };

  const handleEdit = (resource: any) => {
    storeFormData('learningResourceEdit', resource);
    openForm("LearningResourceForm");
  };

  const handleView = (resource: any) => {
    storeFormData('learningResourceView', resource);
    openForm("LearningResourceView");
  };

  useEffect(() => {
    if (selectedBatchId) {
      fetchData();
    }
  }, [selectedBatchId]);

  return (
    <div className="container max-w-8xl p-6">
      
        <SettingsHeader
          SettingsHeader="Learning Resources"
          SettingDescription="Access course materials and resources"
        />
   
      
      {userType === "trainer" && (
        <div className="flex justify-between items-center mb-6">
          <Button onClick={() => openForm("LearningResourceForm")}>Add New Resource</Button>
        </div>
      )}
      
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader />
          <p className="text-muted-foreground">Loading learning resources...</p>
        </div>
      )} 
      {userType === "trainer" ? (
        <DataTable
          data={data}
          columns={columns}
          setColumns={setColumns}
          isLoading={isLoading}
          isActionBtn={true}
          isProofBtn={true}
          onView={(item) => handleView(item)}
          onEdit={(item) => handleEdit(item)}
          onDelete={(item) => handleDelete(item.ls_id)}
        />
      ) : (
        <DataTable
          data={data}
          columns={columns}
          setColumns={setColumns}
          isLoading={isLoading}
          isActionBtn={true}
          isProofBtn={true}
          onView={(item) => handleView(item)}
        />
      )}
    </div>
  );
};

export default LearningResourcesTable;
