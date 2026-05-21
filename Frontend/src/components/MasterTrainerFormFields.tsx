import React from "react";
import { Label } from "./ui/label";
import { Input } from "./ui/input";

interface FormFieldProps {
  formData: any;
  handleInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  errors: Record<string, string>;
  course: Array<{ course_id: number; course_name: string }>;
}

export const MasterTrainerFormFields: React.FC<FormFieldProps> = ({
  formData,
  handleInputChange,
  handleFileChange,
  errors,
  course,
}) => {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="user_name">Name</Label>
        <Input
          id="user_name"
          type="text"
          name="user_name"
          value={formData.user_name}
          onChange={handleInputChange}
          className={errors.user_name ? "border-red-500" : ""}
          placeholder="Enter trainer's name"
          required
        />
        {errors.user_name && (
          <p className="text-red-500 text-sm">{errors.user_name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="user_username">Username</Label>
        <Input
          id="user_username"
          name="user_username"
          value={formData.user_username}
          onChange={handleInputChange}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="user_email">Email</Label>
        <Input
          id="user_email"
          type="email"
          name="user_email"
          value={formData.user_email}
          onChange={handleInputChange}
          className={errors.user_email ? "border-red-500" : ""}
          placeholder="Enter trainer's email"
          required
        />
        {errors.user_email && (
          <p className="text-red-500 text-sm">{errors.user_email}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="user_password">Password</Label>
        <Input
          id="user_password"
          type="password"
          name="user_password"
          value={formData.user_password}
          onChange={handleInputChange}
          className={errors.user_password ? "border-red-500" : ""}
          placeholder="Enter password"
          required
        />
        {errors.user_password && (
          <p className="text-red-500 text-sm">{errors.user_password}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile_photo">Profile Photo</Label>
        <Input
          id="profile_photo"
          type="file"
          name="profile_photo"
          onChange={handleFileChange}
          accept="image/*"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="mt_course_id">Course</Label>
        <select
          id="mt_course_id"
          name="mt_course_id"
          value={formData.mt_course_id}
          onChange={handleInputChange}
          className={`w-full p-2 border rounded ${
            errors.mt_course_id ? "border-red-500" : "border-gray-300"
          }`}
          required
        >
          <option value="">Select a course</option>
          {course.map((center) => (
            <option key={center.course_id} value={center.course_id}>
              {center.course_name}
            </option>
          ))}
        </select>
        {errors.mt_course_id && (
          <p className="text-red-500 text-sm">{errors.mt_course_id}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="user_status">Status</Label>
        <select
          id="user_status"
          name="user_status"
          value={formData.user_status}
          onChange={handleInputChange}
          className="w-full p-2 border border-gray-300 rounded"
          required
        >
          <option value={1}>Active</option>
          <option value={0}>Inactive</option>
        </select>
      </div>
    </>
  );
};
