import React from "react";
import { SelectFieldProps } from "../../types/form";

const SelectField: React.FC<SelectFieldProps> = ({
  label,
  name,
  value,
  options,
  onChange,
  disabled = false,
  required = false,
}) => {
  return (
    <div className="space-y-2 w-full">
      <label className="block text-gray-700 text-sm font-medium">{label}</label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full p-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors duration-200"
        disabled={disabled}
        required={required}
      >
        <option value="">Please Select</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SelectField;
