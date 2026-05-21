import React from "react";
import { InputFieldProps } from "../../types/form";

const InputField: React.FC<InputFieldProps> = ({
  label,
  name,
  type,
  value,
  onChange,
  required = false,
  readOnly = false,
}) => {
  return (
    <div className="space-y-2 w-full">
      <label className="block text-gray-700 text-sm font-medium">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors duration-200"
        required={required}
      />
    </div>
  );
};

export default InputField;
