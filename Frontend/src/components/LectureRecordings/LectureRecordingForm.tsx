import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { useBatch } from "../../context/BatchContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  createLectureRecording,
  updateLectureRecording,
} from "../../services/api";
import { LectureRecordingData } from "../../types/learningResources";
import { getFormData, clearFormData } from "../../utils/formStorage";
import { ExternalLink } from "lucide-react";

interface LectureRecordingFormProps {
  initialData?: LectureRecordingData;
  onSuccess?: () => void;
  viewOnly?: boolean;
}

const LectureRecordingForm = ({
  initialData,
  onSuccess,
  viewOnly = false
}: LectureRecordingFormProps) => {
  const { selectedBatchId, user_id, center_id, course_id } = useBatch();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState<LectureRecordingData>({
    lr_title: "",
    lr_topics: "",
    lr_link: "",
    lr_date: new Date().toISOString().split("T")[0],
    t_id: user_id || 0,
    tb_id: selectedBatchId || 0,
    course_id: course_id || 0,
    center_id: center_id || 0,
  });
  
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    // Check if we have stored edit data
    let storedData;
    if(viewOnly){
       storedData = getFormData('lectureRecordingView');
       if (storedData) {
        setFormData(storedData);
      }
    }else{
     storedData = getFormData('lectureRecordingEdit');
     if (storedData) {
      setFormData(storedData);
      // Clear after retrieving
      clearFormData('lectureRecordingEdit');
    }else if (initialData) {
      setFormData(initialData);
    }
    }  
  }, [initialData]);

  // Update form data when batch context values change
  useEffect(() => {
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

  const validateForm = () => {
    // Check if all required fields have values
    if (!formData.lr_title || formData.lr_title.trim() === '') {
      toast.error("Title is required");
      return false;
    }
    if (!formData.lr_topics || formData.lr_topics.trim() === '') {
      toast.error("Topics are required");
      return false;
    }
    if (!formData.lr_link || formData.lr_link.trim() === '') {
      toast.error("Recording link is required");
      return false;
    }
    if (!formData.lr_date) {
      toast.error("Date is required");
      return false;
    }
    if (!formData.t_id) {
      toast.error("Trainer ID is missing");
      return false;
    }
    if (!formData.tb_id) {
      toast.error("Training batch is missing");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (viewOnly) return;
    if (!validateForm()) return;
    
    setLoading(true);

    try {
      // Make sure all required fields are set correctly
      const submissionData = {
        ...formData,
        t_id: user_id || 0,
        tb_id: selectedBatchId || 0,
        course_id: course_id || 0,
        center_id: center_id || 0,
      };

      if (submissionData.lr_id) {
        await updateLectureRecording(submissionData.lr_id, submissionData, file || undefined);
        toast.success("Lecture recording updated successfully");
      } else {
        await createLectureRecording(submissionData, file || undefined);
        toast.success("Lecture recording created successfully");
      }

      // Navigate back to the LectureRecordings table
      navigate("/dashboard/LectureRecording");
    } catch (error) {
      toast.error("Failed to save lecture recording");
      console.error("Error saving lecture recording:", error);
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
        {viewOnly ? "View Lecture Recording" : formData.lr_id ? "Edit Lecture Recording" : "Add New Lecture Recording"}
      </h2>

      <div className="space-y-4">
        <div>
          <label htmlFor="lr_title" className="text-sm font-medium">
            Title
          </label>
          <Input
            id="lr_title"
            value={formData.lr_title}
            onChange={(e) =>
              setFormData({ ...formData, lr_title: e.target.value })
            }
            required
            disabled={viewOnly}
            className={viewOnly ? "bg-muted cursor-not-allowed" : ""}
          />
        </div>

        <div>
          <label htmlFor="lr_topics" className="text-sm font-medium">
            Topics Covered
          </label>
          <Textarea
            id="lr_topics"
            value={formData.lr_topics}
            onChange={(e) =>
              setFormData({ ...formData, lr_topics: e.target.value })
            }
            required
            disabled={viewOnly}
            className={viewOnly ? "bg-muted cursor-not-allowed" : ""}
          />
        </div>

        <div>
          <label htmlFor="lr_link" className="text-sm font-medium">
            Recording Link
          </label>
          {viewOnly ? (
            <div className="flex items-center mt-1">
              <Input
                id="lr_link"
                value={formData.lr_link}
                disabled
                className="bg-muted cursor-not-allowed flex-grow"
              />
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="ml-2"
                onClick={() => window.open(formData.lr_link, "_blank")}
              >
                <ExternalLink size={16} />
              </Button>
            </div>
          ) : (
            <Input
              id="lr_link"
              value={formData.lr_link}
              onChange={(e) =>
                setFormData({ ...formData, lr_link: e.target.value })
              }
              required
              type="url"
              placeholder="https://"
            />
          )}
        </div>

        <div>
          <label htmlFor="lr_date" className="text-sm font-medium">
            Date
          </label>
          <Input
            id="lr_date"
            type="date"
            value={formData.lr_date}
            onChange={(e) =>
              setFormData({ ...formData, lr_date: e.target.value })
            }
            required
            disabled={viewOnly}
            className={viewOnly ? "bg-muted cursor-not-allowed" : ""}
          />
        </div>

        {!viewOnly && (
          <div>
            <label htmlFor="lr_attachment" className="text-sm font-medium">
              Additional Material
            </label>
            <Input
              id="lr_attachment"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
        )}

        {viewOnly && formData.lr_attachment && (
          <div>
            <label className="text-sm font-medium">Additional Material</label>
            <div className="mt-2">
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => window.open(`${import.meta.env.VITE_BACKEND_URL}${formData.lr_attachment}`, "_blank")}
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
          onClick={() => navigate("/dashboard/LectureRecording")}
        >
          {viewOnly ? "Back" : "Cancel"}
        </Button>
        
        {!viewOnly && (
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : formData.lr_id ? "Update" : "Create"}
          </Button>
        )}
      </div>
    </form>
  );
};

export default LectureRecordingForm;
