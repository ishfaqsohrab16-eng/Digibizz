import React from "react";
import { ChevronDown } from "lucide-react";

export const BRAND_GREEN = "#006537";

export const fieldGrid = "grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5";

const baseControl =
  "w-full rounded-md border bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 " +
  "transition-colors focus:outline-none focus:border-[#006537] focus:ring-2 focus:ring-[#006537]/15 " +
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500";

const borderFor = (hasError?: boolean) =>
  hasError ? "border-red-400" : "border-gray-300";

interface FieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({
  label,
  htmlFor,
  required,
  error,
  hint,
  className = "",
  children,
}) => (
  <div className={className}>
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-600"
    >
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint && !error && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
    {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
  </div>
);

type TextInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
};

export const TextInput: React.FC<TextInputProps> = ({
  hasError,
  className = "",
  ...props
}) => (
  <input
    {...props}
    className={`${baseControl} ${borderFor(hasError)} ${className}`}
  />
);

type SelectInputProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  hasError?: boolean;
};

export const SelectInput: React.FC<SelectInputProps> = ({
  hasError,
  className = "",
  children,
  ...props
}) => (
  <div className="relative">
    <select
      {...props}
      className={`${baseControl} ${borderFor(hasError)} appearance-none pr-9 ${className}`}
    >
      {children}
    </select>
    <ChevronDown
      size={16}
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
    />
  </div>
);

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  hasError?: boolean;
};

export const TextareaInput: React.FC<TextareaProps> = ({
  hasError,
  className = "",
  ...props
}) => (
  <textarea
    {...props}
    className={`${baseControl} ${borderFor(hasError)} min-h-[90px] resize-y ${className}`}
  />
);

/** Light blue guidance box reused by the steps that already had one. */
export const InfoNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-6 rounded-md border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
    {children}
  </div>
);
