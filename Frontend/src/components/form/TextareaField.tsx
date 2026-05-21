import React from "react";
import { TextareaFieldProps } from "../../types/form";

const TextareaField: React.FC<TextareaFieldProps> = ({
  label,
  name,
  value,
  type = "text",
  rows = 4,
  onChange,
  required = false,
}) => {
  return (
    <div className="space-y-2 w-full">
      <label className="block text-gray-700 text-sm font-medium">{label}</label>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors duration-200"
        required={required}
      />
    </div>
  );
};

export default TextareaField;
