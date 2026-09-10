import React from "react";
import { StudentRegistrationData } from "../../types/student";
import { Option } from "../../types/form";
import { digreeOptions, domicileOptions } from "../../types/degreeAreas";
import SelectField from "../form/SelectField";
import InputField from "../form/InputField";
import CheckboxField from "../form/CheckboxField";
import TextareaField from "../form/TextareaField";

interface StudentFormFieldsProps {
  formData: StudentRegistrationData;
  handleInputChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => void;
  handleCheckboxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  hendleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  course: { course_id: number; course_name: string }[];
  center: { center_id: number; center_name: string }[];
  batches: any[];
  getTBLength: number;
  isEditMode?: boolean; // New prop to determine edit mode
}

const StudentFormFields = ({
  formData,
  handleInputChange,
  handleCheckboxChange,
  course,
  center,
  isEditMode = false, // Default to false (create mode)
}: StudentFormFieldsProps) => {
  const courseOptions: Option[] = course.map((c) => ({
    id: c.course_id,
    name: c.course_name,
  }));
  const centerOptions: Option[] = center.map((c) => ({
    id: c.center_id,
    name: c.center_name,
  }));
  /**
   * Options for a field stored as TEXT, keyed by the text itself.
   *
   * SelectField renders each option's id as its value, so a list keyed by
   * position describes a field stored as a number. District and qualification
   * are stored as words - the applicant picked them by name and the student
   * record keeps the name - so keying them by position gave a select that
   * matched nothing it was handed, showed "Please Select" over a perfectly
   * good value, and posted an index in place of the words when saved.
   *
   * The student's current value stays on the list even when it is not one of
   * the recognised ones. An unmatched select renders as "Please Select", and
   * saving from there writes that blank back - so a district spelled
   * differently in an older record must remain selectable rather than
   * quietly disappear.
   */
  const textOptions = (names: string[], current?: string): Option[] => {
    const value = String(current ?? "").trim();
    // A bare number is not an unfamiliar spelling to preserve - it is a
    // dropdown POSITION the old form stored in place of the words. Offering
    // it kept "1" and "2" selectable and saved them straight back, which is
    // why editing a student never repaired them. The server now translates
    // these at boot and on every write; here they are simply not offered.
    const keep = value && !/^\d+$/.test(value) && !names.includes(value);
    const list = keep ? [value, ...names] : names;
    return list.map((name) => ({ id: name, name }));
  };
  return (
    <>
      <InputField
        label="CNIC"
        name="std_cnic"
        type="text"
        value={formData.std_cnic}
        onChange={handleInputChange}
        required
        readOnly={false}
      />

      <InputField
        label="Full Name"
        name="user_name"
        type="text"
        value={formData.user_name}
        onChange={handleInputChange}
        required
        readOnly={false}
      />

      <InputField
        label="Father's Name"
        name="std_fathername"
        type="text"
        value={formData.std_fathername}
        onChange={handleInputChange}
        required
        readOnly={false}
      />

      <SelectField
        label="Qualification"
        name="std_qualification"
        value={formData.std_qualification}
        options={textOptions(digreeOptions, formData.std_qualification)}
        onChange={handleInputChange}
        required
      />

      <SelectField
        label="District"
        name="std_district"
        value={formData.std_district}
        options={textOptions(domicileOptions, formData.std_district)}
        onChange={handleInputChange}
        required
      />

      <InputField
        label="Email"
        name="user_email"
        type="email"
        value={formData.user_email}
        onChange={handleInputChange}
        required
        readOnly={false}
      />

      <InputField
        label="Phone"
        name="std_phone"
        type="tel"
        value={formData.std_phone}
        onChange={handleInputChange}
        required
        readOnly={false}
      />



      <div className="mb-4">
        <label className="block text-gray-700 text-sm font-bold mb-2">
          Gender
        </label>
        <div className="flex items-center">
          <input
            type="radio"
            id="male"
            name="std_gender"
            value="Male"
            checked={formData.std_gender === "Male"}
            onChange={handleInputChange}
            className="appearance-none w-3 h-3 border border-gray-300 rounded-full checked:bg-[#ffa500] checked:border-[#ffa500] focus:outline-none focus:ring-2 focus:ring-[#ffa500] focus:ring-offset-2 mr-2"
          />
          <label htmlFor="male" className="mr-4">
            Male
          </label>
          <input
            type="radio"
            id="female"
            name="std_gender"
            value="Female"
            checked={formData.std_gender === "Female"}
            onChange={handleInputChange}
            className="appearance-none w-3 h-3 border border-gray-300 rounded-full checked:bg-[#ffa500] checked:border-[#ffa500] focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2 mr-2"
          />
          <label htmlFor="female">Female</label>
        </div>
      </div>

      <SelectField
        label="Training Course"
        name="course_id"
        value={formData.course_id}
        options={courseOptions}
        onChange={handleInputChange}
        required
      />
      <SelectField
        label="Training Center"
        name="center_id"
        value={formData.center_id}
        options={centerOptions}
        onChange={handleInputChange}
        required
      />
      <CheckboxField
        label="Special Case"
        name="special_case"
        checked={formData.special_case === 1} // This ensures the checkbox is controlled
        onChange={handleCheckboxChange}
      />

      {formData.special_case && (
        <div className="col-span-1 sm:col-span-2 lg:col-span-2">
          <TextareaField
            label="Special Case Comments"
            name="special_case_comments"
            type="text"
            value={formData.special_case_comments || ""}
            onChange={handleInputChange}
            required
          />
        </div>
      )}
    </>
  );
};

export default StudentFormFields;
