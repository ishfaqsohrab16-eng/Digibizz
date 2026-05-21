import { useEffect, useState } from "react";
import { TrainersLeaveFormData } from "../../../types/leave";
import TrainerLeaveTable from "./TrainerLeaveTable";
import ViewTrainerLeave from "./ViewTrainerLeave";
import TrainerLeaveForm from "./TrainersLeaveForm";

export default function TrainerLeaves() {
  const [activeForm, setActiveForm] = useState<string>("leaveTable");
  const [viewTrainerLeave, setViewTrainerLeave] = useState<
    TrainersLeaveFormData[]
  >([]);
  const openForm = (formName: string) => {
    setActiveForm(formName);
  };

  useEffect(() => {}, [activeForm]);
  const renderForm = () => {
    switch (activeForm) {
      case "leaveTable":
        return (
          <TrainerLeaveTable
            openForm={openForm}
            setViewTrainerLeave={setViewTrainerLeave}
          />
        );
      case "ViewTrainerLeave":
        return <ViewTrainerLeave viewTrainerLeave={viewTrainerLeave} />;
      case "TrainerLeaveForm":
        return <TrainerLeaveForm openForm={openForm} />;
      default:
        return (
          <TrainerLeaveTable
            openForm={openForm}
            setViewTrainerLeave={setViewTrainerLeave}
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
