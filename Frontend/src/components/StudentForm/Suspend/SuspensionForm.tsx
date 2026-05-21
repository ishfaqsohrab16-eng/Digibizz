import { useState } from "react";
import { Textarea } from "../../../components/ui/textarea";
import { studentSuspension } from "../../../services/api";
import { useToast } from "../../../components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const SuspensionForm = () => {
  const [studentCNIC, setStudentCNIC] = useState("");
  const [suspensionReason, setSuspensionReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const response = await studentSuspension(studentCNIC, suspensionReason);
    if (response.success) {
      toast.success("Student suspended successfully!");
      setStudentCNIC("");
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded-lg shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="studentCNIC"
            className="block text-gray-700 text-sm font-medium mb-2"
          >
            Student CNIC
          </label>
          <input
            id="studentCNIC"
            type="text"
            value={studentCNIC}
            onChange={(e) => setStudentCNIC(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder="Enter student CNIC"
          />
        </div>

        <div>
          <label
            htmlFor="suspensionReason"
            className="block text-gray-700 text-sm font-medium mb-2"
          >
            Suspension Reason
          </label>
          <Textarea
            id="suspensionReason"
            value={suspensionReason}
            onChange={(e) => setSuspensionReason(e.target.value)}
            className="min-h-[120px] resize-none border-gray-300"
            placeholder="Enter suspension reason"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 px-4 bg-[#ea384c] text-white rounded-md hover:bg-[#ea384c]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            "Suspend"
          )}
        </button>
      </form>
    </div>
  );
};

export default SuspensionForm;
