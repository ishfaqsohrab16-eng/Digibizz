import React, { useEffect, useState } from "react";
import { domicileOptions } from "../../../types/degreeAreas";

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
  const API_URL = import.meta.env.VITE_BACKEND_URL;
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

  return (
    <div className="p-2 rounded-md">
      <h3 className="font-semibold mb-2 text-lg text-[#006537]">
        <div className="bg-green-700 text-white text-start pl-10 py-3 rounded-t-md">
          <h2 className="text-xl font-semibold">Personal Information</h2>
        </div>
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="cand_name"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="cand_name"
            name="cand_name"
            value={formData.cand_name}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter your full name"
          />
          {errors.cand_name && (
            <p className="text-red-500 text-xs mt-1">{errors.cand_name}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="cand_cnic"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            CNIC <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="cand_cnic"
            name="cand_cnic"
            value={(formData.cand_cnic = cnicNo)}
            readOnly
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline bg-gray-100"
          />
        </div>

        <div>
          <label
            htmlFor="cand_dob"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Date of Birth <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="cand_dob"
            name="cand_dob"
            value={formData.cand_dob}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
          {errors.cand_dob && (
            <p className="text-red-500 text-xs mt-1">{errors.cand_dob}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="cand_fathername"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Father Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="cand_fathername"
            name="cand_fathername"
            value={formData.cand_fathername}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter your father's name"
          />
          {errors.cand_fathername && (
            <p className="text-red-500 text-xs mt-1">
              {errors.cand_fathername}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="cand_local_domicile"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Local / Domicile District <span className="text-red-500">*</span>
          </label>
          <select
            id="cand_local_domicile"
            name="cand_local_domicile"
            value={formData.cand_local_domicile}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          >
            <option value="">Please Select</option>
            {domicileOptions.map((domicileOption) => (
              <option key={domicileOption} value={domicileOption}>
                {domicileOption}
              </option>
            ))}
          </select>
          {errors.cand_local_domicile && (
            <p className="text-red-500 text-xs mt-1">
              {errors.cand_local_domicile}
            </p>
          )}
        </div>

        <div className="">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Gender <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center">
            <input
              type="radio"
              id="cand_gender"
              name="cand_gender"
              value="male"
              checked={formData.cand_gender === "male"}
              onChange={handleInputChange}
              className="appearance-none w-3 h-3 border border-gray-300 rounded-full checked:bg-[#ffa500] checked:border-[#ffa500] focus:outline-none focus:ring-2 focus:ring-[#ffa500] focus:ring-offset-2 mr-2"
            />
            <label htmlFor="cand_gender" className="mr-4">
              Male
            </label>
            <input
              type="radio"
              id="cand_gender"
              name="cand_gender"
              value="female"
              checked={formData.cand_gender === "female"}
              onChange={handleInputChange}
              className="appearance-none w-3 h-3 border border-gray-300 rounded-full checked:bg-[#ffa500] checked:border-[#ffa500] focus:outline-none focus:ring-2 focus:ring-pink-400 focus:ring-offset-2 mr-2"
            />
            <label htmlFor="cand_gender">Female</label>
          </div>
          {(centerAllowsOnlyMale || centerAllowsOnlyFemale) && (
            <p className="text-xs text-orange-700 mt-2">
              This selected center currently allows{" "}
              <strong>{centerAllowsOnlyMale ? "male" : "female"}</strong> candidates only.
            </p>
          )}

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Passport Size Photo <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center">
              <input
                type="file"
                onChange={handleFileChange}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                accept="image/*"
              />

              <div className="border border-gray-300 rounded ml-4 w-35 h-24 flex items-center justify-center">
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-gray-400 text-xs text-center">
                    YOUR
                    <br />
                    PASSPORT
                    <br />
                    PHOTO
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PersonalInformation;
