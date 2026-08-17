import React, { useEffect, useState, useCallback } from "react";
import { getStudentsProfile, loginAsSubUser } from "../services/api";
import { DataTable } from "./AdmissionPortal/DataTable";
import { Column, FilterBy, StudentStatus } from "../types/columns";
import {
  DEFAULT_FILTER_BY_Student_Status,
  DEFAULT_STUDENT_COLUMNS,
  DEFAULT_STUDENT_COLUMNS_Admin,
} from "../utils/tableUtils";
import SettingsHeader from "./Settings/SettingsHeader";
import { useBatch } from "../context/BatchContext";
import StudentForm from "./StudentForm/StudentForm";
import StudentProfile from "./StudentForm/StudentProfile";
import { StudentRegistrationData } from "../types/student";
import { StudentData } from "./StudentForm/StudentProfile"; // Import StudentData for profile
import DeleteStudentDialog from "./StudentForm/DeleteStudentDialog";
import { isRole, ROLE } from "../utils/roles";
import { toast } from "sonner";

const StudentTable = () => {
  const [students, setStudents] = useState<StudentData[]>([]); // Use StudentData for table data
  const [columns, setColumns] = useState<Column[]>(DEFAULT_STUDENT_COLUMNS);
  const [adminsColumns, setAdminsColumns] = useState<Column[]>(
    DEFAULT_STUDENT_COLUMNS_Admin
  );
  const [filterStatus, setFilterStatus] = useState<StudentStatus>("all");
  const {
    selectedBatchId,
    center_id,
    course_id,
    userType,
    user_id,
    studentStatus,
  } = useBatch();
  const [filterBy, setFilterBy] = useState<FilterBy[]>(
    DEFAULT_FILTER_BY_Student_Status
  );
  const [loading, setLoading] = useState(false);
  const [selectedStudentForProfile, setSelectedStudentForProfile] =
    useState<StudentData | null>(null); // For StudentProfile
  const [selectedStudentForForm, setSelectedStudentForForm] =
    useState<StudentRegistrationData | null>(null); // For StudentForm
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<StudentData | null>(null);

  // Permanently deleting a student is SuperAdmin-only. The server enforces
  // this as well - this only decides whether the button does anything.
  const canDeleteStudents = isRole(userType, ROLE.SUPER_ADMIN);

  const handleDeleteRequest = (item: StudentData) => {
    if (!canDeleteStudents) {
      toast.error("Only a Super Admin can delete a student");
      return;
    }
    setStudentToDelete(item);
  };
  const [isProfileVisible, setIsProfileVisible] = useState(false);
  // Add a refreshTrigger state to force re-fetching data
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isMounted, setIsMounted] = useState(true);

  // Helper function to get LMS status label
  const getLmsStatusLabel = (lmsStatus: number, rollNo: string) => {
    if (lmsStatus === 1) {
      return "Active In LMS";
    } else if (lmsStatus === 0 || rollNo === "") {
      return "Not Joined LMS";
    } else if (lmsStatus === 2) {
      return "Suspended";
    } else {
      return "Unknown";
    }
  };

  // This function determines if a student is considered suspended
  const isStudentSuspended = (student: any): boolean => {
    return student.std_lms_status === "Suspended";
  };

  // This function determines if a student is considered inactive
  const isStudentInactive = (student: any): boolean => {
    return (
      student.std_lms_status === "Not Joined LMS" && student.std_rollno === ""
    );
  };

  // Convert fetchTrainingBatchesWithDates to useCallback to prevent unnecessary re-renders
  const fetchTrainingBatchesWithDates = useCallback(async () => {
    // Return early if the component is unmounted
    if (!isMounted) return;

    try {
      setLoading(true);

      // Create cache key based on relevant parameters - include studentStatus in the key
      // const cacheKey = `studentsProfile_${selectedBatchId}_${center_id}_${course_id}_${user_id}_${userType}`;

      // // Check if we have cached data and if refreshTrigger is not causing a forced refresh
      // if (refreshTrigger === 0) {
      //   const cachedData = localStorage.getItem(cacheKey);
      //   if (cachedData) {
      //     const parsedData = JSON.parse(cachedData);
      //     // Check if cache is still valid (less than 10 minutes old)
      //     const cacheTime = parsedData.timestamp || 0;
      //     const now = Date.now();
      //     // Use cached data if it's less than 10 minutes old
      //     if (
      //       now - cacheTime < 10 * 60 * 1000 &&
      //       Array.isArray(parsedData.students)
      //     ) {
      //       // Apply filter to cached data based on studentStatus
      //       let filteredCachedData = parsedData.students;

      //       if (studentStatus !== undefined && studentStatus !== null) {
      //         filteredCachedData = filteredCachedData.filter((student: any) => {
      //           // If studentStatus is 0, show only inactive students
      //           if (studentStatus === 0) {
      //             return (
      //               student.std_lms_status === "Not Joined LMS" &&
      //               (student.std_rollno === "" || student.std_rollno === null)
      //             );
      //           }

      //           // For status 1 (Active in LMS)
      //           if (studentStatus === 1) {
      //             return (
      //               student.std_lms_status === "Active In LMS" &&
      //               student.user_status === "Active"
      //             );
      //           }

      //           // For status 2 (Suspended)
      //           if (studentStatus === 2) {
      //             return student.std_lms_status === "Suspended";
      //           }

      //           // For status 3 (Not Joined LMS)
      //           if (studentStatus === 3) {
      //             return student.std_lms_status === "Not Joined LMS";
      //           }

      //           // Default - show all
      //           return true;
      //         });
      //       }

      //       setStudents(filteredCachedData);
      //       setLoading(false);
      //       return;
      //     }
      //   }
      // }

      // Only make API call if component is still mounted
      if (isMounted) {
        const StudentsData = await getStudentsProfile(
          selectedBatchId,
          center_id,
          course_id,
          user_id,
          userType
        );

        // Only update state if component is still mounted
        if (isMounted && Array.isArray(StudentsData.data)) {
          console.log("Fetched Students Data:", StudentsData.data);
          const updatedStudents = StudentsData.data.map((student: any) => ({
            user_id: student.user_id,
            user_name: student.user_name,
            user_username: student.user_username,
            user_email: student.user_email,
            user_type: student.user_type,
            user_status: student.user_status === 1 ? "Active" : "In Active",
            user_profile_photo: student.user_profile_photo,
            std_id: student.std_id || 0,
            course_id: student.course_id,
            course_name: student.course_name,
            course_full_name: student.course_full_name,
            course_status: student.course_status || 0,
            std_added_on: student.std_added_on,
            center_name: student.center_name,
            std_cnic: student.std_cnic,
            center_id: student.center_id,
            std_gender: student.std_gender || "Male",
            std_qualification: student.std_qualification || "",
            std_district: student.std_district || "",
            std_phone: student.std_phone || "",
            std_fathername: student.std_fathername || "",
            special_case: (student.special_case === "0" || student.special_case === "OFF") ? "NO" : "YES",
            std_lms_status: getLmsStatusLabel(
              student.std_lms_status,
              student.std_rollno || ""
            ),
            std_forum_status: student.std_forum_status || 0,
            std_rollno: student.std_rollno,
            student_cnic: student.std_cnic,
            // Include additional properties like assignments, tickets, etc.
            assignments: student.assignments,
            tickets: student.tickets,
            feedback: student.feedback,
            documents: student.documents,
            professionalProfiles: student.professionalProfiles,
            tb_name: student.t_name,
            earnings: student.earnings || 0, // Include earnings if available
            attendanceProgress: `${parseFloat(
              student.attendanceProgress
            ).toFixed(2)} %`,
          }));

          // Filter students based on studentStatus if it's set
          let filteredStudents = updatedStudents;
          if (studentStatus !== undefined && studentStatus !== null) {
            filteredStudents = updatedStudents.filter((student: any) => {
              // If studentStatus is 0, show only inactive students
              if (studentStatus === 0) {
                return isStudentInactive(student);
              }

              // For status 1 (Active in LMS)
              if (studentStatus === 1) {
                return (
                  student.std_lms_status === "Active In LMS" &&
                  student.user_status === "Active"
                );
              }

              // For status 2 (Suspended)
              if (studentStatus === 2) {
                return isStudentSuspended(student);
              }

              // For status 3 (Not Joined LMS)
              if (studentStatus === 3) {
                return student.std_lms_status === "Not Joined LMS";
              }

              // Default - show all
              return true;
            });
          }

          // Only set state if component is still mounted
          if (isMounted) {
            console.log("Fetched Students Data:", filteredStudents);
            setStudents(filteredStudents);
          }
        }
      }
    } catch (error) {
      // Only log errors if component is still mounted
      if (isMounted) {
        console.error("Error fetching student data:", error);
      }
    } finally {
      // Only update loading state if component is still mounted
      if (isMounted) {
        setLoading(false);
      }
    }
  }, [
    selectedBatchId,
    center_id,
    course_id,
    user_id,
    userType,
    studentStatus,
    refreshTrigger,
    isMounted,
  ]);

  const handleView = (student: StudentData) => {
    setSelectedStudentForProfile(student);
    setIsProfileVisible(true); // Show StudentProfile
  };

  const handleEdit = (student: StudentData) => {
    // Map StudentData to StudentRegistrationData for the form
    const mappedStudent: StudentRegistrationData = {
      std_rollno: student.std_rollno,
      std_cnic: student.std_cnic,
      user_name: student.user_name,
      user_username: student.user_username,
      std_fathername: student.std_fathername,
      std_gender: student.std_gender,
      std_qualification: student.std_qualification,
      std_district: student.std_district,
      user_email: student.user_email,
      std_phone: student.std_phone,
      user_password: "", // Placeholder for security
      confirm_password: "", // Placeholder for security
      user_type: student.user_type,
      user_status: student.user_status,
      course_id: student.course_id,
      center_id: student.center_id,
      t_id: 0, // Placeholder value
      tb_id: selectedBatchId,
      dark_mode: "0", // Placeholder value
      special_case: 0, // Placeholder value
      special_case_comments: "", // Placeholder value,
      earnings: student.earnings || 0, // Include earnings if available
    };
    setSelectedStudentForForm(mappedStudent);
    setIsFormVisible(true); // Show StudentForm
  };

  const handleFormClose = () => {
    setIsFormVisible(false);
    setSelectedStudentForForm(null);

    // Trigger a refresh of the data when the form is closed
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleProfileClose = () => {
    setIsProfileVisible(false);
    setSelectedStudentForProfile(null);

    // Also refresh when returning from profile view in case of edits there
    setRefreshTrigger((prev) => prev + 1);
  };

  const LoginAsstudent = async (student: StudentData) => {
    // Open a blank window synchronously to avoid popup blockers in Safari
    const win = window.open("about:blank", "_blank");
    try {
      const login = await loginAsSubUser(student.user_id);
      if (login.success) {
        // Generate a unique query parameter to ensure a fresh session
        const timestamp = new Date().getTime();
        const loginUrl = `/dashboard?subuser=${student.user_id}&t=${timestamp}`;
        if (win) {
          win.location.href = loginUrl;
        }
      } else {
        if (win) {
          win.close();
        }
        console.error("Login failed");
      }
    } catch (error) {
      if (win) {
        win.close();
      }
      console.error("Error during login:", error);
    }
  };

  useEffect(() => {
    // Set mounted flag to true when component mounts
    setIsMounted(true);

    // Cleanup function to prevent state updates after unmounting
    return () => {
      setIsMounted(false);
    };
  }, []);

  useEffect(() => {
    // Only fetch data if component is mounted
    if (isMounted && selectedBatchId >= 0) {
      fetchTrainingBatchesWithDates();
    }
  }, [
    fetchTrainingBatchesWithDates,
    selectedBatchId,
    refreshTrigger,
    studentStatus,
  ]);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {isProfileVisible ? (
        <StudentProfile
          studentData={selectedStudentForProfile}
          onClose={handleProfileClose}
        />
      ) : isFormVisible ? (
        <StudentForm
          initialData={selectedStudentForForm}
          onClose={handleFormClose}
        />
      ) : (
        <>
          <SettingsHeader
            SettingsHeader="Enrolled Student"
            SettingDescription="Enrolled Student Data"
          />
          {userType === "trainer" ? (
            <DataTable
              data={students}
              columns={columns}
              filterStatus={filterStatus}
              setColumns={setColumns}
              isActionBtn={true}
              onView={handleView}
              photo="user_profile_photo"
              isLoading={loading}
            />
          ) : (
            <DataTable
              data={students}
              columns={adminsColumns}
              filterStatus={filterStatus}
              setColumns={setAdminsColumns}
              isActionBtn={true}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={canDeleteStudents ? handleDeleteRequest : undefined}
              onEmail={(item) => {}}
              onLogin={(item) => LoginAsstudent(item)}
              photo="user_profile_photo"
              isLoading={loading}
              logInAsSubUser="Login As Student"
            />
          )}
        </>
      )}

      <DeleteStudentDialog
        student={studentToDelete}
        onClose={() => setStudentToDelete(null)}
        onDeleted={() => fetchTrainingBatchesWithDates()}
      />
    </div>
  );
};

export default StudentTable;
