import React from "react";
import { PasswordFormProps } from "../../types/types";


const PasswordForm = ({
  currentPassword,
  newPassword,
  confirmPassword,
  setCurrentPassword,
  setNewPassword,
  setConfirmPassword,
  onSubmit,
}: PasswordFormProps) => {
  return (
    <form onSubmit={onSubmit} className="flex-1">
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Current Password</label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full border rounded-md p-2"
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-700 mb-2">New Password</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full border rounded-md p-2"
        />
      </div>

      <div className="mb-6">
        <label className="block text-gray-700 mb-2">Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full border rounded-md p-2"
        />
      </div>

      <button
        type="submit"
        className="w-full bg-emerald-500 text-white py-2 rounded-md hover:bg-emerald-600"
      >
        Submit
      </button>
    </form>
  );
};

export default PasswordForm;
