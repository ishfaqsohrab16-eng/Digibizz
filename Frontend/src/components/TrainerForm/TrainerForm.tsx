import React, { useState, useEffect } from "react";
import { Loader } from "lucide-react";
import {
  registerTrainer,
  getAllCourse,
  getMasterTrainersProfile,
  getCenter,
} from "../../services/api";
import { useToast } from "../../hooks/use-toast";
import {
  TrainerFormData,
  Course,
  MasterTrainerTableData,
  MasterTrainerApiData,
  Center,
} from "../../types/trainer";
import SettingsHeader from "../Settings/SettingsHeader";


const initialFormData: TrainerFormData = {
  t_cnic: "",
  user_name: "",
  user_email: "",
  user_password: "",
  user_username: "",
  t_course_id: 0,
  t_center_id: 0,
  mt_id: 0,
  dark_mode: "0",
  user_status: 0,
  user_type: "Trainer",
};

export const TrainerForm: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<Course[]>([]);
  const [center, setCenter] = useState<Center[]>([]);
  const [formData, setFormData] = useState<TrainerFormData>(initialFormData);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();
  const [masterTrainers, setMasterTrainers] = useState<
    MasterTrainerTableData[]
  >([]);
  const [filteredMasterTrainers, setFilteredMasterTrainers] = useState<
    MasterTrainerTableData[]
  >([]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "t_course_id" ||
        name === "user_id" ||
        name === "user_status" ||
        name === "t_center_id"
          ? Number(value)
          : value,
    }));

    if (name === "t_course_id") {
      const filtered = masterTrainers.filter(
        (trainer) => trainer.courseId === Number(value)
      );
      setFilteredMasterTrainers(filtered);
      setFormData((prev) => ({
        ...prev,
        user_id: 0,
      }));
    }
  };

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const data = await getAllCourse();
        setCourse(data);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch courses. Please try again.",
        });
      }
    };
    const fetchCenters = async () => {
      try {
        const data = await getCenter();
        setCenter(data);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch centers. Please try again.",
        });
      }
    };

    const fetchMasterTrainers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getMasterTrainersProfile();
        if (!response.success) {
          throw new Error(response.message);
        }

        const mappedData: MasterTrainerTableData[] = response.data.map(
          (trainer: MasterTrainerApiData) => ({
            ...trainer,
            id: trainer.user_id,
          })
        );

        setMasterTrainers(mappedData);
      } catch (error) {
        console.error("Error fetching MasterTrainers:", error);
        setError(
          "Failed to fetch Master Trainer data. Please try again later."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMasterTrainers();
    fetchCourses();
    fetchCenters();
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePhoto(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.user_password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const response = await registerTrainer(formData, profilePhoto || undefined);
      toast({
        title: "Success",
        description: "Trainer registered successfully",
      });
      setFormData(initialFormData);
      setProfilePhoto(null);
      setConfirmPassword("");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Registration failed";
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <SettingsHeader
        SettingsHeader="Create Trainer Date"
        SettingDescription="Create Trainer Date"
      />
      {loading && <Loader />}
      {error && <div className="text-red-500 mb-4">{error}</div>}

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <div>
          <label className="block text-gray-700">CNIC</label>
          <input
            type="text"
            name="t_cnic"
            value={formData.t_cnic}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            placeholder="Enter CNIC"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700">Full Name</label>
          <input
            type="text"
            name="user_name"
            value={formData.user_name}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            placeholder="Enter Full Name"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700">Email</label>
          <input
            type="email"
            name="user_email"
            value={formData.user_email}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            placeholder="Enter Email"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700">Username</label>
          <input
            type="text"
            name="user_username"
            value={formData.user_username}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            placeholder="Enter Username"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700">Password</label>
          <input
            type="password"
            name="user_password"
            value={formData.user_password}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            placeholder="Enter Password"
            required
          />
        </div>

        <div>
          <label className="block text-gray-700">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            placeholder="Confirm Password"
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="t_center_id">Center</label>
          <select
            id="t_center_id"
            name="t_center_id"
            value={formData.t_center_id}
            onChange={handleInputChange}
            className={`w-full p-2 border rounded ${
              error ? "border-red-500" : "border-gray-300"
            }`}
            required
          >
            <option value="">Select a Center</option>
            {center.map((center) => (
              <option key={center.center_id} value={center.center_id}>
                {center.center_name}
              </option>
            ))}
          </select>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
        <div className="space-y-2">
          <label htmlFor="t_course_id">Course</label>
          <select
            id="t_course_id"
            name="t_course_id"
            value={formData.t_course_id}
            onChange={handleInputChange}
            className={`w-full p-2 border rounded ${
              error ? "border-red-500" : "border-gray-300"
            }`}
            required
          >
            <option value="">Select a course</option>
            {course.map((center) => (
              <option key={center.course_id} value={center.course_id}>
                {center.course_name}
              </option>
            ))}
          </select>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div className="space-y-2">
          <label htmlFor="mt_id">Master Trainer</label>
          <select
            id="mt_id"
            name="mt_id"
            value={formData.mt_id}
            onChange={handleInputChange}
            className={`w-full p-2 border rounded ${
              error ? "border-red-500" : "border-gray-300"
            }`}
            required
            disabled
          >
            {filteredMasterTrainers.map((masterTrainer) => (
              <option
                key={masterTrainer.mt_id}
                value={(formData.mt_id = masterTrainer.mt_id)}
              >
                {masterTrainer.user_name}
              </option>
            ))}
          </select>
          {!formData.t_course_id && (
            <p className="text-sm text-yellow-500">
              Please select a course first
            </p>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        <div>
          <label className="block text-gray-700">Profile Photo</label>
          <input
            type="file"
            onChange={handleFileChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
            accept="image/*"
          />
        </div>

        <div>
          <label className="block text-gray-700">Dark Mode</label>
          <select
            name="dark_mode"
            value={formData.dark_mode}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="0">Light Mode</option>
            <option value="1">Dark Mode</option>
          </select>
        </div>

        <div>
          <label className="block text-gray-700">Status</label>
          <select
            name="user_status"
            value={formData.user_status}
            onChange={handleInputChange}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value={0}>Inactive</option>
            <option value={1}>Active</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            className="w-full bg-emerald-500 text-white py-2 px-4 rounded hover:bg-emerald-600 transition-colors"
            disabled={loading}
          >
            {loading ? "Registering..." : "Save Trainer"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TrainerForm;
