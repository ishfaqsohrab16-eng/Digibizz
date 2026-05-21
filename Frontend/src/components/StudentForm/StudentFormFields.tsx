import React from "react";
import { StudentRegistrationData } from "../../types/student";
import { Option } from "../../types/form";
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
  const degreeLevels = [
    "Intermediate",
    "B.Tech (2 Years)",
    "B.Tech (3 Years)",
    "B.Tech (4 Years)",
    "Bachelors (2 Years)",
    "Bachelors (4 Years)",
    "Bachelors (5 Years)",
    "Masters",
    "MPHIL",
    "PHD",
  ];

  // Format the options with id and name
  const formattedOptions = degreeLevels.map((degree, index) => ({
    id: index + 1,
    name: degree,
    label: degree,
    value: degree,
  }));
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
        options={formattedOptions}
        onChange={handleInputChange}
        required
      />

      <SelectField
        label="District"
        name="std_district"
        value={formData.std_district}
        options={[
          { id: 2, name: "Awaran" },
          { id: 3, name: "Barkhan" },
          { id: 4, name: "Chaghi" },
          { id: 5, name: "Chaman" },
          { id: 6, name: "Dera Bugti" },
          { id: 7, name: "Duki" },
          { id: 8, name: "Gawadar" },
          { id: 9, name: "Harnai" },
          { id: 10, name: "Hub" },
          { id: 11, name: "Jafarabad" },
          { id: 12, name: "Jhal Magsi" },
          { id: 13, name: "Kachhi (Bolan)" },
          { id: 14, name: "Kallat" },
          { id: 15, name: "Karezat" },
          { id: 16, name: "Kech (Turbat)" },
          { id: 17, name: "Kharan" },
          { id: 18, name: "Khuzdar" },
          { id: 19, name: "Killa Abdullah" },
          { id: 20, name: "Killa Saifullah" },
          { id: 21, name: "Kohlu" },
          { id: 22, name: "Lasbela" },
          { id: 23, name: "Lehri" },
          { id: 24, name: "Loralai" },
          { id: 25, name: "Mastung" },
          { id: 26, name: "Musa Khel" },
          { id: 27, name: "Naseerabad" },
          { id: 28, name: "Nushki" },
          { id: 29, name: "Pishin" },
          { id: 30, name: "Punjgur" },
          { id: 31, name: "Quetta" },
          { id: 32, name: "Sheerani" },
          { id: 33, name: "Sibi" },
          { id: 34, name: "Sohbatpur" },
          { id: 35, name: "Surab" },
          { id: 36, name: "Usta Mohammad" },
          { id: 37, name: "Washuk" },
          { id: 38, name: "Zhob" },
          { id: 39, name: "Ziarat" },
        ]}
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
