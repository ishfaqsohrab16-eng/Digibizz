import React, { useState, useEffect } from "react";
import { Loader } from "lucide-react";
import {
  trainerCenterAllocation,
  getAllCourse,
  getMasterTrainersProfile,
  getCenter,
  getTrainingBatches,
  getTrainersProfile,
  getAllTrainer,
} from "../services/api";
import { useToast } from "../hooks/use-toast";
import {
  TrainerCenterAllocationFormData,
  Course,
  MasterTrainerTableData,
  MasterTrainerApiData,
  Center,
  TrainerApiData,
  TrainerListData,
} from "../types/trainer";
import { useBatch } from "../context/BatchContext";

const initialFormData: TrainerCenterAllocationFormData = {
  t_course_id: 0,
  t_center_id: 0,
  tb_id: 0,
  t_id: 0,
  mt_id: 0,
};

const TrainersCenterAllocation: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<Course[]>([]);
  const [center, setCenter] = useState<Center[]>([]);
  const [trainers, setTrainers] = useState<TrainerListData[]>([]);
  const { selectedBatchId, selectedBatchName } = useBatch();
  const [formData, setFormData] =
    useState<TrainerCenterAllocationFormData>(initialFormData);
  const { toast } = useToast();
  const [masterTrainers, setMasterTrainers] = useState<
    MasterTrainerTableData[]
  >([]);
  const [filteredMasterTrainers, setFilteredMasterTrainers] = useState<
    MasterTrainerTableData[]
  >([]);
  const [trainingBatches, setTrainingBatches] = useState<
    Array<{ tb_id: number; tb_name: string }>
  >([]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    // Special handling for t_id
    if (name === "t_id") {
      const numericValue = Number(value);
      setFormData((prev) => ({
        ...prev,
        tb_id: selectedBatchId,
        t_id: numericValue,
      }));
      return;
    }

    // Handle other numeric fields
    const numericFields = ["t_course_id", "t_center_id", "tb_id", "mt_id"];
    const finalValue = numericFields.includes(name)
      ? Number(value) || 0
      : value;

    setFormData((prev) => ({
      ...prev,
      [name]: finalValue,
    }));

    if (name === "t_course_id") {
      const filtered = masterTrainers.filter(
        (trainer) => trainer.courseId === Number(value)
      );
      setFilteredMasterTrainers(filtered);
      if (filtered.length > 0) {
        setFormData((prev) => ({
          ...prev,
          mt_id: filtered[0].mt_id,
          t_course_id: Number(value),
        }));
      }
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch courses
        const courseData = await getAllCourse();
        setCourse(courseData);

        // Fetch centers
        const centerData = await getCenter();
        setCenter(centerData);

        // Fetch trainers data
        const response = await getAllTrainer();

        setTrainers(response.data);

        // Fetch master trainers
        const masterTrainerResponse = await getMasterTrainersProfile();
        if (!masterTrainerResponse.success) {
          throw new Error(masterTrainerResponse.message);
        }

        const mappedTrainerData: MasterTrainerTableData[] =
          masterTrainerResponse.data.map((trainer: MasterTrainerApiData) => ({
            ...trainer,
            id: trainer.user_id,
          }));
        setMasterTrainers(mappedTrainerData);

        // Fetch training batches
        const batchData = await getTrainingBatches();
        const sortedBatches = batchData.data.sort(
          (a: { created_at: string }, b: { created_at: string }) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setTrainingBatches(sortedBatches);

        if (sortedBatches.length > 0) {
          const latestBatch = sortedBatches[sortedBatches.length - 1];
          setFormData((prev) => ({
            ...prev,
            tb_id: latestBatch.tb_id,
          }));
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch required data. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (
      !formData.t_center_id ||
      !formData.t_course_id ||
      !formData.tb_id ||
      !formData.t_id
    ) {
      const errorMsg = "Please fill in all required fields";
      setError(errorMsg);
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMsg,
      });
      return;
    }

    setLoading(true);
    try {
      const response = await trainerCenterAllocation(formData);
      toast({
        title: "Success",
        description: "Trainer center allocation saved successfully",
      });
      setFormData(initialFormData);
      setFilteredMasterTrainers([]);
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
      <h2 className="text-2xl font-bold mb-4">Trainer Center Allocation</h2>

      {loading && (
        <div className="flex justify-center items-center mb-4">
          <Loader className="animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-red-500 mb-4 p-3 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <div className="space-y-2">
          <label htmlFor="t_id" className="block font-medium">
            Trainer <span className="text-red-500">*</span>
          </label>
          <select
            id="t_id"
            name="t_id"
            value={formData.t_id || ""}
            onChange={handleInputChange}
            className={`w-full p-2 border rounded ${
              error && !formData.t_id ? "border-red-500" : "border-gray-300"
            }`}
            required
          >
            <option value="">Select a Trainer</option>
            {trainers.map((trainerItem) => (
              <option key={trainerItem.t_id} value={trainerItem.t_id}>
                {trainerItem.user_name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="t_center_id" className="block font-medium">
            Center <span className="text-red-500">*</span>
          </label>
          <select
            id="t_center_id"
            name="t_center_id"
            value={formData.t_center_id || ""}
            onChange={handleInputChange}
            className={`w-full p-2 border rounded ${
              error && !formData.t_center_id
                ? "border-red-500"
                : "border-gray-300"
            }`}
            required
          >
            <option value="">Select a Center</option>
            {center.map((centerItem) => (
              <option key={centerItem.center_id} value={centerItem.center_id}>
                {centerItem.center_name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="t_course_id" className="block font-medium">
            Course <span className="text-red-500">*</span>
          </label>
          <select
            id="t_course_id"
            name="t_course_id"
            value={formData.t_course_id || ""}
            onChange={handleInputChange}
            className={`w-full p-2 border rounded ${
              error && !formData.t_course_id
                ? "border-red-500"
                : "border-gray-300"
            }`}
            required
          >
            <option value="">Select a Course</option>
            {course.map((courseItem) => (
              <option key={courseItem.course_id} value={courseItem.course_id}>
                {courseItem.course_name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="mt_id" className="block font-medium">
            Master Trainer <span className="text-red-500">*</span>
          </label>
          <select
            id="mt_id"
            name="mt_id"
            value={formData.mt_id || ""}
            onChange={handleInputChange}
            className={`w-full p-2 border rounded`}
            required
            disabled
          >
            {filteredMasterTrainers.map((Mtrainer) => (
              <option key={Mtrainer.mt_id} value={Mtrainer.mt_id}>
                {Mtrainer.user_name}
              </option>
            ))}
          </select>
          {!formData.t_course_id && (
            <p className="text-sm text-yellow-500">
              Please select a course first
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="tb_id" className="block font-medium">
            Training Batch <span className="text-red-500">*</span>
          </label>
          <select
            id="tb_id"
            name="tb_id"
            value={formData.tb_id || ""}
            onChange={handleInputChange}
            className={`w-full p-2 border rounded ${
              error && !formData.tb_id ? "border-red-500" : "border-gray-300"
            }`}
            required
            disabled={true}
          >
            <option value="">Select a Training Batch</option>
            {trainingBatches.map((batch) => (
              <option key={selectedBatchId} value={selectedBatchId}>
                {selectedBatchName}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            className="w-full bg-emerald-500 text-white py-2 px-4 rounded hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <Loader className="animate-spin mr-2" size={16} />
                Saving...
              </span>
            ) : (
              "Save Trainer Center Allocation"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TrainersCenterAllocation;
