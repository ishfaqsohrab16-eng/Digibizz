import React, { useState } from "react";
import ExamAssessmentTable from "./ExamAssessmentTable";
import ExamAssessmentForm from "./ExamAssessmentForm";
import ExamAssessmentView from "./ExamAssessmentView";
import { getExamAssessmentById } from "../../services/api";
import { ExamAssessment as ExamAssessmentType } from "../../types/examAssessment";

const ExamAssessment = () => {
  const [activeForm, setActiveForm] = useState<string>("ExamAssessmentList");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<
    number | null
  >(null);
  const [assessmentData, setAssessmentData] =
    useState<ExamAssessmentType | null>(null);

  const openForm = async (formName: string) => {
    setActiveForm(formName);

    if (
      (formName === "ExamAssessmentEdit" ||
        formName === "ExamAssessmentView") &&
      selectedAssessmentId
    ) {
      try {
        const response = await getExamAssessmentById(selectedAssessmentId);
        if (response.success) {
          setAssessmentData(response.data);
        }
      } catch (error) {
        console.error("Error fetching assessment details:", error);
      }
    }
  };

  const handleBack = () => {
    setActiveForm("ExamAssessmentList");
    setSelectedAssessmentId(null);
    setAssessmentData(null);
  };

  const renderActiveForm = () => {
    switch (activeForm) {
      case "ExamAssessmentCreate":
        return (
          <ExamAssessmentForm
            mode="create"
            onSubmitSuccess={handleBack}
            onCancel={handleBack}
          />
        );
      case "ExamAssessmentEdit":
        return (
          <ExamAssessmentForm
            mode="edit"
            initialData={assessmentData}
            onSubmitSuccess={handleBack}
            onCancel={handleBack}
          />
        );
      case "ExamAssessmentView":
        return selectedAssessmentId ? (
          <ExamAssessmentView
            assessmentId={selectedAssessmentId}
            onBack={handleBack}
            onEdit={(id) => {
              setSelectedAssessmentId(id);
              openForm("ExamAssessmentEdit");
            }}
          />
        ) : (
          <div className="text-center p-8">
            No assessment selected.
            <button
              className="text-blue-600 hover:underline ml-2"
              onClick={() => openForm("ExamAssessmentList")}
            >
              Go back
            </button>
          </div>
        );
      case "ExamAssessmentMidList":
        return (
          <ExamAssessmentTable
            openForm={openForm}
            setSelectedAssessmentId={setSelectedAssessmentId}
            type="MID"
          />
        );
      case "ExamAssessmentList":
      default:
        return (
          <ExamAssessmentTable
            openForm={openForm}
            setSelectedAssessmentId={setSelectedAssessmentId}
            type="FINAL"
          />
        );
    }
  };

  return <>{renderActiveForm()}</>;
};

export default ExamAssessment;
