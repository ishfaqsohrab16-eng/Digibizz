import React, { useState, useEffect } from "react";
import Navbar from "./Navbar";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { BatchProvider } from "../../context/BatchContext";
import Sidebar from "../Sidebar/Sidebar";
import StudentForm from "../StudentForm/StudentForm";
import BulkImportStudents from "../StudentForm/BulkImportStudents";
import TrainerForm from "../TrainerForm/TrainerForm";
import MasterTrainerForm from "../MasterTrainerForm";
import CenterForm from "../CenterForm";
import CentersDatesForm from "../CentersDatesForm";
import TrainingBatchForm from "../TrainingBatchForm";
import CourseForm from "../CourseForm";
import StudentTable from "../StudentTable";
import EnrolledCenterTable from "../EnrolledCenterTable";
import { SettingsForm } from "../Settings/SetingsForm";
import TrainingBatchTable from "../TrainingBatchTable";
import CourseTable from "../CourseTable";
import CreateAdminForm from "../CreateAdminForm";
import EnrolledAdminTable from "../EnrolledAdminTable";
import MasterTrainerTable from "../MasterTrainerTable";
import TrainerTable from "../TrainerTable";
import TrainersCenterAllocation from "../trainersCenterAllocation";
import AssignmentForm from "../Assignment/AssignmentForm";
import AssignmentList from "../Assignment/AssignmentList";
import TrainerAttendance from "../Attendance/TrainerAttendance";
import StudentAttendance from "../Attendance/StudentAttendance";
import RegisterCenterUser from "../RegisterCenterUser";
import CenterUserDataTable from "../CenterUserDataTable";
import Earnings from "../Earnings/Earnings";
import EarningPortal from "../EarningPortal/EarningPortal";
import StudentLeave from "../Leave/StudentLeave/StudentLeave";
import TrainerLeaves from "../Leave/TrainerLeave/TrainerLeaves";
import ExamAssessment from "../ExamAssessment/ExamAssessment";
import SearchStudent from "../StudentForm/SearchStudent";
import { StudentDocs } from "../StudentForm/StudentDocs";
import { StudentFeedback } from "../StudentForm/StudentFeedback";
import { FreelancingProfile } from "../StudentForm/FreelancingProfile";
import Holidays from "../Holidays/Holidays";
import Suspend from "../StudentForm/Suspend/Suspend";
import QuizForm from "../Quiz/QuizForm";
import DailyLectureReportTable from "../DailyLectureReport/DailyLectureReportTable";
import DailyLectureReportForm from "../DailyLectureReport/DailyLectureReportForm";
import MyTrainers from "../WeeklyEvaluation/MyTrainers";
import EvaluationOverview from "../WeeklyEvaluation/EvaluationOverview";
import MyVisits from "../CenterVisit/MyVisits";
import VisitOverview from "../CenterVisit/VisitOverview";
import QuizStudentTable from "../Quiz/QuizStudentTable";
import AnnouncementList from "../Announcements/AnnouncementList";
import AttendanceHistory from "../Attendance/AttendanceHistory";
import MyAttendance from "../Attendance/MyAttendance";
import StudentAttendanceCalendar from "../Attendance/StudentAttendanceCalendar";
import StudentDashboard from "../dashboards/StudentDashboard";
import TrainerDashboard from "../dashboards/TrainerDashboard";
import AdminDashboard from "../dashboards/AdminDashboard";
import AddmissionPortal from "../AdmissionPortal/AddmitionPortel";
import { UserData } from "../../types/admin";
import Tickets from "../Tickets/Tickets";
import QuizCreation from "../Quiz/QuizCreation";
import { EarningReportForTrainer } from "../EarningPortal/EarningReportForTrainer";
import StudentFeedbackTable from "../StudentForm/StudentFeedbackTable";
import LearningResourcesTable from "../LearningResources/LearningResourcesTable";
import LectureRecordingsTable from "../LectureRecordings/LectureRecordingsTable";
import LectureRecordingForm from "../LectureRecordings/LectureRecordingForm";
import LearningResourceForm from "../LearningResources/LearningResourceForm";
import InterviewPortal from "../AdmissionPortal/InterviewPortal";
import AdmissionControlPanel from "../AdmissionPortal/AdmissionControlPanel";
import EmailCampaigns from "../EmailCampaign/EmailCampaigns";
import AiAssistantPanel from "../AiAssistant/AiAssistantPanel";
import { EMAIL_CAMPAIGNS_ENABLED } from "../../utils/features";
import MasterTrainerDashboard from "../dashboards/MasterTrainerDashboard";
import QuizResultTable from "../Quiz/QuizResultTable";
import ExamAssessmentView from "../ExamAssessment/ExamAssessmentView";
import ExamAssessmentForm from "../ExamAssessment/ExamAssessmentForm";
import ExamAssessmentTable from "../ExamAssessment/ExamAssessmentTable";
import AssignmentView from "../Assignment/AssignmentView";
import CenterUserFormTable from "../CenterUserFormTable";
import CenterUserDashboard from "../dashboards/CenterUserDashboard";
import { CourseModuleForm } from "../CourseModule/CourseModuleForm";
import { CourseModuleList } from "../CourseModule/CourseModuleList";

const ResponsiveLayout: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [userType, setUserType] = useState<string>("");
  const { activeForm = "Dashboard" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Check if the screen is mobile-sized
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 766);
    };

    // Initial check
    checkIfMobile();

    // Listen for window resize events
    window.addEventListener("resize", checkIfMobile);

    // Cleanup
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  // Toggle sidebar
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Close sidebar (used when a menu item is clicked on mobile)
  const closeSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const getCurrentSessionUserId = (): string | null => {
    // First check URL for sub-user parameter
    const urlParams = new URLSearchParams(window.location.search);
    const subUserId = urlParams.get("subuser");

    // If in a sub-user session, return that ID
    if (subUserId) {
      return subUserId;
    }

    // Otherwise return the main admin ID
    return localStorage.getItem("currentAdmin");
  };

  useEffect(() => {
    const currentUserType = getUserType();
    setUserType(currentUserType);
  }, []);

  // Check for sub-user session
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const subUserId = urlParams.get("subuser");

    if (subUserId) {
      const currentUserType = getUserType();
      setUserType(currentUserType);

      const queryParams = urlParams.toString();
      const currentPath = window.location.pathname;
      const isAtDashboardRoot = currentPath === "/dashboard";
      const isAtStudentDashboard = currentPath === "/dashboard/student";
      const isAtTrainerDashboard = currentPath === "/dashboard/trainer";

      if (isAtDashboardRoot || isAtStudentDashboard || isAtTrainerDashboard) {
        switch (currentUserType.toLowerCase()) {
          case "student":
            if (!isAtStudentDashboard) {
              window.location.href = `/dashboard/student?${queryParams}`;
            }
            break;
          case "trainer":
            if (!isAtTrainerDashboard) {
              window.location.href = `/dashboard/trainer?${queryParams}`;
            }
            break;
          default:
            if (isAtDashboardRoot) {
              // Already at dashboard, don't redirect
            } else {
              window.location.href = `/dashboard?${queryParams}`;
            }
        }
      }
    }
  }, []);

  const getUserType = (): string => {
    try {
      const userId = getCurrentSessionUserId();

      if (!userId) {
        return "UserAdmin";
      }

      const admin = localStorage.getItem(`admin${userId}`);
      if (!admin) {
        return "UserAdmin";
      }

      const parsedAdmin: UserData = JSON.parse(admin);
      return parsedAdmin?.type || "UserAdmin";
    } catch (error) {
      console.error("Error parsing admin data:", error);
      return "UserAdmin";
    }
  };

  // Function to detect if we're in a sub-user session
  const isSubUserSession = (): boolean => {
    return !!new URLSearchParams(window.location.search).get("subuser");
  };

  // Function to open a form but preserve query parameters when in sub-user session
  const openForm = (formName: string) => {
    // Check if we're in a sub-user session
    const inSubUserSession = isSubUserSession();

    if (inSubUserSession) {
      // Get current query parameters
      const urlParams = new URLSearchParams(window.location.search);

      // Set the URL directly with the window.history API to preserve query parameters
      window.history.pushState(
        {},
        "",
        `/dashboard/${formName}?${urlParams.toString()}`
      );

      // Force a re-render to reflect the new path
      window.dispatchEvent(new PopStateEvent("popstate"));
    } else {
      // Standard navigation
      navigate(`/dashboard/${formName}`);
    }
  };

  // Listen for popstate events to handle navigation
  useEffect(() => {
    const handlePopState = () => {
      // Force component update when navigation happens
      setUserType(getUserType());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Monitor location changes for navigation within the React app
  useEffect(() => {
    if (isSubUserSession()) {
      const path = location.pathname;
      const params = new URLSearchParams(location.search);

      // If we've navigated somewhere that lost our query params, restore them
      if (params.get("subuser") === null && isSubUserSession()) {
        const originalParams = new URLSearchParams(window.location.search);
        window.history.replaceState(
          {},
          "",
          `${path}?${originalParams.toString()}`
        );
      }
    }
  }, [location]);

  const getFormData = (formName: string) => {
    // Mock function to retrieve initial data for view-only mode
    return {};
  };

  const renderActiveForm = () => {
    switch (activeForm) {
      case "StudentForm":
        return <StudentForm />;
      case "TrainerForm":
        return <TrainerForm />;
      case "BulkImportStudents":
        return <BulkImportStudents />;
      case "MasterTrainerForm":
        return <MasterTrainerForm />;
      case "Center":
        return <CenterForm />;
      case "CenterDates":
        return <CentersDatesForm />;
      case "TrainingBatchForm":
        return <TrainingBatchForm />;
      case "CourseForm":
        return <CourseForm />;
      case "StudentTable":
        return <StudentTable />;
      case "CenterEnrolled":
        return <EnrolledCenterTable />;
      case "SettingForm":
        return <SettingsForm />;
      case "TrainingBatchTable":
        return <TrainingBatchTable />;
      case "CourseEnrolled":
        return <CourseTable />;
      case "CreateAdmin":
        return <CreateAdminForm />;
      case "EnrolledAdmin":
        return <EnrolledAdminTable />;
      case "MasterTrainerTable":
        return <MasterTrainerTable />;
      case "TrainerTable":
        return <TrainerTable />;
      case "trainersCenterAllocation":
        return <TrainersCenterAllocation />;
      case "AssignmentForm":
        return <AssignmentForm />;
      case "AssignmentList":
        return <AssignmentList />;
      case "TrainerAttendance":
        return <TrainerAttendance />;
      case "TakeAttendance":
        return <StudentAttendance />;
      case "RegisterCenterUser":
        return <RegisterCenterUser />;
      case "StudentLeave":
        return <StudentLeave />;
      case "CenterUserDataTable":
        return <CenterUserDataTable />;
      case "EarningsForm":
        return <Earnings />;
      case "EarningsReports":
        return <EarningPortal />;
      case "TrainerLeave":
        return <TrainerLeaves />;
      case "FinalAssessment":
        return <ExamAssessment />;
      case "StudentProfile":
        return <SearchStudent />;
      case "StudentDocs":
        return <StudentDocs />;
      case "ExamAssessmentForm":
        return <ExamAssessmentForm type="FINAL" />;
      case "MidExamAssessmentForm":
        return <ExamAssessmentForm type="MID" />;
      case "StudentFeedback":
        return <StudentFeedback />;
      case "FreelancingProfile":
        return <FreelancingProfile />;
      case "HolidaysForm":
        return <Holidays />;
      case "suspendStudent":
        return <Suspend />;
      case "myQuizzes":
        return <QuizCreation openForm={openForm} />;
      case "QuizForm":
        return <QuizForm />;
      case "dailyLectureReport":
        return <DailyLectureReportTable openForm={openForm} />;
      case "DailyLectureReportForm":
        return <DailyLectureReportForm />;
      // Two screens behind one idea. A Master Trainer sees the trainers who
      // report to them and fills reports in; an admin sees every trainer in
      // the programme and, more usefully, which reports are missing.
      case "WeeklyEvaluations":
        return <MyTrainers />;
      case "WeeklyEvaluationOverview":
        return <EvaluationOverview />;
      // The weekly centre visit. Same two audiences as the M&E report: a
      // Master Trainer sees the centres they still have to reach, an admin
      // sees which ones nobody reached.
      case "CenterVisits":
        return <MyVisits />;
      case "CenterVisitOverview":
        return <VisitOverview />;
      case "Admission Portal":
        return <AddmissionPortal />;
      case "StudentQuizTable":
        return <QuizStudentTable />;
      case "Announcements":
        return <AnnouncementList />;
      case "AttendanceHistory":
        return <AttendanceHistory />;
      case "MyAttendance":
        return <MyAttendance />;
      case "StudentAttendanceCalendar":
        return <StudentAttendanceCalendar />;
      case "userSetting":
        return <SettingsForm />;
      case "Tickets":
        return <Tickets />;
      case "student":
        return <StudentDashboard openForm={openForm} />;
      case "trainer":
        return <TrainerDashboard openForm={openForm} />;
      case "course-earnings":
        return <EarningReportForTrainer />;
      case "Student FeedBack":
        return <StudentFeedbackTable />;
      case "LearningResources":
        return <LearningResourcesTable openForm={openForm} />;
      case "LectureRecording":
        return <LectureRecordingsTable openForm={openForm} />;
      case "LectureRecordingForm":
        return <LectureRecordingForm />;
      case "LectureRecordingView":
        return <LectureRecordingForm viewOnly={true} />;
      case "LearningResourceForm":
        return <LearningResourceForm />;
      case "LearningResourceView":
        return <LearningResourceForm viewOnly={true} />;
      case "InterviewPortal":
        return <InterviewPortal />;
      case "AdmissionControl":
        return <AdmissionControlPanel />;
      // SuperAdmin only; the component and every endpoint enforce that too.
      // Currently switched off (utils/features.ts): the sidebar entry is
      // hidden, but this case still has to answer, because a bookmark or a
      // typed URL arrives here without ever touching the sidebar.
      // Super Admin only; the component and both endpoints enforce that too.
      case "AskTheData":
        return <AiAssistantPanel />;

      case "EmailCampaigns":
        return EMAIL_CAMPAIGNS_ENABLED ? (
          <EmailCampaigns />
        ) : (
          <div className="container mx-auto px-4 py-16">
            <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
              <h2 className="text-lg font-semibold text-slate-800">
                Email campaigns are turned off
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                The bulk email module is unavailable at the moment. Registration
                codes and other automatic emails are not affected.
              </p>
            </div>
          </div>
        );

      case "ExamAssessmentView":
        return;
      case "CenterUsers":
        return <CenterUserFormTable />;
      case "QuizResultTable":
        return <QuizResultTable />;
      case "ExamAssessmentMidList":
        return <ExamAssessmentTable openForm={openForm} type="MID" />;
      case "AssignmentView":
        return <AssignmentView />;
        case "CourseModule":
          return <CourseModuleList openForm={openForm} />;
        case "CourseModuleForm":
          return <CourseModuleForm  />;
      case "Dashboard":
        switch (userType) {
          case "student":
            return <StudentDashboard openForm={openForm} />;
          case "trainer":
            return <TrainerDashboard openForm={openForm} />;
          case "MasterTrainer":
            return <MasterTrainerDashboard openForm={openForm} />;
          case "Center Manager":
            return <CenterUserDashboard openForm={openForm} />;
          default:
            return <AdminDashboard openForm={openForm} />;
        }

      default:
        switch (userType) {
          case "student":
            return <StudentDashboard openForm={openForm} />;
          case "trainer":
            return <TrainerDashboard openForm={openForm} />;
          case "MasterTrainer":
            return <MasterTrainerDashboard openForm={openForm} />;
          case "Center Manager":
            return <CenterUserDashboard openForm={openForm} />;
          default:
            return <AdminDashboard openForm={openForm} />;
        }
    }
  };

  let sidebarClasses = "";
  if (!isMobile) {
    sidebarClasses = isSidebarOpen ? "ml-16" : "ml-16";
  } else {
    sidebarClasses = isSidebarOpen ? "ml-0" : "ml-0";
  }

  return (
    <BatchProvider>
      <div className="flex flex-col min-h-screen bg-background text-foreground theme-transition">
        <Navbar toggleSidebar={toggleSidebar} openForm={openForm} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            openForm={openForm}
            isOpen={isSidebarOpen}
            isMobile={isMobile}
            onClose={closeSidebar}
            onItemClick={closeSidebar}
          />
          <main
            className={`flex-1 overflow-y-auto p-4 space-y-8 transition-all duration-300 theme-transition ${sidebarClasses}`}
          >
            {renderActiveForm()}
          </main>
        </div>
      </div>
    </BatchProvider>
  );
};

export default ResponsiveLayout;
