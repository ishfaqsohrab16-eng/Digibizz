import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faCalendar,
  faTicket,
  faFileLines,
  faVolumeHigh,
  faBook,
  faCalendarDays,
  faShieldHalved,
} from "@fortawesome/free-solid-svg-icons";
import { NavItem } from "../NavItem";
import { SubNavItem } from "../SubNavItem";
import { useBatch } from "../../../context/BatchContext";

interface ClassroomNavProps {
  openForm: (formName: string) => void;
  activeSubmenu: string | null;
  onSubmenuClick: (menuName: string) => void;
  createNavUrl: (path: string) => string;
}

export const ClassroomNav = ({
  openForm,
  activeSubmenu,
  onSubmenuClick,
  createNavUrl,
}: ClassroomNavProps) => {
  const [isTrainerOpen, setIsTrainerOpen] = useState(false);
  const [isMasterTrainerOpen, setIsMasterTrainerOpen] = useState(false);
  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false);
  const [isStudentsOpen, setIsStudentsOpen] = useState(false);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [isCourseOpen, setIsCourseOpen] = useState(false);
  const { userType } = useBatch();
  const isMasterTrainerSubmenuOpen = activeSubmenu === "MasterTrainer";
  const isTrainerSubmenuOpen = activeSubmenu === "Trainer";
  const isAssignmentSubmenuOpen = activeSubmenu === "Assignment";
  const isStudentsSubmenuOpen = activeSubmenu === "Students";
  const isAttendanceSubmenuOpen = activeSubmenu === "Attendance";
  const isCourseSubmenuOpen = activeSubmenu === "Course";
  const isSettingsSubmenuOpen = activeSubmenu === "Settings";

  return (
    <>
      {userType !== "Student" && userType !== "Center Manager" && (
        <div className="relative">
          <NavItem
            icon={<FontAwesomeIcon icon={faCalendarDays} />}
            label="Attendance"
            hasSubmenu
            isOpen={isAttendanceSubmenuOpen}
            onClick={() => onSubmenuClick("Attendance")}
          />
          {isAttendanceSubmenuOpen && (
            <div className="mt-1 space-y-1 flex flex-col">
              <SubNavItem
                label="Take Attendance"
                isParentOpen={isAttendanceSubmenuOpen}
                onClick={() => openForm("TakeAttendance")}
                href={createNavUrl("/dashboard/TakeAttendance")}
              />
              <SubNavItem
                label="AttendanceHistory"
                isParentOpen={isAttendanceSubmenuOpen}
                onClick={() => openForm("AttendanceHistory")}
                href={createNavUrl("/dashboard/AttendanceHistory")}
              />
            </div>
          )}
        </div>
      )}
      {(userType === "SuperAdmin" ||
        userType === "trainer" ||
        userType === "student") && (
        <div className="relative">
          <NavItem
            icon={<FontAwesomeIcon icon={faUser} />}
            label="Assignment"
            hasSubmenu
            isOpen={isAssignmentSubmenuOpen}
            onClick={() => onSubmenuClick("Assignment")}
          />
          {isAssignmentSubmenuOpen && (
            <div className="mt-1 space-y-1 flex flex-col">
              {(userType === "SuperAdmin" || userType === "trainer") && (
                <SubNavItem
                  label="Post Assignment"
                  isParentOpen={isAssignmentSubmenuOpen}
                  onClick={() => openForm("AssignmentForm")}
                  href={createNavUrl("/dashboard/AssignmentForm")}
                />
              )}
              <SubNavItem
                label="Assignment List"
                isParentOpen={isAssignmentSubmenuOpen}
                onClick={() => openForm("AssignmentList")}
                href={createNavUrl("/dashboard/AssignmentList")}
              />
            </div>
          )}
        </div>
      )}
      {userType === "SuperAdmin" && (
        <div className="relative">
          <NavItem
            icon={<FontAwesomeIcon icon={faUser} />}
            label="Master Trainer"
            hasSubmenu
            isOpen={isMasterTrainerSubmenuOpen}
            onClick={() => {
              onSubmenuClick("MasterTrainer");
            }}
          />
          {isMasterTrainerSubmenuOpen && (
            <div className="mt-1 space-y-1 flex flex-col">
              <SubNavItem
                label="Add New Master Trainer"
                isParentOpen={isMasterTrainerSubmenuOpen}
                onClick={() => openForm("MasterTrainerForm")}
                href={createNavUrl("/dashboard/MasterTrainerForm")}
              />
              <SubNavItem
                label="Enrolled Master Trainer"
                isParentOpen={isMasterTrainerSubmenuOpen}
                onClick={() => openForm("MasterTrainerTable")}
                href={createNavUrl("/dashboard/MasterTrainerTable")}
              />
            </div>
          )}
        </div>
      )}
      {(userType === "SuperAdmin" ||
        userType === "ContentAdmin" ||
        userType === "Center Manager" ||
        userType === "MasterTrainer") && (
        <div className="relative">
          <NavItem
            icon={<FontAwesomeIcon icon={faUser} />}
            label="Trainer"
            hasSubmenu
            isOpen={isTrainerSubmenuOpen}
            onClick={() => onSubmenuClick("Trainer")}
          />

          {isTrainerSubmenuOpen && (
            <div className="mt-1 space-y-1 flex flex-col">
              {userType === "SuperAdmin" && (
                <SubNavItem
                  label="Add New Trainer"
                  isParentOpen={isTrainerSubmenuOpen}
                  onClick={() => openForm("TrainerForm")}
                  href={createNavUrl("/dashboard/TrainerForm")}
                />
              )}
              <SubNavItem
                label="Trainers"
                isParentOpen={isTrainerSubmenuOpen}
                onClick={() => openForm("TrainerTable")}
                href={createNavUrl("/dashboard/TrainerTable")}
              />
              {userType === "SuperAdmin" && (
                <SubNavItem
                  label="Trainers Center Allocation"
                  isParentOpen={isTrainerSubmenuOpen}
                  onClick={() => openForm("trainersCenterAllocation")}
                  href={createNavUrl("/dashboard/trainersCenterAllocation")}
                />
              )}
              {(userType === "SuperAdmin" || userType === "ContentAdmin") && (
                <SubNavItem
                  label="Trainer Attendance"
                  isParentOpen={isTrainerSubmenuOpen}
                  onClick={() => openForm("TrainerAttendance")}
                  href={createNavUrl("/dashboard/TrainerAttendance")}
                />
              )}
              {userType !== "Center Manager" && (
                <SubNavItem
                  label="Leave Applications"
                  isParentOpen={isTrainerSubmenuOpen}
                  onClick={() => openForm("TrainerLeave")}
                  href={createNavUrl("/dashboard/TrainerLeave")}
                />
              )}
            </div>
          )}
        </div>
      )}
      {userType === "trainer" && (
        <NavItem
          icon={<FontAwesomeIcon icon={faCalendar} />}
          label="My Leave Applications"
          onClick={() => openForm("TrainerLeave")}
          href={createNavUrl("/dashboard/TrainerLeave")}
        />
      )}
      {userType === "SuperAdmin" && (
        <div className="relative">
          <NavItem
            icon={<FontAwesomeIcon icon={faBook} />}
            label="Course"
            hasSubmenu
            isOpen={isCourseSubmenuOpen}
            onClick={() => onSubmenuClick("Course")}
          />

          {isCourseSubmenuOpen && (
            <div className="mt-1 space-y-1 flex flex-col">
              <SubNavItem
                label="Create Course"
                isParentOpen={isCourseSubmenuOpen}
                onClick={() => openForm("CourseForm")}
                href={createNavUrl("/dashboard/CourseForm")}
              />
              <SubNavItem
                label="Enrolled Course"
                isParentOpen={isCourseSubmenuOpen}
                onClick={() => openForm("CourseEnrolled")}
                href={createNavUrl("/dashboard/CourseEnrolled")}
              />
              <SubNavItem
                label="Course Module Form"
                isParentOpen={isCourseSubmenuOpen}
                onClick={() => openForm("CourseModule")}
                href={createNavUrl("/dashboard/CourseModule")}
              />
            </div>
          )}
        </div>
      )}
      {userType !== "Center Manager" && (
        <>
          <NavItem
            icon={<FontAwesomeIcon icon={faShieldHalved} />}
            label="Learning Resource"
            onClick={() => openForm("LearningResources")}
            href={createNavUrl("/dashboard/LearningResources")}
            hasSubmenu
          />
          <NavItem
            icon={<FontAwesomeIcon icon={faShieldHalved} />}
            label="Lecture Recording"
            onClick={() => openForm("LectureRecording")}
            href={createNavUrl("/dashboard/LectureRecording")}
            hasSubmenu
          />
        </>
      )}
      {userType === "trainer" && (
        <NavItem
          icon={<FontAwesomeIcon icon={faShieldHalved} />}
          label="Quizzes"
          onClick={() => openForm("myQuizzes")}
          href={createNavUrl("/dashboard/myQuizzes")}
          hasSubmenu
        />
      )}

      <div className="relative">
        <NavItem
          icon={<FontAwesomeIcon icon={faUser} />}
          label="Students"
          hasSubmenu
          isOpen={isStudentsSubmenuOpen}
          onClick={() => onSubmenuClick("Students")}
        />
        {isStudentsSubmenuOpen && (
          <div className="mt-1 space-y-1 flex flex-col">
            {userType !== "Student" && (
              <>
                <SubNavItem
                  label="Enrolled Students"
                  isParentOpen={isStudentsSubmenuOpen}
                  onClick={() => openForm("StudentTable")}
                  href={createNavUrl("/dashboard/StudentTable")}
                />
                {userType !== "Center Manager" && (
                  <>
                    <SubNavItem
                      label="Search a Student"
                      isParentOpen={isStudentsSubmenuOpen}
                      onClick={() => openForm("StudentProfile")}
                      href={createNavUrl("/dashboard/StudentProfile")}
                    />
                    {(userType !== "trainer" && userType !== "MasterTrainer") && (
                      <>
                        <SubNavItem
                          label="Add New Student"
                          isParentOpen={isStudentsSubmenuOpen}
                          onClick={() => openForm("StudentForm")}
                          href={createNavUrl("/dashboard/StudentForm")}
                        />
                        <SubNavItem
                          label="Bulk Import Students"
                          isParentOpen={isStudentsSubmenuOpen}
                          onClick={() => openForm("BulkImportStudents")}
                          href={createNavUrl("/dashboard/BulkImportStudents")}
                        />
                      </>
                    )}

                    <SubNavItem
                      label="Suspension"
                      isParentOpen={isStudentsSubmenuOpen}
                      onClick={() => openForm("suspendStudent")}
                      href={createNavUrl("/dashboard/suspendStudent")}
                    />
                    <SubNavItem
                      label="Leave Applications"
                      isParentOpen={isStudentsSubmenuOpen}
                      onClick={() => openForm("StudentLeave")}
                      href={createNavUrl("/dashboard/StudentLeave")}
                    />
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {(userType === "SuperAdmin" || userType === "ContentAdmin") && (
        <NavItem
          icon={<FontAwesomeIcon icon={faFileLines} />}
          label="Settings"
          onClick={() => onSubmenuClick("Settings")}
          href={createNavUrl("/dashboard/Settings")}
          hasSubmenu
        />
      )}
      {isSettingsSubmenuOpen && (
        <div className="mt-1 space-y-1 flex flex-col">
          <SubNavItem
            label="Manage Holidays"
            isParentOpen={isSettingsSubmenuOpen}
            onClick={() => openForm("HolidaysForm")}
            href={createNavUrl("/dashboard/HolidaysForm")}
          />
        </div>
      )}
    </>
  );
};
