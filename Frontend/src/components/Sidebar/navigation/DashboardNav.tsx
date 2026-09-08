import {
  Home,
  MessageSquare,
  FileText,
  Volume2,
  User,
  MessageCircle,
  MessageCircleQuestion,
  Video,
  BookCopy,
  AlignStartHorizontal,
  School,
  Receipt,
  ShieldQuestion,
  TicketIcon,
  BookOpen,
  Mail,
  Sparkles,
  ClipboardCheck,
  MapPinned,
} from "lucide-react";
import { NavItem } from "../NavItem";
import { useEffect, useState } from "react";
import { SubNavItem } from "../SubNavItem";
import { useBatch } from "../../../context/BatchContext";
import { isRole, ROLE } from "../../../utils/roles";
import { EMAIL_CAMPAIGNS_ENABLED } from "../../../utils/features";

interface DashboardNavProps {
  openForm: (formName: string) => void;
  activeSubmenu: string | null;
  onSubmenuClick: (menuName: string) => void;
  createNavUrl: (path: string) => string;
}
interface UserData {
  id: number;
  name: string;
  username: string;
  type: string;
}

export const DashboardNav = ({
  openForm,
  activeSubmenu,
  onSubmenuClick,
  createNavUrl,
}: DashboardNavProps) => {
  const [isTrainingBatchFormOpen, setIsTrainingBatchFormOpen] = useState(false);
  const [isCenterUserFormOpen, setIsCenterUserFormOpen] = useState(false);
  const { userType, user_id, selectedBatchId } = useBatch();
  const isTrainingBatchOpen = activeSubmenu === "trainingBatch";
  const isCenterUserOpen = activeSubmenu === "centerUser";
  return (
    <>
      <>
        {userType === "SuperAdmin" || userType === "ContentAdmin" ? (
          <NavItem
            icon={<Home size={20} />}
            label="Dashboard"
            onClick={() => openForm("")}
            href={createNavUrl("/dashboard")}
            isPermanentBorder
          />
        ) : userType === "trainer" ? (
          <NavItem
            icon={<Home size={20} />}
            label="Trainer Dashboard"
            onClick={() => openForm("trainer")}
            href={createNavUrl("/dashboard/trainer")}
            isPermanentBorder
          />
        ) : userType === "student" ? (
          <NavItem
            icon={<Home size={20} />}
            label="Student Dashboard"
            onClick={() => openForm("student")}
            href={createNavUrl("/dashboard/student")}
            isPermanentBorder
          />
        ) : userType === "trainer" ? (
          <NavItem
            icon={<Home size={20} />}
            label="Trainer Dashboard"
            onClick={() => openForm("trainer")}
            href={createNavUrl("/dashboard/trainer")}
            isPermanentBorder
          />
        ) : userType === "MasterTrainer" ? (
          <NavItem
            icon={<Home size={20} />}
            label="MT Dashboard"
            onClick={() => openForm("masterTrainer")}
            href={createNavUrl("/dashboard/masterTrainer")}
            isPermanentBorder
          />
        ) : (
          <NavItem
            icon={<Home size={20} />}
            label="Dashboard"
            onClick={() => openForm("")}
            href={createNavUrl("/dashboard")}
            isPermanentBorder
          />
        )}

        {/* <NavItem
          icon={<MessageCircle size={20} />}
          label="FORUM"
          onClick={() => openForm("FORUM")}
          isPermanentBorder
        /> */}
      </>
      {userType === "SuperAdmin" && (
        <>
          <div className="relative">
            <NavItem
              icon={<User size={20} />}
              label="Training Batch"
              hasSubmenu
              isOpen={isTrainingBatchOpen}
              onClick={() => onSubmenuClick("trainingBatch")}
            />
            {isTrainingBatchOpen && (
              <div className="mt-1 space-y-1 flex flex-col">
                <SubNavItem
                  label="Add New Training Batch"
                  isParentOpen={isTrainingBatchOpen}
                  onClick={() => openForm("TrainingBatchForm")}
                  href={createNavUrl("/dashboard/TrainingBatchForm")}
                />
                <SubNavItem
                  label="Enrolled Training Batch"
                  isParentOpen={isTrainingBatchOpen}
                  onClick={() => openForm("TrainingBatchTable")}
                  href={createNavUrl("/dashboard/TrainingBatchTable")}
                />
              </div>
            )}
          </div>
        </>
      )}
      {(userType === "SuperAdmin" || userType === "ContentAdmin") && (
        <>
          <NavItem
            icon={<FileText size={20} />}
            label="Admission Portal"
            onClick={() => openForm("Admission Portal")}
            href={createNavUrl("/dashboard/Admission Portal")}
            isPermanentBorder
          />
          <NavItem
            icon={<ShieldQuestion size={20} />}
            label="Admission Control"
            onClick={() => openForm("AdmissionControl")}
            href={createNavUrl("/dashboard/AdmissionControl")}
            isPermanentBorder
          />
        </>
      )}
      {/* Sits with the other admissions screens because that is where it is
          used, but stays SuperAdmin-only - the block above also admits
          ContentAdmin, who must not be able to mail applicants.
          Currently switched off; see utils/features.ts. */}
      {/* Answers across every centre, batch and student with no scoping by
          role, so it is Super Admin only. The endpoints enforce the same. */}
      {isRole(userType, ROLE.SUPER_ADMIN) && (
        <NavItem
          icon={<Sparkles size={20} />}
          label="Ask the Data"
          onClick={() => openForm("AskTheData")}
          href={createNavUrl("/dashboard/AskTheData")}
          isPermanentBorder
        />
      )}
      {EMAIL_CAMPAIGNS_ENABLED && isRole(userType, ROLE.SUPER_ADMIN) && (
        <NavItem
          icon={<Mail size={20} />}
          label="Email Campaigns"
          onClick={() => openForm("EmailCampaigns")}
          href={createNavUrl("/dashboard/EmailCampaigns")}
          isPermanentBorder
        />
      )}
      {userType !== "Center Manager" && (
        <NavItem
          icon={<Volume2 size={20} />}
          label="Announcements"
          onClick={() => openForm("Announcements")}
          href={createNavUrl("/dashboard/Announcements")}
        />
      )}
      {userType !== "student" && userType !== "Center Manager" && (
        <NavItem
          icon={<TicketIcon size={20} />}
          label="Support Tickets"
          onClick={() => openForm("Tickets")}
          href={createNavUrl("/dashboard/Tickets")}
        />
      )}

      {/* The weekly M&E report on trainer performance.
          Two audiences, one entry: a Master Trainer opens their own trainers
          and fills reports in; an admin opens every trainer in the programme
          and sees which reports are missing. The trainer being evaluated is
          not offered it at all - it is an assessment written about them. */}
      {(userType === "SuperAdmin" ||
        userType === "ContentAdmin" ||
        userType === "ReadOnlyAdmin" ||
        userType === "MasterTrainer") && (
        <NavItem
          icon={<ClipboardCheck size={20} />}
          label="Weekly M&E Reports"
          onClick={() =>
            openForm(
              userType === "MasterTrainer" ? "WeeklyEvaluations" : "WeeklyEvaluationOverview"
            )
          }
          href={createNavUrl(
            userType === "MasterTrainer"
              ? "/dashboard/WeeklyEvaluations"
              : "/dashboard/WeeklyEvaluationOverview"
          )}
        />
      )}

      {/* The weekly centre visit. A Master Trainer opens the centres they
          have to reach; an admin opens every centre and sees which were
          missed. Trainers are not offered it - they are what is being
          visited. */}
      {(userType === "SuperAdmin" ||
        userType === "ContentAdmin" ||
        userType === "ReadOnlyAdmin" ||
        userType === "MasterTrainer") && (
        <NavItem
          icon={<MapPinned size={20} />}
          label="Centre Visits"
          onClick={() =>
            openForm(userType === "MasterTrainer" ? "CenterVisits" : "CenterVisitOverview")
          }
          href={createNavUrl(
            userType === "MasterTrainer"
              ? "/dashboard/CenterVisits"
              : "/dashboard/CenterVisitOverview"
          )}
        />
      )}

      {(userType === "SuperAdmin" ||
        userType === "ContentAdmin" ||
        userType === "MasterTrainer" ||
        userType === "trainer") && (
        <>
          <NavItem
            icon={<MessageCircle size={20} />}
            label="Daily Lecture Report"
            onClick={() => openForm("dailyLectureReport")}
            href={createNavUrl("/dashboard/dailyLectureReport")}
            hasSubmenu
          />
          <NavItem
            icon={<MessageCircle size={20} />}
            label={userType === "MasterTrainer" ? "Earnings" : "Batch Earnings"}
            onClick={() =>
              openForm(userType === "MasterTrainer" ? "EarningsReports" : "course-earnings")
            }
            href={createNavUrl(
              userType === "MasterTrainer"
                ? "/dashboard/EarningsReports"
                : "/dashboard/course-earnings"
            )}
            hasSubmenu
          />
        </>
      )}
      <NavItem
       icon={<BookOpen size={20} />}
            label="Course Modules"
            onClick={() => openForm("CourseModule")}
            href={createNavUrl("/dashboard/CourseModule")}
            />

      {userType === "student" && (
        <>
          {/* Always show Documents option for students */}
          <NavItem
            icon={<BookCopy size={20} />}
            label="Documents"
            onClick={() => openForm("StudentDocs")}
            href={createNavUrl("/dashboard/StudentDocs")}
            hasSubmenu
          />
          
          {/* Show all navigation items for students */}
          <NavItem
            icon={<ShieldQuestion size={20} />}
            label="My Leaves"
            onClick={() => openForm("StudentLeave")}
            href={createNavUrl("/dashboard/StudentLeave")}
            hasSubmenu
          />
          <div className="text-sm text-gray-400 mt-6 mb-2">Class Room</div>
          <NavItem
            icon={<ShieldQuestion size={20} />}
            label="My Quizzes"
            onClick={() => openForm("StudentQuizTable")}
            href={createNavUrl("/dashboard/StudentQuizTable")}
            hasSubmenu
          />
          <NavItem
            icon={<School size={20} />}
            label="My Assignments"
            onClick={() => openForm("AssignmentList")}
            href={createNavUrl("/dashboard/AssignmentList")}
            hasSubmenu
          />
          <NavItem
            icon={<Receipt size={20} />}
            label="My Earnings"
            onClick={() => openForm("EarningsForm")}
            href={createNavUrl("/dashboard/EarningsForm")}
            hasSubmenu
          />
          <NavItem
            icon={<TicketIcon size={20} />}
            label="Student Ticket"
            onClick={() => openForm("Tickets")}
            href={createNavUrl("/dashboard/Tickets")}
            hasSubmenu
          />
          <NavItem
            icon={<Video size={20} />}
            label="Recorded Lectures"
            onClick={() => openForm("LectureRecording")}
            href={createNavUrl("/dashboard/LectureRecording")}
            hasSubmenu
          />
          <NavItem
            icon={<BookCopy size={20} />}
            label="Learning Resources"
            onClick={() => openForm("LearningResources")}
            href={createNavUrl("/dashboard/LearningResources")}
            hasSubmenu
          />
          <NavItem
            icon={<AlignStartHorizontal size={20} />}
            label="Weekly Feedback"
            onClick={() => openForm("StudentFeedback")}
            href={createNavUrl("/dashboard/StudentFeedback")}
            hasSubmenu
          />
          <NavItem
            icon={<School size={20} />}
            label="LMS Tutorials"
            onClick={() =>
              window.open(
                "https://digibizz.gob.pk/courses-helping-material/",
                "_blank"
              )
            }
            href="https://digibizz.gob.pk/courses-helping-material/"
            hasSubmenu
          />
          <NavItem
            icon={<MessageCircleQuestion size={20} />}
            label="FAQ's"
            onClick={() => openForm("faq")}
            href={createNavUrl("/dashboard/faq")}
            hasSubmenu
          />
        </>
      )}
      {(userType === "trainer" || userType === "MasterTrainer") && (
        <>
          <NavItem
            icon={<MessageCircleQuestion size={20} />}
            label="Interview Portal"
            onClick={() => openForm("InterviewPortal")}
            href={createNavUrl("/dashboard/InterviewPortal")}
          />
        </>
      )}
    </>
  );
};
