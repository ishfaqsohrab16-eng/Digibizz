import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faDollar } from "@fortawesome/free-solid-svg-icons";
import { NavItem } from "../NavItem";
import { SubNavItem } from "../SubNavItem";
import { useBatch } from "../../../context/BatchContext";

interface AssessmentNavProps {
  openForm: (formName: string) => void;
  activeSubmenu: string | null;
  onSubmenuClick: (menuName: string) => void;
  createNavUrl: (path: string) => string;
}

export const AssessmentNav = ({
  openForm,
  activeSubmenu,
  onSubmenuClick,
  createNavUrl,
}: AssessmentNavProps) => {
  const { userType, center_id } = useBatch();
  const [isAssessmentOpen, setIsAssessmentOpen] = useState(false);
  const isAssessmentSubmenuOpen = activeSubmenu === "Assessment";
  const isEarningsReportsSubmenuOpen = activeSubmenu === "Earnings Reports";

  return (
    <>
      {(userType === "SuperAdmin" ||
        userType === "ContentAdmin" ||
        userType === "MasterTrainer" ||
        userType === "trainer") && (
        <div className="relative">
          {(userType === "SuperAdmin" ||
            userType === "ContentAdmin" ||
            userType === "MasterTrainer") && (
            <>
              <NavItem
                icon={<FontAwesomeIcon icon={faStar} />}
                label="Assessment"
                hasSubmenu
                isOpen={isAssessmentSubmenuOpen}
                onClick={() => onSubmenuClick("Assessment")}
                href={createNavUrl("/dashboard/Assessment")}
              />
              {isAssessmentSubmenuOpen && (
                <div className="mt-1 space-y-1 flex flex-col">
                  <SubNavItem
                    label="Final Assessment Result"
                    isParentOpen={isAssessmentSubmenuOpen}
                    onClick={() => openForm("FinalAssessment")}
                    href={createNavUrl("/dashboard/FinalAssessment")}
                  />
                  <SubNavItem
                    label="Exam Assessment Form"
                    isParentOpen={isAssessmentSubmenuOpen}
                    onClick={() => openForm("ExamAssessmentForm")}
                    href={createNavUrl("/dashboard/ExamAssessmentForm")}
                  />
                  <SubNavItem
                    label="MID Assessment Results"
                    isParentOpen={isAssessmentSubmenuOpen}
                    onClick={() => openForm("ExamAssessmentMidList")}
                    href={createNavUrl("/dashboard/ExamAssessmentMidList")}
                  />
                  <SubNavItem
                    label="Mid Exam Assessment Form"
                    isParentOpen={isAssessmentSubmenuOpen}
                    onClick={() => openForm("MidExamAssessmentForm")}
                    href={createNavUrl("/dashboard/MidExamAssessmentForm")}
                  />
                </div>
              )}
            </>
          )}

          {(userType === "SuperAdmin" ||
            userType === "ContentAdmin" ||
            userType === "MasterTrainer" || center_id ===3) && (
            <>
              <NavItem
                icon={<FontAwesomeIcon icon={faDollar} />}
                label="Earnings Reports"
                isOpen={isEarningsReportsSubmenuOpen}
                onClick={() => {
                  onSubmenuClick("Earnings Reports");
                  openForm("EarningsReports");
                }}
                href={createNavUrl("/dashboard/EarningsReports")}
              />
              {userType !== "trainer" && (
              <NavItem
                icon={<FontAwesomeIcon icon={faDollar} />}
                label="Student FeedBack"
                isOpen={isEarningsReportsSubmenuOpen}
                onClick={() => {
                  onSubmenuClick("Student FeedBack");
                  openForm("Student FeedBack");
                }}
                href={createNavUrl("/dashboard/Student FeedBack")}
              />
              )}
            </>
          )}
        </div>
      )}
    </>
  );
};
