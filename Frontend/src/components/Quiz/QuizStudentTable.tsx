import { useState, useEffect } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle,
  Clock,
  Play,
  XCircle,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

import { useBatch } from "../../context/BatchContext";
import { createQuizAttempt, getStudentQuizzes } from "../../services/api";
import QuizAttempt from "./QuizAttempt";
import {
  QuizAttemptFormData,
  TransformedQuizData,
  transformQuizData,
} from "../../types/quiz";
import { Toast } from "@radix-ui/react-toast";
import { toast } from "sonner";

// Interface for Quiz type
interface Quiz {
  quiz_id: number;
  quiz_code: string;
  quiz_title: string;
  quiz_passing_score: number;
  quiz_time_limit: number;
  quiz_attempts_limit: number;
  quiz_created_on: string;
  question_count: number;
  status: string;
  attempts: number;
}

export default function StudentDashboard() {
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [showQuizDialog, setShowQuizDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [quizAttempt, setQuizAttempt] = useState<QuizAttemptFormData | null>(
    null
  );
  const [attemptSetion, setAttemptSession] = useState<string>("");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const { user_id, latestSelectedBatch } = useBatch();

  // Add this state to store quiz data
  const [quizData, setQuizData] = useState<{
    [key: string]: TransformedQuizData;
  }>({});

  // Fetch quizzes only once and store transformed data
  const fetchQuizzes = async () => {
    try {
      const response = await getStudentQuizzes(user_id, latestSelectedBatch);
      const transformedQuizzes: { [key: string]: TransformedQuizData } = {};

      const quizzesData = response.quizzes.map((quiz: any) => {
        // Transform and store quiz data
        const questions = response.questions.filter(
          (question: any) => question.quiz_code === quiz.quiz_code
        );
        transformedQuizzes[quiz.quiz_code] = transformQuizData(quiz, questions);

        return {
          ...quiz,
          question_count: questions.length,
          attempts: quiz.attempts || 0,
          status: quiz.lastAttempt
            ? Number(quiz.lastAttempt.marks_obt) >= quiz.quiz_passing_score
              ? "Passed"
              : "Failed"
            : "Not Attempted",
        };
      });

      setQuizData(transformedQuizzes);
      setQuizzes(quizzesData);
    } catch (error) {
      console.error("Failed to fetch quizzes:", error);
      toast.error("Failed to fetch quizzes", {
        description: "Please try again later",
        icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
      });
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const handleStartQuiz = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setShowConfirmDialog(true);
  };

  // Update handleStartNow to use stored quiz data
  const handleStartNow = async () => {
    if (!selectedQuiz) return;

    const currentDate = new Date();
    const attemptData: QuizAttemptFormData = {
      quiz_code: selectedQuiz.quiz_code,
      attempt_session: currentDate.getTime().toString(),
      user_id,
      tb_id: latestSelectedBatch,
      course_id: 0, // Set appropriate value
      center_id: 0, // Set appropriate value
      marks_obt: 0,
      attempt_date: currentDate.toISOString().split("T")[0],
      attempt_start_time: currentDate.toISOString(),
      attempt_end_time: "",
      attempt_status: 1,
      transformedData: quizData[selectedQuiz.quiz_code],
    };
    const response = await createQuizAttempt(attemptData);
    if (response) {
      setQuizAttempt(attemptData);
      setAttemptSession(response.attempt.attempt_session);
      setShowConfirmDialog(false);
      setShowQuizDialog(true);
    } else {
      toast.error(response.message || "Failed to start quiz", {
        description: "Please try again later",
        icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
        duration: 3000,
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Passed":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border border-green-200 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Passed
          </Badge>
        );
      case "Failed":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border border-red-200 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Failed
          </Badge>
        );
      default:
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Not Attempted
          </Badge>
        );
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="bg-gradient-to-r from-blue-50 to-white rounded-xl shadow-md p-8 border border-gray-200">
        <div className="flex items-center mb-8">
          <div className="bg-blue-600 text-white rounded-full p-2 mr-3 shadow-md">
            <BookOpen className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">
            Available Quizzes
          </h1>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <Table>
            <TableHeader className="bg-gradient-to-r from-blue-50 to-white">
              <TableRow>
                <TableHead className="font-semibold text-gray-700">
                  Quiz Title
                </TableHead>
                <TableHead className="font-semibold text-gray-700">
                  Time Limit
                </TableHead>
                <TableHead className="font-semibold text-gray-700">
                  Attempts
                </TableHead>
                <TableHead className="font-semibold text-gray-700">
                  Passing Score
                </TableHead>
                <TableHead className="font-semibold text-gray-700">
                  Status
                </TableHead>
                <TableHead className="font-semibold text-gray-700">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quizzes.map((quiz) => (
                <TableRow
                  key={quiz.quiz_id}
                  className="border-b border-gray-200 hover:bg-blue-50 transition-colors duration-200"
                >
                  <TableCell className="font-medium text-blue-600">
                    {quiz.quiz_title}
                  </TableCell>
                  <TableCell className="flex items-center">
                    <Clock className="w-4 h-4 mr-1 text-gray-500" />
                    {quiz.quiz_time_limit} mins
                  </TableCell>
                  <TableCell>
                    <span
                      className={`${
                        quiz.attempts >= quiz.quiz_attempts_limit
                          ? "text-red-600"
                          : "text-gray-700"
                      }`}
                    >
                      {quiz.attempts} / {quiz.quiz_attempts_limit}
                    </span>
                  </TableCell>
                  <TableCell>{quiz.quiz_passing_score}%</TableCell>
                  <TableCell>{getStatusBadge(quiz.status)}</TableCell>
                  <TableCell>
                    <Button
                      onClick={() => handleStartQuiz(quiz)}
                      disabled={quiz.attempts >= quiz.quiz_attempts_limit}
                      className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md shadow-sm transition-all duration-300 hover:shadow-md transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      <Play className="w-4 h-4" />
                      Take Quiz
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-blue-700">
              <AlertCircle className="w-5 h-5" />
              Start Quiz
            </DialogTitle>
            <DialogDescription>
              You are about to start the quiz:{" "}
              <span className="font-semibold">{selectedQuiz?.quiz_title}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Card className="border border-blue-100">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium text-gray-700">
                  Quiz Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div className="flex justify-between">
                  <span className="text-gray-600">Time Limit:</span>
                  <span className="font-medium flex items-center">
                    <Clock className="w-4 h-4 mr-1 text-blue-600" />
                    {selectedQuiz?.quiz_time_limit} minutes
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Passing Score:</span>
                  <span className="font-medium">
                    {selectedQuiz?.quiz_passing_score}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Attempts:</span>
                  <span className="font-medium">
                    {selectedQuiz?.attempts} of{" "}
                    {selectedQuiz?.quiz_attempts_limit} used
                  </span>
                </div>
                <div className="pt-2 text-red-600 text-sm bg-red-50 p-2 rounded-md">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Once started, the quiz timer cannot be paused.
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowConfirmDialog(false)}
                className="border-gray-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleStartNow}
                className="bg-green-600 hover:bg-green-700 text-white transition-all duration-300 hover:shadow-md"
              >
                <Play className="w-4 h-4 mr-1" />
                Start Now
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quiz Attempt Dialog */}
      <Dialog open={showQuizDialog} onOpenChange={setShowQuizDialog}>
        <DialogContent className="max-w-5xl p-0 bg-transparent border-none shadow-none">
          {selectedQuiz && quizAttempt && (
            <QuizAttempt
              quizData={quizAttempt.transformedData!}
              attemptSession={attemptSetion}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
