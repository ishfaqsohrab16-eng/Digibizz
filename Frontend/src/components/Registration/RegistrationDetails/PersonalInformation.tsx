import React, { useEffect, useState } from "react";
import { domicileOptions } from "../../../types/degreeAreas";
import { Field, SelectInput, TextInput, fieldGrid } from "./fields";

interface PersonalInformationProps {
  formData: any;
  errors: any;
  handleInputChange: (e: React.ChangeEvent<any>) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  profilePhoto: File | null;
  cnicNo: string;
  selectedCenterId: number;
  admissionRules: Array<{
    center_id: number;
    course_id: number;
    allowed_gender: "all" | "male" | "female";
  }>;
}

const PersonalInformation: React.FC<PersonalInformationProps> = ({
  formData,
  errors,
  handleInputChange,
  handleFileChange,
  profilePhoto,
  cnicNo,
  selectedCenterId,
  admissionRules,
}) => {
  const selectedCenterRules = admissionRules.filter(
    (rule) => Number(rule.center_id) === Number(selectedCenterId)
  );
  const centerAllowsOnlyMale =
    selectedCenterRules.length > 0 &&
    selectedCenterRules.every((rule) => rule.allowed_gender === "male");
  const centerAllowsOnlyFemale =
    selectedCenterRules.length > 0 &&
    selectedCenterRules.every((rule) => rule.allowed_gender === "female");

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (profilePhoto) {
      const objectUrl = URL.createObjectURL(profilePhoto);
      setPhotoPreview(objectUrl);

      return () => {
        URL.revokeObjectURL(objectUrl); // Clean up blob URL
      };
    }
    setPhotoPreview(null);
  }, [profilePhoto]);

  const genderOptions = [
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
  ];

  return (
    <div className={fieldGrid}>
      <Field label="Full name" htmlFor="cand_name" required error={errors.cand_name}>
        <TextInput
          type="text"
          id="cand_name"
          name="cand_name"
          value={formData.cand_name}
          onChange={handleInputChange}
          placeholder="Enter your full name"
          hasError={Boolean(errors.cand_name)}
        />
      </Field>

      <Field label="CNIC" htmlFor="cand_cnic" required>
        <TextInput type="text" id="cand_cnic" name="cand_cnic" value={cnicNo} readOnly />
      </Field>

      <Field label="Date of birth" htmlFor="cand_dob" required error={errors.cand_dob}>
        <TextInput
          type="date"
          id="cand_dob"
          name="cand_dob"
          value={formData.cand_dob}
          onChange={handleInputChange}
          hasError={Boolean(errors.cand_dob)}
        />
      </Field>

      <Field
        label="Father name"
        htmlFor="cand_fathername"
        required
        error={errors.cand_fathername}
      >
        <TextInput
          type="text"
          id="cand_fathername"
          name="cand_fathername"
          value={formData.cand_fathername}
          onChange={handleInputChange}
          placeholder="Enter your father's name"
          hasError={Boolean(errors.cand_fathername)}
        />
      </Field>

      <Field
        label="Local / domicile district"
        htmlFor="cand_local_domicile"
        required
        error={errors.cand_local_domicile}
      >
        <SelectInput
          id="cand_local_domicile"
          name="cand_local_domicile"
          value={formData.cand_local_domicile}
          onChange={handleInputChange}
          hasError={Boolean(errors.cand_local_domicile)}
        >
          <option value="">Please select</option>
          {domicileOptions.map((domicileOption) => (
            <option key={domicileOption} value={domicileOption}>
              {domicileOption}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label="Gender" required error={errors.cand_gender}>
        <div className="grid grid-cols-2 gap-3">
          {genderOptions.map((option) => {
            const checked = formData.cand_gender === option.value;
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 text-sm transition-colors ${
                  checked
                    ? "border-[#006537] bg-[#006537]/5 text-[#006537] font-medium"
                    : "border-gray-300 text-gray-700 hover:border-gray-400"
                }`}
              >
                <input
                  type="radio"
                  name="cand_gender"
                  value={option.value}
                  checked={checked}
                  onChange={handleInputChange}
                  className="h-3.5 w-3.5 appearance-none rounded-full border border-gray-400 checked:border-[5px] checked:border-[#006537] focus:outline-none"
                />
                {option.label}
              </label>
            );
          })}
        </div>
        {(centerAllowsOnlyMale || centerAllowsOnlyFemale) && (
          <p className="mt-2 text-xs text-orange-700">
            The selected center currently allows{" "}
            <strong>{centerAllowsOnlyMale ? "male" : "female"}</strong> candidates only.
          </p>
        )}
      </Field>

      <Field
        label="Passport size photo"
        htmlFor="cand_photo"
        required
        error={errors.profilePhoto}
        hint="JPEG or PNG, up to 2MB."
        className="md:col-span-2"
      >
        <div className="flex items-center gap-4">
          <input
            id="cand_photo"
            type="file"
            onChange={handleFileChange}
            accept="image/png, image/jpeg"
            className="block w-full cursor-pointer rounded-md border border-gray-300 bg-white text-sm text-gray-600 file:mr-4 file:cursor-pointer file:border-0 file:bg-gray-100 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
          />
          <div className="flex h-24 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-gray-300 bg-gray-50">
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <span className="px-1 text-center text-[10px] uppercase leading-tight tracking-wide text-gray-400">
                Your
                <br />
                passport
                <br />
                photo
              </span>
            )}
          </div>
        </div>
      </Field>
    </div>
  );
};

export default PersonalInformation;
