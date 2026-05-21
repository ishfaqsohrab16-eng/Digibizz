import { useState, useEffect } from "react";
import {
  useQuery,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { format } from "date-fns";
import { PlusCircle, Eye, Pencil, Trash2, FileText, List } from "lucide-react";
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
import { useBatch } from "../../context/BatchContext";
import { getTeacherQuizzes, deleteQuiz, getStudentQuizResultList } from "../../services/api";
import SettingsHeader from "../Settings/SettingsHeader";
import { toast } from "sonner";

// Create a client
const queryClient = new QueryClient();

// Add interface for Quiz type
interface Quiz {
  quiz_id: number;
  quiz_code: string;
  quiz_title: string;
  quiz_passing_score: number;
  quiz_time_limit: number;
  quiz_attempts_limit: number;
  quiz_created_on: string;
  question_count: number;
  questionCount: number;
  studentQuizQuestions?: any; // Add optional property for studentQuizQuestions
}

function QuizTrainerTableContent({
  openForm,
}: {
  openForm: (formName: string, data?: any) => void;
}) {
  const [openQuizForm, setOpenQuizForm] = useState(false);
  const { user_id, latestSelectedBatch } = useBatch();

  // Clear local storage variables on component mount
  useEffect(() => {
    localStorage.removeItem("selectedQuiz");
    localStorage.removeItem("isViewMode");
    localStorage.removeItem("isEditMode");
  }, []);

  const {
    data: quizzes,
    isLoading,
    error,
  } = useQuery<Quiz[]>({
    queryKey: ["quizzes", user_id],
    queryFn: async () => {
      const response = await getTeacherQuizzes(user_id, latestSelectedBatch);
      // Ensure we always return an array
      return Array.isArray(response)
        ? response.map((quiz) => ({
            ...quiz,
            question_count: quiz.question_count || quiz.questionCount || 0,
            questionCount: quiz.question_count || quiz.questionCount || 0,
          }))
        : [];
    },
  });

  const handleOpenResultsList = async (quiz_code: string) => {
    try {
      const results = await getStudentQuizResultList(quiz_code);
      if (results && results.results && results.results.length > 0) {
        localStorage.setItem("selectedQuizResult", JSON.stringify(results));
        openForm("QuizResultTable");
      } else {
        toast.error("No quiz results found or failed to load quiz results.");
      }
    } catch (error) {
      console.error("Error fetching quiz results:", error);
      toast.error("Failed to load quiz results. Please try again later.");
    }
  };

  const handleViewQuiz = (quiz: Quiz) => {
    // Save quiz data to local storage
    localStorage.setItem("selectedQuiz", JSON.stringify(quiz));
    localStorage.setItem("isViewMode", "true"); // Store boolean as a string
    openForm("QuizForm");
  };

  const handleEditQuiz = (quiz: Quiz) => {
    // Save quiz data to local storage
    localStorage.setItem("selectedQuiz", JSON.stringify(quiz));
    localStorage.setItem("isEditMode", "true"); // Store boolean as a string
    openForm("QuizForm");
  };

  const handleDeleteQuiz = async (quizCode: string) => {
    if (window.confirm("Are you sure you want to delete this quiz?")) {
      try {
        const response = await deleteQuiz(quizCode);
        if (response.success) {
          queryClient.invalidateQueries({ queryKey: ["quizzes"] });
          toast.success("Quiz deleted successfully.");
        } else {
          toast.error(response.message || "Failed to delete quiz.");
        }
      } catch (error: any) {
        console.error("Failed to delete quiz:", error);
        toast.error(
          error.response?.data?.message ||
            "Failed to delete quiz. Please try again later."
        );
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600">
        Failed to load quizzes. Please try again later.
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <SettingsHeader
        SettingsHeader="Quiz Manager"
        SettingDescription="Create and manage your quizzes to assess student learning. Set questions, time limits, and passing criteria to evaluate student performance."
      />
      <div className="bg-gradient-to-r from-blue-50 to-white rounded-xl shadow-md p-8 border border-gray-200">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center">
            <div className="bg-blue-600 text-white rounded-full p-2 mr-3 shadow-md">
              <FileText className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">My Quizzes</h1>
          </div>

          <Button
            onClick={() => openForm("QuizForm")}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md transition-all duration-300 hover:shadow-lg transform hover:scale-105 active:scale-95"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Add Quiz</span>
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="font-semibold text-gray-700">
                  Title
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
                  Questions
                </TableHead>
                <TableHead className="font-semibold text-gray-700">
                  Created on
                </TableHead>
                <TableHead className="font-semibold text-gray-700">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.isArray(quizzes) && quizzes.length > 0 ? (
                quizzes.map((quiz) => (
                  <TableRow
                    key={quiz.quiz_id}
                    className="border-b border-gray-200 hover:bg-blue-50 transition-colors duration-200"
                  >
                    <TableCell className="font-medium text-blue-600 hover:text-blue-800 transition-colors">
                      <a href="#">{quiz.quiz_title}</a>
                    </TableCell>
                    <TableCell>{quiz.quiz_time_limit} mins</TableCell>
                    <TableCell>{quiz.quiz_attempts_limit}</TableCell>
                    <TableCell>{quiz.quiz_passing_score}%</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {quiz.question_count || quiz.questionCount || 0}{" "}
                        Questions
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(quiz.quiz_created_on), "dd-MM-yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          onClick={() => handleViewQuiz(quiz)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 text-green-600 hover:text-green-800 hover:bg-green-50"
                          onClick={() => handleEditQuiz(quiz)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                          onClick={() => handleDeleteQuiz(quiz.quiz_code)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50"
                          onClick={() => handleOpenResultsList(quiz.quiz_code)}
                        >
                          <List className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-gray-500"
                  >
                    No quizzes found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// Wrapper component that provides QueryClient
export default function QuizTrainerTable(props: {
  openForm: (formName: string, data?: any) => void;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <QuizTrainerTableContent openForm={props.openForm} />
    </QueryClientProvider>
  );
}
