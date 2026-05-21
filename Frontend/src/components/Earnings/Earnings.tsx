import { useState } from "react";
import EarningsForm from "./EarningsForm";
import EarningsTable from "./EarningTable";

export default function Earnings() {
  const [activeForm, setActiveForm] = useState<string>("earnings");
  const [selectedEarning, setSelectedEarning] = useState<any>(null);
  const [mode, setMode] = useState<"create" | "edit" | "view">("create");

  const openForm = (formName: string) => {
    setActiveForm(formName);
  };

  return (
    <>
      {activeForm === "earnings" ? (
        <EarningsTable
          openForm={openForm}
          setMode={setMode}
          setSelectedEarning={setSelectedEarning}
        />
      ) : (
        <EarningsForm
          openForm={openForm}
          mode={mode}
          initialData={selectedEarning}
        />
      )}
    </>
  );
}
