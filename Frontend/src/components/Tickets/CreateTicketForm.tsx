import { useState, useEffect, ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { createTicket } from "../../services/api";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

import { useBatch } from "../../context/BatchContext";
import { TicketFormData } from "../../types/ticket";
import { toast } from "sonner";
import { format } from "date-fns";
import SettingsHeader from "../Settings/SettingsHeader";

interface CreateTicketFormProps {
  openForm: (formName: string) => void;
}

const CreateTicketForm: React.FC<CreateTicketFormProps> = ({ openForm }) => {
  const { user_id, selectedBatchId, center_id, course_id } = useBatch();
  
  const [trainers, setTrainers] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [studentRollNo, setStudentRollNo] = useState<string>("");
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [formData, setFormData] = useState<TicketFormData>({
    ticket_subject: "",
    ticket_description: "",
    ticket_to: "TRAINER",
    t_id: 0,
    tb_id: selectedBatchId || 0,
    center_id: center_id || 0,
    course_id: course_id || 0,
    std_rollno: "",
    user_id:user_id
  });

  useEffect(() => {
    const fetchStudentRollNo = async () => {
      // In a real implementation, you'd call an API to get the student roll number
      const rollNo = "STD-" + user_id;
      setStudentRollNo(rollNo);
      setFormData(prev => ({
        ...prev,
        std_rollno: rollNo
      }));
    };

    const fetchTrainers = async () => {
      try {
        // const response = await getTrainersByBatch(selectedBatchId);
        // if (response.success) {
        //   setTrainers(response.data);
        // }
      } catch (error) {
        console.error("Failed to fetch trainers:", error);
      }
    };

    if (selectedBatchId) {
      fetchStudentRollNo();
      fetchTrainers();
    }
  }, [selectedBatchId, user_id]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: name === 't_id' ? parseInt(value) : value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        setProfilePhoto(e.target.files[0]);
      }
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      
      // Add the current date, time and status
      const ticketData = {
        ...formData,
        ticket_date: format(new Date(), "yyyy-MM-dd"),
        ticket_time: format(new Date(), "HH:mm:ss"),
        ticket_status: "OPEN",
        user_id: user_id
      };
      
      const response = await createTicket(ticketData, profilePhoto || undefined);
      
      if (response.success) {
        toast.success("Ticket created successfully");
        setFormData({
          ticket_subject: "",
          ticket_description: "",
          ticket_to: "trainer",
          t_id: 0,
          tb_id: selectedBatchId || 0,
          center_id: center_id || 0,
          course_id: course_id || 0,
          std_rollno: "",
        });
        openForm("TicketList");
      } else {
        toast.error(response.message || "Failed to create ticket");
      }
    } catch (error) {
      console.error("Error creating ticket:", error);
      toast.error("Error creating ticket");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-8xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <SettingsHeader
        SettingsHeader="Create Support Ticket"
        SettingDescription="Submit a new support ticket"
      />
      
      <Button 
        variant="ghost" 
        className="mb-6 flex items-center gap-2" 
        onClick={() => openForm("TicketList")}
      >
        <ArrowLeft size={16} />
        Back to Tickets
      </Button>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-2">
            <Label htmlFor="ticket_subject">Subject</Label>
            <Input
              id="ticket_subject"
              name="ticket_subject"
              value={formData.ticket_subject}
              onChange={handleInputChange}
              placeholder="Enter the subject of your ticket"
              className="w-full"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="ticket_to">Select Recipient</Label>
            <select
              name="ticket_to"
              value={formData.ticket_to}
              onChange={(e) => handleSelectChange("ticket_to", e.target.value)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            >
              <option value="TRAINER">Trainer</option>
              <option value="ADMIN">Administrator</option>
              <option value="MT">Master Trainer</option>
            </select>
          </div>
          
          {trainers.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="t_id">Trainer</Label>
              <select
                name="t_id"
                value={formData.t_id.toString()}
                onChange={(e) => handleSelectChange("t_id", e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                required
              >
                <option value="">Select trainer</option>
                {trainers.map((trainer) => (
                  <option 
                    key={trainer.t_id} 
                    value={trainer.t_id.toString()}
                  >
                    {trainer.user ? trainer.user.user_name : `Trainer ${trainer.t_id}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="ticket_description">Description</Label>
            <Textarea
              id="ticket_description"
              name="ticket_description"
              value={formData.ticket_description}
              onChange={handleInputChange}
              placeholder="Describe your issue in detail"
              rows={6}
              className="w-full"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="ticket_attachment">Attachment (Optional)</Label>
            <Input
              id="ticket_attachment"
              name="ticket_attachment"
              type="file"
              onChange={handleFileChange}
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              Max file size: 5MB. Supported formats: PDF, JPG, PNG
            </p>
          </div>
        </div>
        
        <div className="flex justify-end space-x-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => openForm("TicketList")}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit Ticket"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateTicketForm;
