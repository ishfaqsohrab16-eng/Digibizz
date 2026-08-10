import React from "react";
import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Field, InfoNote, SelectInput, fieldGrid } from "./fields";

interface DigiBizzCenterSelectionProps {
  formData: any;
  errors: { [key: string]: string };
  handleInputChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  center: { center_id: number; center_name: string }[];
  isIttiRegistration?: boolean;
  admissionRules: Array<{
    center_id: number;
    course_id: number;
    allowed_gender: "all" | "male" | "female";
  }>;
  /** Set when the applicant arrived through a center's dedicated apply link. */
  lockedCenter?: { center_id: number; center_name: string } | null;
}

const DigiBizzCenterSelection: React.FC<DigiBizzCenterSelectionProps> = ({
  formData,
  errors,
  handleInputChange,
  center,
  admissionRules,
  lockedCenter,
}) => {
  const allowedCenterIds = new Set(admissionRules.map((rule) => Number(rule.center_id)));
  const selectedGender = String(formData.cand_gender || "").toLowerCase();

  const availableCenters = center.filter((centerItem) => {
    if (!allowedCenterIds.has(centerItem.center_id)) {
      return false;
    }
    const centerRules = admissionRules.filter(
      (rule) => Number(rule.center_id) === Number(centerItem.center_id)
    );
    if (!selectedGender) return true;
    return centerRules.some(
      (rule) => rule.allowed_gender === "all" || rule.allowed_gender === selectedGender
    );
  });

  return (
    <div>
      <InfoNote>
        <ul className="list-inside list-disc space-y-1">
          <li>Calculate the distance from your residence to nearest DigiBizz Centers.</li>
          <li>
            Domain and DigiBizz center cannot be changed at later stage. So please make your
            decision wisely.
          </li>
          <li>You must select your center according your timing availability.</li>
        </ul>
      </InfoNote>

      <div className={fieldGrid}>
        {lockedCenter ? (
          <Field label="Center" required>
            <div className="flex items-start gap-3 rounded-md border border-[#006537]/30 bg-[#006537]/5 px-3 py-3">
              <MapPin size={18} className="mt-0.5 shrink-0 text-[#006537]" />
              <div>
                <p className="text-sm font-semibold text-[#006537]">
                  {lockedCenter.center_name}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  You opened this center&apos;s dedicated apply link, so your application is
                  fixed to it.{" "}
                  <Link to="/registration" className="font-medium text-[#006537] underline">
                    Apply to a different center
                  </Link>
                </p>
              </div>
            </div>
          </Field>
        ) : (
          <Field label="Center" htmlFor="center_id" required error={errors.center_id}>
            <SelectInput
              id="center_id"
              name="center_id"
              value={formData.center_id || ""}
              onChange={handleInputChange}
              hasError={Boolean(errors.center_id)}
            >
              <option value="">Please select center</option>
              {availableCenters.map((centerItem) => (
                <option key={centerItem.center_id} value={centerItem.center_id}>
                  {centerItem.center_name}
                </option>
              ))}
            </SelectInput>
            {availableCenters.length === 0 && (
              <p className="mt-1.5 text-xs text-orange-700">
                No center is currently open for the selected gender. Please check back later.
              </p>
            )}
          </Field>
        )}

        <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
          <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
            Class timings
          </h4>
          <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
            <li>BUITEMS: 03:00 PM to 05:00 PM</li>
            <li>UoB: 03:00 PM to 05:00 PM</li>
            <li>UoL: 03:00 PM to 05:00 PM</li>
            <li>Govt Girls College: 03:00 PM to 05:00 PM</li>
            <li>ITTI Peshin Stop: 03:00 PM to 05:00 PM</li>
            <li>
              ITTI Zhob:
              <ul className="ml-4 list-inside list-disc">
                <li>Content Marketing &amp; Advertising: 11:00 AM to 1:00 PM</li>
                <li>Amazon Web &amp; e-Commerce: 3:00 PM to 5:00 PM</li>
                <li>Creative Designing: 11:00 AM to 1:00 PM</li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DigiBizzCenterSelection;
