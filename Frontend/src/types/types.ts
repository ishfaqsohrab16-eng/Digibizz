import { FormEvent } from "react";
export interface AdminProfile {
  user_id: number;
  user_name: string;
  user_username: string;
  profile_photo: string | null;
  uaer_type:
    | "SuperAdmin"
    | "ContentAdmin"
    | "ReadOnlyAdmin"
    | "MasterTrainer"
    | "Trainer"
    | "Student"
    | "Coordinator"
    | "Manager";
  dark_mode: 0 | 1;
  admin_status: 0 | 1;
}

export interface PasswordFormProps {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  setCurrentPassword: (value: string) => void;
  setNewPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
}
