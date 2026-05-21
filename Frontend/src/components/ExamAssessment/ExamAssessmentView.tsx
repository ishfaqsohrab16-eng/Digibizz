import React, { useState, useEffect } from "react";
import { getExamAssessmentById } from "../../services/api";
import { ExamAssessmentWithRelations } from "../../types/examAssessment";
import SettingsHeader from "../../components/Settings/SettingsHeader";
import { Button } from "../../components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";

interface ExamAssessmentViewProps {
  assessmentId: number;
  onBack: () => void;
  onEdit: (id: number) => void;
}

const ExamAssessmentView: React.FC<ExamAssessmentViewProps> = ({
  assessmentId,
  onBack,
  onEdit,
}) => {
  const [assessment, setAssessment] =
    useState<ExamAssessmentWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchAssessmentDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getExamAssessmentById(assessmentId);

        if (response.success) {
          setAssessment(response.data);
        } else {
          setError("Failed to fetch assessment details");
        }
      } catch (err) {
        console.error("Error fetching assessment details:", err);
        setError("An error occurred while fetching assessment data");
      } finally {
        setLoading(false);
      }
    };

    if (assessmentId) {
      fetchAssessmentDetails();
    }
  }, [assessmentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-md">
        <SettingsHeader
          SettingsHeader="Error"
          SettingDescription={error || "Assessment not found"}
        />
        <Button onClick={onBack} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <SettingsHeader
        SettingsHeader={`${assessment.ea_type} Exam Assessment`}
        SettingDescription={`Assessment ID: ${assessment.ea_id}`}
      />

      <div className="flex justify-start mb-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to List
        </Button>
        <Button
          variant="default"
          className="ml-4 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => onEdit(assessment.ea_id)}
        >
          Edit Assessment
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Student Information</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Student CNIC:</span>
                <span className="font-medium">{assessment.std_cnic}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Batch:</span>
                <span className="font-medium">
                  {assessment.training_batches?.tb_name || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Center:</span>
                <span className="font-medium">
                  {assessment.centers?.center_name || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Course:</span>
                <span className="font-medium">
                  {assessment.courses?.course_name || "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Exam Type:</span>
                <span className="font-medium">{assessment.ea_type}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Assessment Scores</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Class Participation:</span>
                <span className="font-medium">
                  {assessment.class_participation} / 25
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Final Task:</span>
                <span className="font-medium">
                  {assessment.final_task} / 25
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Presentation:</span>
                <span className="font-medium">
                  {assessment.presentation} / 25
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Viva:</span>
                <span className="font-medium">{assessment.viva} / 25</span>
              </div>
              <div className="flex justify-between border-t pt-2 mt-2">
                <span className="text-gray-700 font-medium">Total Score:</span>
                <span className="text-xl font-semibold text-green-600">
                  {assessment.total_score} / 100
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {assessment.remarks && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4">Remarks</h3>
            <p className="text-gray-700 whitespace-pre-wrap">
              {assessment.remarks}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-gray-500 mt-8">
        <div className="flex justify-between">
          <span>Assessment ID: {assessment.ea_id}</span>
          <span>
            Created: {new Date(assessment.createdAt || "").toLocaleString()}
            {assessment.updatedAt !== assessment.createdAt && (
              <>
                {" "}
                | Updated:{" "}
                {new Date(assessment.updatedAt || "").toLocaleString()}
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ExamAssessmentView;
