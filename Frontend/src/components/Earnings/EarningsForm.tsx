import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { DollarSign } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import SettingsHeader from "../../components/Settings/SettingsHeader";
import { useBatch } from "../../context/BatchContext";
import { createEarning } from "../../services/api";
import { EarningFormData } from "../../types/earningFormData";
import { toast } from "sonner";

const EARNING_PLATFORMS = [
  "99designs",
  "Amazon",
  "Behance",
  "Cross Over",
  "Demand Media",
  "Design Crowd",
  "Dribbble",
  "Facebook",
  "Fiverr",
  "Freelancer",
  "Google Adsense",
  "LinkedIn",
  "Markaz",
  "People Per Hour",
  "Simply Hired",
  "Toptal",
  "Truelancer",
  "Upwork",
  "Other",
];

export default function EarningsForm({
  openForm,
  mode = "create",
  initialData = null,
}: {
  openForm: (formName: string) => void;
  mode?: "create" | "edit" | "view";
  initialData?: any;
}) {
  const { selectedBatchId, center_id, course_id, user_id } = useBatch();

  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<EarningFormData>({
    earning_platform: "",
    earning_amount: 0,
    earning_date: "",
    center_id: center_id,
    course_id: course_id,
    tb_id: selectedBatchId,
    user_id: user_id,
  });
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialData && (mode === "edit" || mode === "view")) {
      setForm({
        earning_platform: initialData.earning_platform,
        earning_amount: initialData.earning_amount,
        earning_date: initialData.earning_date,
        center_id: center_id,
        course_id: course_id,
        tb_id: selectedBatchId,
        user_id: user_id,
      });
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // The platform Select has no native `required`, so without these checks an
    // empty value was posted and the server rejected it with a validation
    // error the user never saw.
    if (!form.earning_platform?.trim()) {
      toast.error("Please select an earning platform");
      return;
    }

    if (!form.earning_amount || Number(form.earning_amount) <= 0) {
      toast.error("Please enter an earning amount greater than zero");
      return;
    }

    if (!form.earning_date?.trim()) {
      toast.error("Please select an earning date");
      return;
    }

    if (!file) {
      toast.error("Please upload an earning proof file");
      return;
    }

    setLoading(true);
    setSuccessMsg(null);

    try {
      const response = await createEarning(form, file);

      if (response.success) {
        toast.success("Earning record created successfully");

        // Reset form
        setForm({
          earning_platform: "",
          earning_amount: 0,
          earning_date: "",
          center_id: center_id,
          course_id: course_id,
          tb_id: selectedBatchId,
          user_id: user_id,
        });
        setFile(null);
      } else {
        toast.error(response.message || "Failed to create earning record");
      }
    } catch (error) {
      console.error(error);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <SettingsHeader
        SettingsHeader="Earnings"
        SettingDescription={`${
          mode === "create" ? "Add" : mode === "edit" ? "Edit" : "View"
        } Earnings`}
      />
      <form onSubmit={handleSubmit} className="">
        <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
          <div className="space-y-2">
            <label className="block text-gray-700 font-medium">
              Earning Platform
            </label>
            <Select
              name="earning_platform"
              value={form.earning_platform}
              onValueChange={(value) =>
                setForm({ ...form, earning_platform: value })
              }
            >
              <SelectTrigger className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none">
                <SelectValue placeholder="Select Platform" />
              </SelectTrigger>
              <SelectContent>
                {EARNING_PLATFORMS.map((platform) => (
                  <SelectItem key={platform} value={platform}>
                    {platform}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="block text-gray-700 font-medium">
              Earning Amount
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                <DollarSign size={16} />
              </span>
              <input
                id="earning_amount"
                name="earning_amount"
                type="number"
                value={form.earning_amount}
                onChange={handleChange}
                required
                className="w-full p-2 pl-10 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label
              className="block text-gray-700 font-medium"
              htmlFor="earning_date"
            >
              Earning Date
            </label>
            <input
              id="earning_date"
              name="earning_date"
              type="date"
              value={form.earning_date}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="block text-gray-700 font-medium">
              Earning Proof
            </label>
            <input
              type="file"
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>
          {mode !== "view" && (
            <div className="space-y-2 mt-8">
              <button
                type="submit"
                className="w-full bg-emerald-500 text-white py-2 px-4 rounded hover:bg-emerald-600 transition-colors"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  mode === "edit" ? "Update" : "Create"
                )}
              </button>
              {successMsg && (
                <div className="text-green-600 text-center mt-4 font-medium">
                  {successMsg}
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
