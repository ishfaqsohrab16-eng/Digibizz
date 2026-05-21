import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { useBatch } from "../../context/BatchContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  createLearningResource,
  updateLearningResource,
} from "../../services/api";
import { LearningResourceData } from "../../types/learningResources";
import { getFormData, clearFormData } from "../../utils/formStorage";
import { ExternalLink } from "lucide-react";

interface LearningResourceFormProps {
  initialData?: LearningResourceData;
  onClose?: () => void;
  onSuccess?: () => void;
  viewOnly?: boolean;
}

const LearningResourceForm = ({
  initialData,
  viewOnly = false
}: LearningResourceFormProps) => {
  const navigate = useNavigate();
  const { selectedBatchId, user_id, center_id, course_id } = useBatch();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<LearningResourceData>(
    initialData || {
      ls_title: "",
      ls_description: "",
      t_id: user_id,
      course_id: course_id,
      center_id: center_id,
      tb_id: selectedBatchId,
    }
  );
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    // Check if we have stored edit data'
    let storedData;
    if(viewOnly){
       storedData = getFormData('learningResourceView');
       if (storedData) {
        setFormData(storedData);
      }
    }else{
     storedData = getFormData('learningResourceEdit');
     if (storedData) {
      setFormData(storedData);
      // Clear after retrieving
      clearFormData('learningResourceEdit');
    }
    }
   
  }, []);

  useEffect(() => {
    // Update form data when batch context values change
    if (!viewOnly && user_id && selectedBatchId) {
      setFormData(prevData => ({
        ...prevData,
        t_id: user_id,
        tb_id: selectedBatchId,
        course_id: course_id || 0,
        center_id: center_id || 0
      }));
    }
  }, [user_id, selectedBatchId, course_id, center_id, viewOnly]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (viewOnly) return;
    setLoading(true);

    try {
      if (!file && !formData.ls_id) {
        toast.error("Please select a file to upload");
        setLoading(false);
        return;
      }
     
      if (formData.ls_id) {
        await updateLearningResource(formData.ls_id, formData);
        toast.success("Learning resource updated successfully");
      } else {
        await createLearningResource(formData, file);
        toast.success("Learning resource created successfully");
      }
      
      // Navigate back to the resources list
      navigate("/dashboard/LearningResources");
    } catch (error) {
      toast.error("Failed to save learning resource");
      console.error("Error saving learning resource:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 bg-card p-6 rounded-lg shadow-lg"
    >
      <h2 className="text-2xl font-bold">
        {viewOnly ? "View Learning Resource" : formData.ls_id ? "Edit Learning Resource" : "Add New Learning Resource"}
      </h2>

      <div className="space-y-4">
        <div>
          <label htmlFor="ls_title" className="text-sm font-medium">
            Title
          </label>
          <Input
            id="ls_title"
            value={formData.ls_title}
            onChange={(e) =>
              setFormData({ ...formData, ls_title: e.target.value })
            }
            required
            disabled={viewOnly}
            className={viewOnly ? "bg-muted cursor-not-allowed" : ""}
          />
        </div>

        <div>
          <label htmlFor="ls_description" className="text-sm font-medium">
            Description
          </label>
          <Textarea
            id="ls_description"
            value={formData.ls_description}
            onChange={(e) =>
              setFormData({ ...formData, ls_description: e.target.value })
            }
            required
            disabled={viewOnly}
            className={viewOnly ? "bg-muted cursor-not-allowed" : ""}
          />
        </div>

        {!viewOnly && (
          <div>
            <label htmlFor="ls_attachment" className="text-sm font-medium">
              Attachment {!formData.ls_id && <span className="text-red-500">*</span>}
            </label>
            <Input
              id="ls_attachment"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required={!formData.ls_id}
            />
          </div>
        )}

        {viewOnly && formData.ls_attachment && (
          <div>
            <label className="text-sm font-medium">Attachment</label>
            <div className="mt-2">
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => window.open(`${import.meta.env.VITE_BACKEND_URL}${formData.ls_attachment}`, "_blank")}
              >
                <ExternalLink size={16} className="mr-2" />
                View Attachment
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between space-x-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => navigate("/dashboard/LearningResources")}
        >
          {viewOnly ? "Back" : "Cancel"}
        </Button>
        
        {!viewOnly && (
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : formData.ls_id ? "Update" : "Create"}
          </Button>
        )}
      </div>
    </form>
  );
};

export default LearningResourceForm;
