import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Progress } from "../../components/ui/progress";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useNavigate } from "react-router-dom";
import { submitQuiz } from "../../services/api";

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: string;
}

interface QuizData {
  quizTitle: string;
  totalTime: number;
  startTime: string;
  questions: Question[];
}

interface QuizAnswer {
  q_id: number;
  answer: string;
}

export interface QuizSubmission {
  attempt_session: string;
  answers: QuizAnswer[];
}

interface QuizAttemptProps {
  quizData: QuizData;
  attemptSession: string;
}

const QuizAttempt: React.FC<QuizAttemptProps> = ({
  quizData,
  attemptSession,
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(quizData.totalTime);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, string>
  >({});
  const [isQuizComplete, setIsQuizComplete] = useState(false);
  const navigate = useNavigate();

  // Timer effect
  useEffect(() => {
    if (timeRemaining <= 0) {
      handleEndQuiz();
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  const handleAnswerSelection = (answer: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: answer,
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const handleEndQuiz = async () => {
    const answers: QuizAnswer[] = quizData.questions.map((q, index) => ({
      q_id: q.id,
      answer: selectedAnswers[index] || "",
    }));

    const unansweredQuestions = answers.some((a) => !a.answer);
    if (unansweredQuestions) {
      toast.error("Please answer all questions before submitting");
      return;
    }

    try {
      const submissionData: QuizSubmission = {
        attempt_session: attemptSession,
        answers,
      };
      await submitQuiz(submissionData);
      setIsQuizComplete(true);
      toast.success("Quiz submitted successfully!");
    } catch (error) {
      toast.error("Failed to submit quiz");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (isQuizComplete) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "hsl(var(--background))" }}
      >
        <Card className="w-full max-w-lg p-8 text-center">
          <CheckCircle
            className="w-16 h-16 mx-auto mb-4"
            style={{ color: "hsl(var(--primary))" }}
          />
          <h2
            className="text-2xl font-bold mb-4"
            style={{ color: "hsl(var(--foreground))" }}
          >
            Quiz Complete!
          </h2>
          <Button onClick={() => navigate("/dashboard")} className="mt-4">
            Return to Dashboard
          </Button>
        </Card>
      </motion.div>
    );
  }

  const currentQuestion = quizData.questions[currentQuestionIndex];
  const progress =
    ((currentQuestionIndex + 1) / quizData.questions.length) * 100;

  return (
    <div
      className="min-h-screen p-4 md:p-8"
      style={{ background: "hsl(var(--background))" }}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Timer and Progress */}
        <div className="flex justify-between items-center">
          <div
            className="text-sm font-medium"
            style={{ color: "hsl(var(--foreground))" }}
          >
            Question {currentQuestionIndex + 1} of {quizData.questions.length}
          </div>
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
            }}
          >
            <Clock className="w-4 h-4" />
            <span>{formatTime(timeRemaining)}</span>
          </div>
        </div>

        <Progress value={progress} className="h-2" />

        {/* Question Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-card rounded-lg p-6 shadow-lg"
          >
            <h3
              className="text-xl font-semibold mb-6"
              style={{ color: "hsl(var(--foreground))" }}
            >
              {currentQuestion.question}
            </h3>

            <div className="space-y-4">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelection(option)}
                  className={`w-full p-4 text-left rounded-lg transition-all ${
                    selectedAnswers[currentQuestionIndex] === option
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-4">
          <Button
            onClick={handlePreviousQuestion}
            disabled={currentQuestionIndex === 0}
            variant="outline"
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> Previous
          </Button>

          {currentQuestionIndex === quizData.questions.length - 1 ? (
            <Button
              onClick={handleEndQuiz}
              className="bg-primary text-primary-foreground"
            >
              Submit Quiz
            </Button>
          ) : (
            <Button
              onClick={handleNextQuestion}
              className="bg-primary text-primary-foreground"
            >
              Next <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizAttempt;
