export interface Option {
  /**
   * Also the option's VALUE in the rendered select, which is what a form
   * posts and what has to match the stored record.
   *
   * A number for anything stored as a foreign key - a centre, a course, a
   * batch. A string for a field stored as text, such as a district or a
   * qualification: keying those by position produces a select that matches
   * nothing it is given and posts an index in place of the words.
   */
  id: number | string;
  name: string;
}

export interface SelectFieldProps {
  label: string;
  name: string;
  value: string | number;
  options: Option[];
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  required?: boolean;
}

export interface InputFieldProps {
  label: string;
  name: string;
  type: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  readOnly: boolean;
}
export interface CheckboxFieldProps {
  label: string;
  name: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}

export interface TextareaFieldProps {
  label: string;
  name: string;
  type: string;
  value: string;
  rows?: number;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  required?: boolean;
}
