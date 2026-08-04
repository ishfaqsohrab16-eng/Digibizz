import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "../../components/ui/progress";
import { Button } from "../../components/ui/button";
import { quizData } from "./quizData";
import Logo from "../../assets/logo.png";
import { useNavigate } from "react-router-dom";
import {
  getCandidateProfileByCnic,
  getTrainingBatches,
  updateCandidateTestScore,
} from "../../services/api";
import { UpdateCandidateTestScoreType } from "../../types/registration";
interface RegistrationDetailsProps {
  candName: string;
  handleNext: (test: number, name?: string) => void;
  cnicNo: string;
}
const QuizInterface: React.FC<RegistrationDetailsProps> = ({
  candName,
  handleNext,
  cnicNo,
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(quizData.totalTime);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [isQuizComplete, setIsQuizComplete] = useState(false);
  const [cand_id, setCand_id] = useState(0);
  const [candidate, setCandidate] = useState({
    candName: "",
    tb_id: 0,
    cand_id: 0,
  });
  const [updatedCandidateScore, setUpdatedCandidateScore] =
    useState<UpdateCandidateTestScoreType>({
      cand_id: 0,
      cand_test_code: "",
      cand_test_marks: "",
    });
  const [error, setError] = useState("");
  const [userAnswers, setUserAnswers] = useState(
    new Array(quizData.questions.length).fill("")
  );
  const navigate = useNavigate();
  function generateTestCandidateId(tb_id: number) {
    const prefix = "DB";
    const randomNumber = Math.floor(Math.random() * 10 ** 15)
      .toString()
      .padStart(15, "0");
    const testCandidateId = `${prefix}${tb_id}-${randomNumber}`;

    return testCandidateId;
  }
  const fetchCandidateProfile = async () => {
    try {
      const batchResponse = await getTrainingBatches();
      const sortedBatches = (batchResponse?.data || []).sort(
        (a: { tb_id: number }, b: { tb_id: number }) => b.tb_id - a.tb_id
      );
      const latestBatchId = sortedBatches[0]?.tb_id;

      if (!latestBatchId) {
        throw new Error("No active training batch found");
      }

      const response = await getCandidateProfileByCnic(cnicNo, latestBatchId);

      setCandidate({
        candName: response.candidate.name || "Unknown Candidate",
        tb_id: response.candidate.tb_id,
        cand_id: response.candidate.cand_id,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    }
  };

  useEffect(() => {
    fetchCandidateProfile();
  }, [cnicNo]);
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (timeRemaining > 0 && !isQuizComplete) {
      intervalId = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(intervalId);
            setIsQuizComplete(true);
            toast.error("Time's up!", {
              icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [timeRemaining, isQuizComplete]);
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleNext(4, candName);
      }
    };

    const handleDevToolsOpen = () => {
      const threshold = 160;
      if (
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold
      ) {
        handleNext(4, candName);
      }
    };

    const disableContextMenu = (e: MouseEvent) => e.preventDefault();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("resize", handleDevToolsOpen);
    document.addEventListener("contextmenu", disableContextMenu);
  }, []);

  useEffect(() => {
    setSelectedAnswer(userAnswers[currentQuestionIndex] || "");
  }, [currentQuestionIndex]);

  const currentQuestion = quizData.questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === quizData.questions.length - 1;

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleNextQuestion = () => {
    if (selectedAnswer) {
      const newUserAnswers = [...userAnswers];
      newUserAnswers[currentQuestionIndex] = selectedAnswer;
      setUserAnswers(newUserAnswers);

      if (!isLastQuestion) {
        setCurrentQuestionIndex((prev) => prev + 1);
      }
    }
  };

  const handleEndQuiz = () => {
    if (selectedAnswer) {
      const newUserAnswers = [...userAnswers];
      newUserAnswers[currentQuestionIndex] = selectedAnswer;
      setUserAnswers(newUserAnswers);
      setIsQuizComplete(true);
    }
    updateCandidateScore();
  };
  const updateCandidateScore = async () => {
    try {
      const testCandidateId = generateTestCandidateId(candidate.tb_id);
      const testScore =
        userAnswers.filter(
          (answer, index) => answer === quizData.questions[index].correctAnswer
        ).length + 1;
      const updatedScore = {
        cand_id: candidate.cand_id,
        cand_test_code: testCandidateId,
        cand_test_marks: testScore.toString(),
      };
      const response = await updateCandidateTestScore(updatedScore);
      if (response.message === "Test marks updated successfully") {
        toast.success(
          <div className="flex items-center gap-4">
            <CheckCircle className="h-6 w-6 text-[#4CAF50]" />
            <div>
              <h4 className="font-bold text-lg text-[#2C3E50]">Success!</h4>
              <p className="text-sm text-gray-600">
                Candidate test score successfully!
              </p>
            </div>
          </div>,
          {
            style: {
              backgroundColor: "#E8F5E9",
              border: "1px solid #4CAF50",
              borderRadius: "8px",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            },
          }
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    }
  };
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
  };

  if (isQuizComplete) {
    const correctAnswers = userAnswers.filter(
      (answer, index) => answer === quizData.questions[index].correctAnswer
    ).length;
    const score = ((correctAnswers / quizData.questions.length) * 100).toFixed(
      1
    );

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen bg-gradient-to-b from-[#FFCE59] to-white p-8 flex items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", duration: 0.5 }}
          className="w-full max-w-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-xl p-8"
        >
          <motion.div className="text-center space-y-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="inline-flex p-4 bg-[#FFCE59]/10 dark:bg-[#FFCE59]/20 rounded-full"
            >
              <CheckCircle className="w-12 h-12 text-[#FFCE59]" />
            </motion.div>
            <h2 className="text-3xl font-bold text-[#2C3E50] dark:text-white">
              Quiz Complete!
            </h2>
            <div className="space-y-4">
              <p className="text-[#2C3E50] dark:text-gray-300">
                You answered {userAnswers.filter((a) => a).length} out of{" "}
                {quizData.questions.length} questions
              </p>
              <p className="text-[#2C3E50] dark:text-gray-300">
                Correct answers: {correctAnswers}
              </p>
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: "spring" }}
                className="mt-4"
              >
                <span
                  className={`text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#FFCE59] to-[#FFD700] ${
                    Number(score) < 60 ? "text-red-500 bg-none" : ""
                  }`}
                >
                  {score}%
                </span>
                <div className="mt-2">
                  {Number(score) >= 60 ? (
                    <span className="text-green-600 text-2xl font-semibold">
                      Pass
                    </span>
                  ) : (
                    <span className="text-red-600 text-2xl font-semibold">
                      Fail
                    </span>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    );
  }

  const progress =
    ((currentQuestionIndex + 1) / quizData.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFCE59] to-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8 relative">
          <button
            onClick={() => handleNext(4, candName)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#FFCE59] text-white shadow-lg hover:bg-[#FFB300] transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          {/* Centered Image (Fixed) */}
          <div className="absolute left-1/2 transform -translate-x-1/2 top-1/2 -translate-y-1/2 z-10">
            <img
              src={Logo}
              alt="Centered Image"
              className="max-w-full h-auto"
            />
          </div>

          {/* Timer on the right */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-gray-800 shadow-lg ${
              timeRemaining < 300 ? "text-red-500" : "text-[#FFCE59]"
            } absolute right-0`}
          >
            <Clock className="w-5 h-5" />
            <span className="font-medium">{formatTime(timeRemaining)}</span>
          </motion.div>
        </div>

        <div className="mb-8 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-[#2C3E50] dark:text-gray-400">
              Progress
            </span>
            <span className="text-sm font-medium text-[#fffdf8]">
              {currentQuestionIndex + 1}/{quizData.questions.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-xl p-8 mb-8"
          >
            <h2 className="text-2xl font-bold text-[#2C3E50] dark:text-white mb-8">
              {currentQuestion.question}
            </h2>

            <div className="space-y-4">
              {currentQuestion.options.map((option, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <label
                    className={`relative block bg-white dark:bg-gray-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer border-2 ${
                      selectedAnswer === option
                        ? "border-[#FFCE59] bg-[#FFCE59]/5 dark:bg-[#FFCE59]/10"
                        : "border-transparent hover:border-[#FFCE59]/30"
                    }`}
                  >
                    <input
                      type="radio"
                      name="answer"
                      value={option}
                      checked={selectedAnswer === option}
                      onChange={(e) => setSelectedAnswer(e.target.value)}
                      className="sr-only"
                    />
                    <span className="block text-[#2C3E50] dark:text-gray-100">
                      {option}
                    </span>
                  </label>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-center gap-4">
          {currentQuestionIndex > 0 && (
            <Button
              variant="outline"
              onClick={handlePreviousQuestion}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
          )}

          {isLastQuestion ? (
            <Button
              onClick={handleEndQuiz}
              className="bg-[#FFCE59] text-white hover:bg-[#FFB300] px-6 py-3 rounded-xl"
            >
              Finish Quiz
            </Button>
          ) : (
            <Button
              onClick={handleNextQuestion}
              className="bg-[#FFCE59] text-white hover:bg-[#FFB300] px-6 py-3 rounded-xl"
            >
              Next Question
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizInterface;
