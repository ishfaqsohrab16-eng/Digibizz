import { Send } from "lucide-react";
import React, { useState, useEffect } from "react";
import "react-toastify/dist/ReactToastify.css";
import { useBatch } from "../../context/BatchContext";
import { addHoliday, getCenter } from "../../services/api";
import { toast } from "sonner";
import Loader from "../Loader";
export interface HolidayFormProps {
  tb_id: number;
  h_date: string;
  h_reason: string;
  center_id: number | null;
  training_batches?: {
    tb_name?: string;
  };
  centers?: {
    center_name?: string;
  };
}
const HolidayForm = ({
  onHolidayAdded,
}: {
  onHolidayAdded: (holidayData: HolidayFormProps) => void;
}) => {
  const [h_date, setDate] = useState("");
  const [h_reason, setHolidayFor] = useState("");
  const { selectedBatchId } = useBatch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [center, setCenter] = useState<any[]>([]);
  const [centerId, setCenterId] = useState<string>("");
  const [loader, setLoader] = useState(false);

  useEffect(() => {
    const fetchCenter = async () => {
      try {
        setLoader(true);
        const response = await getCenter();
        setCenter(response);
        setLoader(false);
      } catch (error) {
        console.error("Error fetching center data:", error);
        setLoader(false);
      }
    };
    fetchCenter();
  }, []);

  const isWeekend = (dateString: string) => {
    const selectedDate = new Date(dateString);
    const day = selectedDate.getDay(); // 0 = Sunday, 6 = Saturday
    return day === 0 || day === 6;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (isWeekend(h_date)) {
      toast.error(
        "❌ Holidays can only be added on working days (Monday to Friday)."
      );
      setIsSubmitting(false);
      return;
    }

    if (!centerId) {
      toast.error("❌ Please select a center.");
      setIsSubmitting(false);
      return;
    }

    const holidayData: HolidayFormProps = {
      tb_id: selectedBatchId,
      h_date,
      h_reason,
      center_id: centerId === "all" ? null : Number(centerId),
    };
    const response = await addHoliday(holidayData);
    if (response) {
      toast.success("✅ Holiday added successfully!");
    }
    if (onHolidayAdded) {
      onHolidayAdded(holidayData);
    }
    setIsSubmitting(false);
  };

  if (loader) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader />
      </div>
    );
  }
  return (
    <div className="p-5 font-sans max-w-8xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4 max-w-4xl">
        <div className="flex flex-col space-y-2">
          <select
            value={centerId}
            onChange={(e) => setCenterId(e.target.value)}
            required
            className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Center</option>
            <option value="null">All Centers</option>
            {center.map((c) => (
              <option key={c.center_id} value={c.center_id}>
                {c.center_name}
              </option>
            ))}
          </select>
          <label htmlFor="h_date" className="text-sm font-medium">
            mm/dd/yyyy
          </label>
          <input
            type="date"
            id="h_date"
            value={h_date}
            onChange={(e) => setDate(e.target.value)}
            className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div className="flex flex-col space-y-2">
          <label htmlFor="h_reason" className="text-sm font-medium">
            Holiday for?
          </label>
          <textarea
            rows={3}
            id="h_reason"
            value={h_reason}
            onChange={(e) => setHolidayFor(e.target.value)}
            className="p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter holiday description"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-4 rounded-xl text-green-700 font-medium
                      flex items-center justify-center space-x-2
                      transform transition-all duration-300
                      ${
                        isSubmitting
                          ? "bg-green-300 cursor-not-allowed"
                          : "header-gradient text-white hover:bg-green-700"
                      }`}
        >
          <Send
            className={`w-5 h-5 ${
              isSubmitting ? "animate-pulse" : "animate-none"
            }`}
          />
          <span>{isSubmitting ? "Submitting..." : "Submit Holiday"}</span>
        </button>
      </form>
    </div>
  );
};

export default HolidayForm;
