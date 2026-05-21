import React from "react";

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
        (rule) => !selectedGender || rule.allowed_gender === "all" || rule.allowed_gender === selectedGender
      )
      .map((rule) => Number(rule.course_id))
  );

  return (
    <div className="p-2 rounded-md">
      <h3 className="font-semibold mb-2 text-lg text-[#006537]">
        Course Track Selection <span className="text-red-500">*</span>
      </h3>
      <div className="flex items-center justify-between">
        <select
          id="course_id"
          name="course_id"
          value={formData.course_id}
          onChange={handleInputChange}
          className="shadow appearance-none border rounded w-1/2 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        >
          <option value="">Please Select Course</option>
          {course
            .filter((course) => {
              return selectedCenterId ? allowedCourseIds.has(course.course_id) : false;
            })
            .map((course) => (
              <option key={course.course_id} value={course.course_id}>
                {course.course_full_name}
              </option>
            ))}
        </select>
        {errors.course_id && (
          <p className="text-red-500 text-xs mt-1">{errors.course_id}</p>
        )}
        <a
          href="https://digibizz.gob.pk/courses-helping-material/"
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Prepare your Interview with the{" "}
          <span className="underline">Learning Resources</span>
        </a>
      </div>
    </div>
  );
};

export default CourseTrackSelection;
