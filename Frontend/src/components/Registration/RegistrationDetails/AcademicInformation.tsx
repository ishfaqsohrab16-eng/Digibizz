import React from "react";
import {
  digreeOptions,
  degreeAreas,
  institutions,
} from "../../../types/degreeAreas";
interface AcademicInformationProps {
  formData: any;
  errors: any;
  handleInputChange: (e: React.ChangeEvent<any>) => void;
}

const AcademicInformation: React.FC<AcademicInformationProps> = ({
  formData,
  errors,
  handleInputChange,
}) => {
  return (
    <div className="p-2 rounded-md">
      <h3 className="font-semibold mb-2 text-lg text-[#006537]">
        <div className="bg-green-700 text-white text-start pl-10 py-3 rounded-t-md">
          <h2 className="text-xl font-semibold">Academic Information</h2>
        </div>
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="cand_degree_level"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Degree Level <span className="text-red-500">*</span>
          </label>
          <select
            id="cand_degree_level"
            name="cand_degree_level"
            value={formData.cand_degree_level}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          >
            <option value="">Please Select</option>
            {Array.from(new Set(digreeOptions)).map((degreeOption, index) => (
              <option key={`${degreeOption}-${index}`} value={degreeOption}>
                {degreeOption}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="institute"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Institute <span className="text-red-500">*</span>
          </label>
          <select
            id="institute"
            name="institute"
            value={formData.institute}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          >
            <option value="">Please Select</option>
            {Array.from(new Set(institutions)).map((institute, index) => (
              <option key={`${institute}-${index}`} value={institute}>
                {institute}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="degree_area"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Degree Area <span className="text-red-500">*</span>
          </label>
          <select
            id="degree_area"
            name="degree_area"
            value={formData.degree_area}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          >
            <option value="">Please Select</option>
            {Array.from(new Set(degreeAreas)).map((degree_area, index) => (
              <option key={`${degree_area}-${index}`} value={degree_area}>
                {degree_area}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="degree_start_date"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Start Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="degree_start_date"
            name="degree_start_date"
            value={formData.degree_start_date}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
          {errors.degree_start_date && (
            <p className="text-red-500 text-xs mt-1">
              {errors.degree_start_date}
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="degree_end_date"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            End Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="degree_end_date"
            name="degree_end_date"
            value={formData.degree_end_date}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
          {errors.degree_end_date && (
            <p className="text-red-500 text-xs mt-1">
              {errors.degree_end_date}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcademicInformation;
