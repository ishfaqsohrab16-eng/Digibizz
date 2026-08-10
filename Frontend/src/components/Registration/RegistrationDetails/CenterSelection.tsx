import React from "react";

interface DigiBizzCenterSelectionProps {
  formData: any;
  errors: { [key: string]: string };
  handleInputChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  center: { center_id: number; center_name: string }[];
  admissionRules: Array<{
    center_id: number;
    course_id: number;
    allowed_gender: "all" | "male" | "female";
  }>;
}

const DigiBizzCenterSelection: React.FC<DigiBizzCenterSelectionProps> = ({
  formData,
  errors,
  handleInputChange,
  center,
  admissionRules,
}) => {
  const allowedCenterIds = new Set(admissionRules.map((rule) => Number(rule.center_id)));
  const selectedGender = String(formData.cand_gender || "").toLowerCase();

  return (
    <div className="p-2 rounded-md">
      <h3 className="font-semibold mb-2 text-lg text-[#006537]">
        <div className="bg-green-700 text-white text-start pl-10 py-3 rounded-t-md">
          <h2 className="text-xl font-semibold">DigiBizz Center Selection</h2>
        </div>
      </h3>

      <div className="bg-blue-100 p-4 rounded-md mb-4">
        <ul className="list-disc list-inside text-sm">
          <li>
            Calculate the distance from your residence to nearest DigiBizz
            Centers.
          </li>
          <li>
            Domain and DigiBizz center cannot be changed at later stage. So
            please make your decision wisely.
          </li>
          <li>
            You must select your center according your timing availability.
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="center"
            className="block text-gray-700 text-sm font-bold mb-2"
          >
            Center <span className="text-red-500">*</span>
          </label>
          <select
            id="center_id"
            name="center_id"
            value={formData.center_id}
            onChange={handleInputChange}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          >
            <option value="">Please Select Center</option>
            {center
              .filter((centerItem) => {
                if (!allowedCenterIds.has(centerItem.center_id)) {
                  return false;
                }
                const centerRules = admissionRules.filter(
                  (rule) => Number(rule.center_id) === Number(centerItem.center_id)
                );
                if (!selectedGender) return true;
                return centerRules.some(
                  (rule) =>
                    rule.allowed_gender === "all" || rule.allowed_gender === selectedGender
                );
              })
              .map((centerItem) => (
                <option key={centerItem.center_id} value={centerItem.center_id}>
                  {centerItem.center_name}
                </option>
              ))}
          </select>
          {errors.center && (
            <p className="text-red-500 text-xs mt-1">{errors.center}</p>
          )}
        </div>

        <div>
          <h4 className="font-semibold mb-2 text-sm">Class Timings:</h4>
          <ul className="list-disc list-inside text-sm">
            <li>BUITEMS: 03:00 PM to 05:00 PM</li>
            <li>UoB: 03:00 PM to 05:00 PM</li>
            <li>UoL: 03:00 PM to 05:00 PM</li>
            <li>Govt Girls College: 03:00 PM to 05:00 PM</li>
            <li>ITTI Peshin Stop: 03:00 PM to 05:00 PM</li>
            <li>ITTI Zhob:</li>
            <ul className="list-disc list-inside ml-4">
              <li>Content Marketing & Advertising: 11:00 AM to 1:00 PM</li>
              <li>Amazon Web & e-Commerce: 3:00 PM to 5:00 PM</li>
              <li>Creative Designing: 11:00 AM to 1:00 PM</li>
            </ul>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DigiBizzCenterSelection;