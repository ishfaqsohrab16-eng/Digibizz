import { ReactNode } from "react";
import type { AdminType } from "./admin/base";

/**
 * Props for protected route components
 */
export interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: AdminType[];
}
