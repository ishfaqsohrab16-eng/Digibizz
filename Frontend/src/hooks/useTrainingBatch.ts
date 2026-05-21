import { useState } from "react";

import { createTrainingBatch } from "../services/api";
import { ApiError, TrainingBatchFormData } from "../types/trainingBatchFormData";

interface UseTrainingBatchReturn {
  formData: TrainingBatchFormData;
  message: string | null;
  errors: string[];
  isLoading: boolean;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
}

export function useTrainingBatch(): UseTrainingBatchReturn {
  const [formData, setFormData] = useState<TrainingBatchFormData>({
    tb_name: "",
    tb_slug: "",
    tb_descrip: "",
    tb_start: "",
    tb_end: "",
    tb_status: "0",
  });

  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setErrors([]);
    setIsLoading(true);

    try {
      await createTrainingBatch(formData);
      setMessage("Training Batch created successfully");
      // Reset form after successful submission
      setFormData({
        tb_name: "",
        tb_slug: "",
        tb_descrip: "",
        tb_start: "",
        tb_end: "",
        tb_status: "0",
      });
    } catch (error) {
      const apiError = error as ApiError;
      console.error("Error:", apiError);

      if (apiError.message) {
        setMessage(apiError.message);
      }

      if (apiError.errors) {
        setErrors(apiError.errors.map((err) => err.msg));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return {
    formData,
    message,
    errors,
    isLoading,
    handleSubmit,
    handleInputChange,
  };
}
