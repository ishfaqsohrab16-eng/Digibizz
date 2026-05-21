import { useEffect, useState } from "react";
import StudentLeaveTable from "./StudentLeaveTable";
import StudentLeaveForm from "./StudentLeaveForm";
import ViewStudentLeave from "./ViewStudentLeave";
import { StudentLeaveFormDataToView } from "../../../types/leave";

export default function StudentLeave() {
  const [activeForm, setActiveForm] = useState<string>("leaveTable");
  const [viewStudentLeave, setViewStudentLeave] = useState<
    StudentLeaveFormDataToView[]
  >([]);
  const openForm = (formName: string) => {
    setActiveForm(formName);
  };

  useEffect(() => {}, [activeForm]);
  const renderForm = () => {
    switch (activeForm) {
      case "leaveTable":
        return (
          <StudentLeaveTable
            openForm={openForm}
            setViewStudentLeave={setViewStudentLeave}
          />
        );
      case "ViewStudentLeave":
        return <ViewStudentLeave viewStudentLeave={viewStudentLeave} />;
      case "StudentLeaveForm":
        return <StudentLeaveForm openForm={openForm} />;
      default:
        return (
          <StudentLeaveTable
            openForm={openForm}
            setViewStudentLeave={setViewStudentLeave}
          />
        );
    }
  };

  return (
    <div className="bg-[hsl(var(--background))] min-h-screen">
      {renderForm()}
    </div>
  );
}
