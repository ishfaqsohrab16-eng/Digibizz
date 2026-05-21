export const validateMasterTrainerForm = (formData: {
  user_name: string;
  user_email: string;
  user_password: string;
  mt_course_id: number;
}) => {
  const errors: Record<string, string> = {};

  if (
    !formData.user_name ||
    formData.user_name.length < 2 ||
    formData.user_name.length > 100
  ) {
    errors.user_name = "Name must be between 2 and 100 characters";
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!formData.user_email || !emailRegex.test(formData.user_email)) {
    errors.user_email = "Invalid email address";
  }

  if (!formData.user_password || formData.user_password.length < 6) {
    errors.user_password = "Password must be at least 6 characters long";
  }

  if (!/\d/.test(formData.user_password)) {
    errors.user_password =
      (errors.user_password || "") + " Password must contain a number";
  }

  if (!formData.mt_course_id) {
    errors.mt_course_id = "Course ID is required";
  }

  return errors;
};
