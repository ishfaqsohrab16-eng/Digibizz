import React, { useState, useEffect } from "react";
import { getTrainingBatches } from "../../services/api";

interface TrainingBatch {
  id: number;
  name: string;
  created_at: string;
  tb_id: number;
}

interface TrainingBatchSelectProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export const TrainingBatchSelect: React.FC<TrainingBatchSelectProps> = ({
  value,
  onChange,
  className = "",
}) => {
  const [batches, setBatches] = useState<TrainingBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBatches = async () => {
      try {
        setIsLoading(true);
        const data = await getTrainingBatches();
        const sortedBatches = data.sort(
          (a: TrainingBatch, b: TrainingBatch) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setBatches(sortedBatches);

        // FIX 1: Check strictly for -1 (unselected) instead of a falsy (!value) check
        if ((value === -1 || value === undefined) && sortedBatches.length > 0) {
          onChange(sortedBatches[sortedBatches.length - 1].tb_id);
        }
      } catch (err) {
        setError("Failed to fetch training batches");
        console.error("Error fetching batches:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBatches();
  }, [onChange, value]);

  if (isLoading) {
    return (
      <select
        disabled
        className={`w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none ${className}`}
      >
        <option>Loading training batches...</option>
      </select>
    );
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none ${className}`}
    >
      {/* FIX 2: Set the empty placeholder value to -1 instead of an empty string */}
      <option value={-1}>Select Training Batch</option>
      {batches.map((batch) => (
        <option key={batch.id} value={batch.tb_id}>
          {batch.name}
        </option>
      ))}
    </select>
  );
};