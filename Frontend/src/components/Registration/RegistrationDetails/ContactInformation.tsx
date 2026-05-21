import React from "react";
import { CandidateFormData } from "../../../types/registration";
import { domicileOptions } from "../../../types/degreeAreas";
interface ContactInformationProps {
  formData: CandidateFormData;
  errors: { [key: string]: string };
  handleInputChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => void;
}

const ContactInformation: React.FC<ContactInformationProps> = ({
  formData,
  errors,
  handleInputChange,
}) => {
  return (
    <div className="p-2 rounded-md">
      <h3 className="font-semibold mb-2 text-lg text-[#006537]">
        <div className="bg-green-700 text-white text-start pl-10 py-3 rounded-t-md">
          <h2 className="text-xl font-semibold">Contact Information</h2>
        </div>
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="cand_email"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="cand_email"
            name="cand_email"
            value={formData.cand_email}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter your email address"
          />
          {errors.cand_email && (
            <p className="text-red-500 text-xs mt-1">{errors.cand_email}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirm_email"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Confirm Email Address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="confirm_email"
            name="confirm_email"
            value={formData.confirm_email}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Confirm your email address"
          />
          {errors.confirm_email && (
            <p className="text-red-500 text-xs mt-1">{errors.confirm_email}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="cand_phone"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Phone No. <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            id="cand_phone"
            name="cand_phone"
            value={formData.cand_phone}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter your Phone number"
          />
          {errors.cand_phone && (
            <p className="text-red-500 text-xs mt-1">{errors.cand_phone}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="confirm_phone"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Confirm Phone No. <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            id="confirm_phone"
            name="confirm_phone"
            value={formData.confirm_phone}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Confirm your mobile number"
          />
          {errors.confirm_phone && (
            <p className="text-red-500 text-xs mt-1">{errors.confirm_phone}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="current_address"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Current Address <span className="text-red-500">*</span>
          </label>
          <textarea
            id="current_address"
            name="current_address"
            value={formData.current_address}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter your current address"
          ></textarea>
          {errors.current_address && (
            <p className="text-red-500 text-xs mt-1">
              {errors.current_address}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="permanent_address"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Permanent Address <span className="text-red-500">*</span>
          </label>
          <textarea
            id="permanent_address"
            name="permanent_address"
            value={formData.permanent_address}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter your permanent address"
          ></textarea>
          {errors.permanent_address && (
            <p className="text-red-500 text-xs mt-1">
              {errors.permanent_address}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="current_city"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Current City <span className="text-red-500">*</span>
          </label>
          <select
            id="current_city"
            name="current_city"
            value={formData.current_city}
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
          {errors.current_city && (
            <p className="text-red-500 text-xs mt-1">{errors.current_city}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="permanent_city"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Permanent City <span className="text-red-500">*</span>
          </label>
          <select
            id="permanent_city"
            name="permanent_city"
            value={formData.permanent_city}
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
          {errors.permanent_city && (
            <p className="text-red-500 text-xs mt-1">{errors.permanent_city}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="cand_whatsapp"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            WhatsApp No. (For Future Communication and Alerts){" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            id="cand_whatsapp"
            name="cand_whatsapp"
            value={formData.cand_whatsapp}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter your WhatsApp number"
          />
          {errors.cand_whatsapp && (
            <p className="text-red-500 text-xs mt-1">{errors.cand_whatsapp}</p>
          )}
        </div>
        <div>
          <label
            htmlFor="guardian_whatsapp"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Guardian WhatsApp No. <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            id="guardian_whatsapp"
            name="guardian_whatsapp"
            value={formData.guardian_whatsapp}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Enter your WhatsApp number"
          />
          {errors.whatsapp && (
            <p className="text-red-500 text-xs mt-1">{errors.whatsapp}</p>
          )}
        </div>
        <div>
          <label
            htmlFor="where_find_us"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Where did you find us <span className="text-red-500">*</span>
          </label>
          <select
            id="where_find_us"
            name="where_find_us"
            value={formData.where_find_us}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          >
            <option value="">Please Select</option>
            <option value="Facebook">Facebook</option>
            <option value="Instagram">Instagram</option>
            <option value="Friend">Friend</option>
            <option value="Other">Other</option>
          </select>
          {errors.where_find_us && (
            <p className="text-red-500 text-xs mt-1">{errors.where_find_us}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactInformation;
