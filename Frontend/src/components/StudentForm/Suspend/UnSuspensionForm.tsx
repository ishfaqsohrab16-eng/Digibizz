import { useState } from "react";
import { studentUnSuspension } from "../../../services/api";
import { toast } from "sonner";

const UnSuspensionForm = () => {
  const [studentCNIC, setStudentCNIC] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const response = await studentUnSuspension(studentCNIC);
      if (response.success) {
        toast.success("Student unsuspended successfully!");
        setStudentCNIC("");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error during unsuspension:", error);
      toast.error("Failed to unsuspend the student. Please try again.");
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

        <button
          type="submit"
          className="w-full py-2 px-4 bg-[#ea384c] text-white rounded-md hover:bg-[#ea384c]/90 transition-colors"
        >
          ({isLoading ? "Loading..." : "Un Suspend"})
        </button>
      </form>
    </div>
  );
};

export default UnSuspensionForm;
