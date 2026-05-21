import React from "react";
import { CheckboxFieldProps } from "../../types/form";

const CheckboxField: React.FC<CheckboxFieldProps> = ({
  label,
  name,
  checked,
  onChange,
  required = false,
}) => {
  return (
    <div className="flex items-center space-x-2">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 text-emerald-500 border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none transition-colors duration-200"
        required={required}
      />
      <label
        htmlFor={name}
        className="text-gray-700 text-sm font-medium cursor-pointer"
      >
        {label}
      </label>
    </div>
  );
};

export default CheckboxField;
