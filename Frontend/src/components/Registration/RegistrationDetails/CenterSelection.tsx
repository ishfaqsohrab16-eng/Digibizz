import React from "react";

interface DigiBizzCenterSelectionProps {
  formData: any;
  errors: { [key: string]: string };
  handleInputChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  center: { center_id: number; center_name: string }[];
  fixedCenterId?: number;
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
  fixedCenterId,
  admissionRules,
}) => {
  const allowedCenterIds = new Set(admissionRules.map((rule) => Number(rule.center_id)));
  const selectedGender = String(formData.cand_gender || "").toLowerCase();
  const selectedCenterId = fixedCenterId ? Number(fixedCenterId) : undefined;
  const centerOptions = selectedCenterId
    ? center.filter((centerItem) => centerItem.center_id === selectedCenterId)
    : center;
  const isCenterLocked = Boolean(fixedCenterId);

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
            disabled={isCenterLocked}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
          >
            <option value="">Please Select Center</option>
            {centerOptions
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
          {(errors.center_id || errors.center) && (
            <p className="text-red-500 text-xs mt-1">
              {errors.center_id || errors.center}
            </p>
          )}
        </div>

        <div>
          <h4 className="font-semibold mb-2 text-sm">Class Timings:</h4>
          <ul className="list-disc list-inside text-sm">
            <li>BUITEMS: 02:00 PM to 04:00 PM</li>
            <li>UoB: 02:00 PM to 04:00 PM</li>
            <li>Girls College Quetta Cantt: 12:00 PM to 02:00 PM</li>
            <li>ITTI Pishin Stop Quetta:</li>
            <ul className="list-disc list-inside ml-4">
              <li>Digital Marketing: 11:30 AM to 01:30 PM</li>
              <li>Graphic Design: 01:00 PM to 03:00 PM</li>
              <li>Amazon & Ecoomerce: 03:00 PM to 05:00 PM</li>
            </ul>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DigiBizzCenterSelection;