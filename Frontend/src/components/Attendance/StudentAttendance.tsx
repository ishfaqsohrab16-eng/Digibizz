import React, { useState, useEffect } from "react";
import { Clock, LogOut, CalendarX, Save, ShieldCheck } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  getAllCourse,
  getCentersWithDates,
  getStudentAttendance,
  getStudentsProfile,
  submitStudentAttendance,
} from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import { CenterData } from "../../types/centerUser";
import { UserData } from "../../types/admin";
import { CenterWithDates } from "../../types/trainer";
import { toast } from "sonner";
import { StudentAttendanceInput } from "../../types/student";
import { set } from "date-fns";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { Calendar } from "../../components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";

interface CourseFormData {
  id: number;
  course_id: number;
  course_name: string;
  course_full_name: string;
  course_status: number;
}

interface AttendanceRecord {
  attend_status: string;
}

interface AttendanceResponse {
  attendanceRecords: any[];
  attend_status_Count_P: number;
  attend_status_Count_A: number;
  attend_status_Count_L: number;
}

interface StudentAttendanceProps {
  user_id: number;
  center_id: number;
  course_id: number;
  selectedBatchId: number;
  userType: string;
  user_profile_photo?: string;
  std_rollno?: string;
  std_cnic?: string;
  user_name?: string;
  user_username?: string;
  std_fathername?: string;
  std_gender?: string;
  std_qualification?: string;
  std_district?: string;
  user_email?: string;
  std_phone?: string;
  user_type?: string;
  t_id?: number;
  tb_id?: number;
  user_status?: number;
  dark_mode?: string;
  special_case?: string;
  special_case_comments?: string;
  course_name?: string;
  course_full_name?: string;
  course_status?: number;
  center_name?: string;
  std_added_on?: string;
  std_lms_status?: number;
  t_name?: string;
  student_cnic?: string;
  has_leave_today?: boolean;
  leave_date?: string | null;
}

const StudentAttendance = () => {
  const [students, setStudents] = useState<StudentAttendanceProps[]>([]);
  const [attendance, setAttendance] = useState<
    Record<string, AttendanceRecord>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [centerUserCenterId, setCenterUserCenterId] = useState(0);
  const [courseId, setCourseId] = useState(0);
  const [attendanceData, setAttendanceData] = useState<
    StudentAttendanceInput[]
  >([]);
  const [attendanceExist, setAttendanceExist] = useState(false);
  const [centers, setCenters] = useState<CenterWithDates[]>([]);
  const [userId, setUserId] = useState(0);
  const [date, setDate] = useState<Date>(new Date());
  const [attendanceCounts, setAttendanceCounts] = useState({
    present: 0,
    absent: 0,
    leave: 0,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [attendanceCnicMap, setAttendanceCnicMap] = useState<
    Record<string, string>
  >({});


  const { selectedBatchId, center_id, course_id, user_id, userType } =
    useBatch();

  const [courseFormData, setCourseFormData] = useState<CourseFormData[]>([]);

  const getUserType = () => {
    setLoading(true);
    const admin = localStorage.getItem(`admin${user_id}`);
    if (!admin) {
      console.log("No admin data found");
    }
    const parsedAdmin: UserData = JSON.parse(admin || "{}");
    if (parsedAdmin?.id) {
      setUserId(parsedAdmin.id);
      setCenterUserCenterId(parsedAdmin.center_id);
      setCourseId(parsedAdmin.course_id);
    }
  };

  const fetchCenterData = async () => {
    const centersData = await getCentersWithDates(selectedBatchId);
    setCenters(centersData.formattedCenters);
  };

  const fetchAttendance = async (
    centerId: number,
    courseId: number,
    formattedDate: string
  ) => {
    try {
      // Fetch fresh data if no cache or cache expired
      const attendanceData: AttendanceResponse = await getStudentAttendance(
        formattedDate,
        centerId,
        courseId,
        selectedBatchId,
        user_id
      );

      // Build a map of std_cnic to attend_status for quick lookup
      const cnicMap: Record<string, string> = {};
      attendanceData.attendanceRecords.forEach((record: any) => {
        if (record.std_cnic) {
          cnicMap[record.std_cnic] = record.attend_status;
        }
      });
      setAttendanceCnicMap(cnicMap);

      // Change this condition to check attendanceRecords length
      const attendanceExists = attendanceData.attendanceRecords.length > 0;

      // Update attendance counts
      const counts = {
        present: attendanceData.attend_status_Count_P || 0,
        absent: attendanceData.attend_status_Count_A || 0,
        leave: attendanceData.attend_status_Count_L || 0,
      };

      // Update state
      setAttendanceExist(attendanceExists);
      setAttendanceData(attendanceData.attendanceRecords);
      setAttendanceCounts(counts);
    } catch (error) {
      console.error("Error fetching attendance:", error);
      setAttendanceExist(false);
      setAttendanceData([]);
      setAttendanceCounts({ present: 0, absent: 0, leave: 0 });
    }
  };

  const fetchCourses = async () => {
    try {
      const data = await getAllCourse();
      setCourseFormData(data);
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message || "Failed to fetch courses");
      } else {
        setError("Failed to fetch courses");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStudent = async () => {
    setLoading(true);
      let todaysDate = format(date, "yyyy-MM-dd");
    try {
      let response;
      const formattedDate = format(date, "yyyy-MM-dd");

      // Create cache key for student profile data
      const profileCacheKey =
        userType === "trainer"
          ? `studentProfile_${selectedBatchId}_${centerUserCenterId}_${courseId}_${user_id}_${userType}`
          : `studentProfile_${selectedBatchId}_${centerUserCenterId}_${courseId}`;

      // // Check if we have cached student profile data
      // const cachedStudentData = localStorage.getItem(profileCacheKey);

      // if (cachedStudentData) {
      //   const parsedData = JSON.parse(cachedStudentData);
      //   // Check if cache is still valid (less than 1 day old)
      //   const cacheTime = parsedData.timestamp || 0;
      //   const now = Date.now();
      //   // Use cached data if it's less than 1 day old
      //   if (now - cacheTime < 24 * 60 * 60 * 1000) {
      //     response = { data: parsedData.data };
      //   }
      // }

      // If no valid cache, fetch fresh data
      if (!response) {
        if (userType === "trainer") {
          response = await getStudentsProfile(
          
            selectedBatchId,
            centerUserCenterId,
            courseId,
            user_id,
            userType
          );
          setCenterUserCenterId(centerUserCenterId);
          setCourseId(courseId);
        } else {
          response = await getStudentsProfile(
           
            selectedBatchId,
            centerUserCenterId,
            courseId,
          );
        }

        // Save student profile data to cache
        localStorage.setItem(
          profileCacheKey,
          JSON.stringify({
            data: response.data,
            timestamp: Date.now(),
          })
        );
      }

      const filteredStudents = response.data
        .filter(
          (student: StudentAttendanceProps) => student.std_lms_status !== 2
        )
        .sort((a: StudentAttendanceProps, b: StudentAttendanceProps) => {
          // Move students with std_lms_status === 0 to the bottom
          if (a.std_lms_status === 0 && b.std_lms_status !== 0) return 1;
          if (a.std_lms_status !== 0 && b.std_lms_status === 0) return -1;
          return 0;
        });
      setStudents(filteredStudents);
      const attendanceMap = filteredStudents.reduce(
        (acc: Record<string, { attend_status: string }>, student: any) => ({
          ...acc,
          [student.user_id]: {
            attend_status:
              (student.has_leave_today === true || student.has_leave_today === 1) && student.leave_date === todaysDate
                ? "L"
                : student.std_lms_status !== 1
                ? "A"
                : student.attend_status || "Not Set",
          },
        }),
        {}
      );

      // Use the selected date for fetching attendance
      await fetchAttendance(centerUserCenterId, courseId, formattedDate);

      setAttendance(attendanceMap);
    } catch (error) {
      console.error("Error fetching trainers:", error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred");
      }
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user_id > 0) {
      getUserType();
      fetchCenterData();
      fetchCourses();
      fetchStudent();
    }
  }, [userId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "P":
        return "bg-[#d1ecf1]";
      case "A":
        return "bg-[#fdcbcb]";
      case "L":
        return "bg-[#fff3cd]";
      default:
        return "bg-white";
    }
  };

  const handleAttendanceChange = (studentId: number, status: string) => {
    // Find the student to check if they have leave today
    const student = students.find(s => s.user_id === studentId);
    
    // If student has leave today, don't allow changing from "L" status
    if (student?.has_leave_today && status !== "L") {
      return; // Prevent changing attendance for students with approved leave
    }
    
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { attend_status: status === "Not Set" ? "A" : status },
    }));
  };

  const handleSaveAttendanceConfirm = async () => {
    const formattedDate = format(date, "yyyy-MM-dd");

    try {
      // First, validate if there are any marked attendance records
      const validAttendanceRecords = Object.entries(attendance)
        .map(([studentId, data]) => {
          // Skip if attendance is "Not Set"
          // if (data.attend_status === "Not Set") {
          //   return null;
          // }

          const student = students.find(
            (s) => s.user_id === parseInt(studentId)
          );
          if (!student) {
            console.error(`Student with ID ${studentId} not found`);
            return null;
          }
          return {
            std_cnic: student.student_cnic,
            attend_date: formattedDate,
            tb_id: selectedBatchId,
            user_id: userId,
            attend_status: data.attend_status,
          };
        })
        .filter(Boolean); // Remove null entries

      // Check if any student has "Not Set" attendance status
      

      if (validAttendanceRecords.length === 0) {
        toast.error("Please mark attendance for at least one student");
        return;
      }
      const hasUnsetAttendance = validAttendanceRecords.some(
        (record) => record?.attend_status === "Not Set"
      );

      if (hasUnsetAttendance) {
        toast.error("Please mark attendance for all students");
        return;
      }
      // Submit attendance records
      const response = await submitStudentAttendance(
        validAttendanceRecords.filter(
          (record): record is StudentAttendanceInput => record !== null
        )
      );

      if (response) {
        // Update attendance counts
        const counts = validAttendanceRecords.reduce(
          (acc, record) => {
            if (record && record.attend_status === "P") acc.present++;
            if (record && record.attend_status === "A") acc.absent++;
            if (record && record.attend_status === "L") acc.leave++;
            return acc;
          },
          { present: 0, absent: 0, leave: 0 }
        );

        setAttendanceCounts(counts);
        setAttendanceExist(true);

        // Clear cache after updating attendance
        const batchCacheKey = `trainerDashboardData_${user_id}_${selectedBatchId}`;
        const data = localStorage.getItem(batchCacheKey);
        if (data) {
          const parsedData = JSON.parse(data);
          // Check if formattedDate is today's date
          const today = format(new Date(), "yyyy-MM-dd");
          if (formattedDate === today) {
            // Update the local storage data
            parsedData.data.statistics.isAttendance = true;
            // Save the updated data back to local storage
            localStorage.setItem(batchCacheKey, JSON.stringify(parsedData));
          }
        }

        const cacheKey = `studentAttendance_${user_id}_${formattedDate}_${centerUserCenterId}_${courseId}_${selectedBatchId}`;
        localStorage.removeItem(cacheKey);

        // Also invalidate student profile cache when attendance is saved
        const profileCacheKey =
          userType === "trainer"
            ? `studentProfile_${selectedBatchId}_${centerUserCenterId}_${courseId}_${user_id}_${userType}`
            : `studentProfile_${selectedBatchId}_${centerUserCenterId}_${courseId}`;
        localStorage.removeItem(profileCacheKey);

        toast.success("Attendance saved successfully");
      }
    } catch (error) {
      console.error("Error saving attendance:", error);
      if (error instanceof Error) {
        toast.error(error.message || "Error saving attendance");
      } else {
        toast.error("An unknown error occurred while saving attendance");
      }
    }
  };

  // Add this helper function near the top of your component
  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
  };

  // Helper to get status for a student (by cnic) from attendanceCnicMap if attendance is marked
  const getStudentAttendanceStatus = (student: StudentAttendanceProps) => {
    // If student has leave today, always return "L"
    if (student.has_leave_today) {
      return "L";
    }
    
    if (
      attendanceExist &&
      student.student_cnic &&
      attendanceCnicMap[student.student_cnic]
    ) {
      return attendanceCnicMap[student.student_cnic];
    }
    // fallback to local state if not marked yet
    return attendance[student.user_id]?.attend_status;
  };

  return (
    <Card
      className="w-full"
      style={{
        background: "hsl(var(--background))",
        color: "hsl(var(--foreground))",
        border: "1px solid hsl(var(--border))",
      }}
    >
      <CardHeader>
        <div
          className="max-w-6xl mx-auto mb-8"
          style={{
            background: "hsl(var(--sidebar-bg))",
            color: "hsl(var(--sidebar-fg))",
          }}
        >
          <div
            className="flex flex-col sm:flex-row gap-4 p-4 rounded-lg shadow-sm"
            style={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
            }}
          >
            {userType !== "trainer" && (
              <>
                <select
                  className="flex-1 px-4 py-2 border rounded-md shadow-sm focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))]"
                  style={{
                    background: "hsl(var(--background))",
                    color: "hsl(var(--foreground))",
                    borderColor: "hsl(var(--border))",
                  }}
                  value={centerUserCenterId}
                  onChange={(e) =>
                    setCenterUserCenterId(parseInt(e.target.value))
                  }
                >
                  <option>Select Center</option>
                  {centers.map((center) => (
                    <option key={center.center_id} value={center.center_id}>
                      {center.center_name}
                    </option>
                  ))}
                </select>
                <select
                  className="flex-1 px-4 py-2 border rounded-md shadow-sm focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))]"
                  style={{
                    background: "hsl(var(--background))",
                    color: "hsl(var(--foreground))",
                    borderColor: "hsl(var(--border))",
                  }}
                  value={courseId}
                  onChange={(e) => setCourseId(parseInt(e.target.value))}
                >
                  <option>Select Course</option>
                  {courseFormData.map((course) => (
                    <option key={course.course_id} value={course.course_id}>
                      {course.course_full_name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                  style={{
                    background: "hsl(var(--background))",
                    color: "hsl(var(--foreground))",
                    borderColor: "hsl(var(--border))",
                  }}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0"
                align="start"
                style={{
                  background: "hsl(var(--card))",
                  color: "hsl(var(--foreground))",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(day) => day && setDate(day)}
                  disabled={
                    (date) =>
                      date > new Date() || // Disable future dates
                      isWeekend(date) // Disable weekends
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <Button
              onClick={fetchStudent}
              disabled={
                userType === "trainer"
                  ? loading
                  : !centerUserCenterId || !courseId || loading
              }
              className="bg-[hsl(var(--teal))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))] px-4"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Clock className="w-4 h-4 mr-2" />
              )}
              Fetch
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Add this section before the table */}
        {attendanceExist && (
          <div className="mb-4 flex gap-4 justify-end">
            <div
              className="px-4 py-2 rounded"
              style={{
                background: "hsl(var(--teal-light))",
                color: "hsl(var(--teal))",
              }}
            >
              Present: {attendanceCounts.present}
            </div>
            <div
              className="px-4 py-2 rounded"
              style={{
                background: "hsl(var(--pink-light))",
                color: "hsl(var(--pink))",
              }}
            >
              Absent: {attendanceCounts.absent}
            </div>
            <div
              className="px-4 py-2 rounded"
              style={{
                background: "hsl(var(--navy-light))",
                color: "hsl(var(--navy))",
              }}
            >
              Leave: {attendanceCounts.leave}
            </div>
          </div>
        )}
        <div
          className="leading-relaxed mb-6 max-h-[800px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
          style={{
            color: "hsl(var(--muted-foreground))",
            background: "hsl(var(--background))",
          }}
        >
          <table className="w-full" style={{ background: "hsl(var(--card))" }}>
            <thead>
              <tr
                className="border-b"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <th className="p-4 text-left">Student Name</th>
                <th className="p-4 text-left">Father Name</th>
                <th className="p-4 text-left">Center Name</th>
                <th className="p-4 text-left">Course Name</th>
                <th className="p-4 text-left">Attendance Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const status = getStudentAttendanceStatus(student);
                let rowBg = "hsl(var(--card))";
                if (status === "P") rowBg = "hsl(var(--teal-light))";
                else if (status === "A") rowBg = "hsl(var(--pink-light))";
                else if (status === "L") rowBg = "hsl(var(--navy-light))";
                return (
                  <tr
                    key={student.user_id}
                    className={`border-b transition-all duration-300 hover:scale-[1.02]`}
                    style={{
                      background: rowBg,
                      borderColor: "hsl(var(--border))",
                    }}
                  >
                    <td className="p-4">{student.user_name}</td>
                    <td className="p-4">{student.std_fathername}</td>
                    <td className="p-4">{student.center_name}</td>
                    <td className="p-4">{student.course_full_name}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Button
                          variant={status === "P" ? "default" : "outline"}
                          size="sm"
                          style={{
                            background:
                              status === "P"
                                ? "hsl(var(--teal))"
                                : "hsl(var(--card))",
                            color:
                              status === "P"
                                ? "hsl(var(--primary-foreground))"
                                : "hsl(var(--foreground))",
                            borderColor: "hsl(var(--border))",
                          }}
                          onClick={() =>
                            handleAttendanceChange(student.user_id, "P")
                          }
                          
                        >
                          <ShieldCheck className="w-4 h-4 mr-2" />
                          Present
                        </Button>

                        <Button
                          variant={status === "A" ? "default" : "outline"}
                          size="sm"
                          style={{
                            background:
                              status === "A"
                                ? "hsl(var(--pink))"
                                : "hsl(var(--card))",
                            color:
                              status === "A"
                                ? "hsl(var(--primary-foreground))"
                                : "hsl(var(--foreground))",
                            borderColor: "hsl(var(--border))",
                          }}
                          onClick={() =>
                            handleAttendanceChange(student.user_id, "A")
                          }
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          Absent
                        </Button>

                        <Button
                          variant={status === "L" ? "default" : "outline"}
                          size="sm"
                          style={{
                            background:
                              status === "L"
                                ? "hsl(var(--navy))"
                                : "hsl(var(--card))",
                            color:
                              status === "L"
                                ? "hsl(var(--primary-foreground))"
                                : "hsl(var(--foreground))",
                            borderColor: "hsl(var(--border))",
                          }}
                          onClick={() =>
                            handleAttendanceChange(student.user_id, "L")
                          }
                          disabled={attendanceExist}
                        >
                          <CalendarX className="w-4 h-4 mr-2" />
                          Leave
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            <AlertDialogTrigger asChild>
              <Button
                className="bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--primary))]"
                disabled={attendanceExist || loading}
              >
                <Save className="w-4 h-4 mr-2" />
                {attendanceExist
                  ? "Attendance Already Marked"
                  : "Save Attendance"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Confirm Attendance Submission
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to submit the attendance? This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSaveAttendanceConfirm}>
                  Submit
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentAttendance;
