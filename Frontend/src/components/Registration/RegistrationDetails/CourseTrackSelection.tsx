import React from "react";
import { ExternalLink } from "lucide-react";
import { Field, SelectInput } from "./fields";

interface CourseTrackSelectionProps {
  formData: any;
  errors: { [key: string]: string };
  handleInputChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  course: { course_id: number; course_full_name: string }[];
  admissionRules: Array<{
    center_id: number;
    course_id: number;
    allowed_gender: "all" | "male" | "female";
  }>;
}

const CourseTrackSelection: React.FC<CourseTrackSelectionProps> = ({
  formData,
  errors,
  handleInputChange,
  course,
  admissionRules,
}) => {
  const selectedCenterId = Number(formData.center_id);
  const selectedGender = String(formData.cand_gender || "").toLowerCase();
  const allowedCourseIds = new Set(
    admissionRules
      .filter((rule) => Number(rule.center_id) === selectedCenterId)
      .filter(
        (rule) =>
          !selectedGender ||
          rule.allowed_gender === "all" ||
          rule.allowed_gender === selectedGender
      )
      .map((rule) => Number(rule.course_id))
  );

  const availableCourses = course.filter((courseItem) =>
    selectedCenterId ? allowedCourseIds.has(courseItem.course_id) : false
  );

  return (
    <div className="space-y-5">
      <Field
        label="Course track"
        htmlFor="course_id"
        required
        error={errors.course_id}
        className="max-w-xl"
      >
        <SelectInput
          id="course_id"
          name="course_id"
          value={formData.course_id || ""}
          onChange={handleInputChange}
          hasError={Boolean(errors.course_id)}
        >
          <option value="">Please select course</option>
          {availableCourses.map((courseItem) => (
            <option key={courseItem.course_id} value={courseItem.course_id}>
              {courseItem.course_full_name}
            </option>
          ))}
        </SelectInput>
        {!selectedCenterId && (
          <p className="mt-1.5 text-xs text-orange-700">
            Select your center first to see the available course tracks.
          </p>
        )}
        {selectedCenterId > 0 && availableCourses.length === 0 && (
          <p className="mt-1.5 text-xs text-orange-700">
            No course track is currently open for the selected center.
          </p>
        )}
      </Field>

      <a
        href="https://digibizz.gob.pk/courses-helping-material/"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-[#006537] hover:text-[#006537]"
      >
        Prepare your interview with the Learning Resources
        <ExternalLink size={14} />
      </a>
    </div>
  );
};

export default CourseTrackSelection;
