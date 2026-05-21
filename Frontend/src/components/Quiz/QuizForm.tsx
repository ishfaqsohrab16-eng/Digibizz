import { useState, useEffect } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { PlusCircle } from "lucide-react";
import { useToast } from "../../hooks/use-toast";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../components/ui/form";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import QuestionItem from "./QuestionItem";
import { createQuizQuestion, updateQuiz } from "../../services/api";
import { QuizFormData } from "../../types/quiz";
import { useBatch } from "../../context/BatchContext";
import { useNavigate } from "react-router-dom"; // Import navigation hook

// Schema for quiz form validation
const quizFormSchema = z.object({
  quiz_title: z.string().min(1, "Quiz title is required"),
  tb_id: z.number().int().positive(),
  t_id: z.number().int().positive(),
  quiz_tab_change: z.enum(["ON", "OFF"]),
  quiz_passing_score: z.number().int().min(0).max(100),
  quiz_time_limit: z.number().int().min(1),
  quiz_attempts_limit: z.number().int().min(1),
  quiz_result_answers: z.enum(["ON", "OFF"]),
  questions: z
    .array(
      z.object({
        q_title: z.string().min(1, "Question is required"),
        a1: z.string().min(1, "Option A is required"),
        a2: z.string().min(1, "Option B is required"),
        a3: z.string().min(1, "Option C is required"),
        a4: z.string().min(1, "Option D is required"),
        correct_a: z.string().min(1, "Correct answer is required"),
        correct_a_reason: z.string().min(1, "Explanation is required"),
      })
    )
    .min(3, "At least three questions are required"),
});

type QuizFormValues = z.infer<typeof quizFormSchema>;



export default function QuizForm() {
  const { toast } = useToast();
  const navigate = useNavigate(); // Initialize navigation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { latestSelectedBatch, user_id } = useBatch();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);

  // Retrieve saved quiz data from localStorage
  const savedQuiz = JSON.parse(localStorage.getItem("selectedQuiz") || "{}");

  // Ensure we have valid numbers for these fields
  const batchId = latestSelectedBatch || 0;
  const teacherId = user_id || 0;

  // Set isEditMode and isViewMode from localStorage in useEffect
  useEffect(() => {
    const isEditModeFromStorage = localStorage.getItem("isEditMode") === "true"? true : false;
    const isViewModeFromStorage = localStorage.getItem("isViewMode") === "true"? true : false;
    setIsEditMode(isEditModeFromStorage);
    setIsViewMode(isViewModeFromStorage);
  }, []);

  // Default form values
  const defaultValues: QuizFormValues = savedQuiz?.studentQuizQuestions
    ? {
        ...savedQuiz,
        questions: savedQuiz.studentQuizQuestions.map((q: any) => ({
          q_title: q.q_title,
          a1: q.a1,
          a2: q.a2,
          a3: q.a3,
          a4: q.a4,
          correct_a: q.correct_a,
          correct_a_reason: q.correct_a_reason,
        })),
      }
    : {
        quiz_title: "",
        tb_id: batchId, // Ensure this is a number
        t_id: teacherId, // Ensure this is a number
        quiz_tab_change: "OFF",
        quiz_passing_score: 70,
        quiz_time_limit: 10,
        quiz_attempts_limit: 3,
        quiz_result_answers: "ON",
        questions: [
          {
            q_title: "",
            a1: "",
            a2: "",
            a3: "",
            a4: "",
            correct_a: "A", // Ensure this has a valid default value
            correct_a_reason: "",
          },
        ],
      };

  const form = useForm<QuizFormValues>({
    resolver: zodResolver(quizFormSchema),
    defaultValues,
    mode: "onChange",
  });

  // Set the batch and teacher IDs whenever they change
  useEffect(() => {
    form.setValue("tb_id", batchId);
    form.setValue("t_id", teacherId);

    // If savedQuiz exists, populate the form with its data
    if (Object.keys(savedQuiz).length > 0 && savedQuiz.studentQuizQuestions) {
      form.reset({
        ...savedQuiz,
        questions: savedQuiz.studentQuizQuestions.map((q: any) => ({
          q_title: q.q_title,
          a1: q.a1,
          a2: q.a2,
          a3: q.a3,
          a4: q.a4,
          correct_a: q.correct_a,
          correct_a_reason: q.correct_a_reason,
        })),
      });
    }
  }, [batchId, teacherId, form ]);

  // Field array for managing multiple questions
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  // Mutation for creating or updating a quiz
  const quizMutation = useMutation({
    mutationFn: async (data: QuizFormValues) => {
      if (isEditMode && savedQuiz?.quiz_code) {
        return updateQuiz(savedQuiz.quiz_code, data);
      }
      return createQuizQuestion(data as QuizFormData, batchId, teacherId);
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: isEditMode
          ? "Quiz updated successfully!"
          : "Quiz created successfully!",
        variant: "default",
      });

      // Redirect to another page after a timeout
      setTimeout(() => {
        navigate("/quizzes"); // Replace "/quizzes" with the desired route
      }, 2000);
    },
    onError: (error) => {
      console.error("Quiz operation error:", error);
      toast({
        title: "Error",
        description: "Failed to process quiz. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const isLoading = quizMutation.isPending;
  const error = quizMutation.error;

  // Submit handler - Updated to ensure tb_id and t_id are included
  const onSubmit = async (values: QuizFormValues) => {
    try {
      setIsSubmitting(true);

      // Ensure the batch and teacher IDs are included and valid numbers
      const validatedValues = {
        ...values,
        tb_id: batchId,
        t_id: teacherId,
        questions: values.questions.map((q) => ({
          ...q,
          correct_a: q.correct_a || "A",
        })),
      };

      quizMutation.mutate(validatedValues);
    } catch (err) {
      console.error("Form submission error:", err);
      setIsSubmitting(false);
      toast({
        title: "Error",
        description: "Failed to validate quiz data. Please check all fields.",
        variant: "destructive",
      });
    }
  };

  // Add new question handler - Updated with valid initial value
  const handleAddQuestion = () => {
    if (fields.length >= 10) {
      toast({
        title: "Maximum Limit Reached",
        description: "You can add up to 10 questions only.",
        variant: "destructive",
      });
      return;
    }

    append({
      q_title: "",
      a1: "",
      a2: "",
      a3: "",
      a4: "",
      correct_a: "A", // Ensure this has a valid default value
      correct_a_reason: "",
    });
  };

  // Make sure the handleSubmit function correctly forwards to onSubmit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Get the form values and ensure the IDs are set
    const formValues = form.getValues();
    formValues.tb_id = batchId;
    formValues.t_id = teacherId;

    const response = await onSubmit(formValues);
  };

  // Disable form fields in view mode
  const isFieldDisabled = isViewMode || isLoading;

  return (
    <Card className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-all duration-300">
      <CardHeader className="border-b border-gray-200 p-6 bg-gradient-to-r from-blue-50 to-white">
        <CardTitle className="text-2xl font-bold flex items-center text-blue-800">
          <div className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center mr-3 shadow-md">
            <PlusCircle className="w-6 h-6" />
          </div>
          <span className="bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent">
            {isViewMode ? "View Quiz" : isEditMode ? "Edit Quiz" : "Add Quiz"}
          </span>
        </CardTitle>
        <p className="text-gray-600 mt-2">
          {isViewMode
            ? "View the details of this quiz."
            : isEditMode
            ? "Edit the quiz details and questions."
            : "Create engaging quizzes for your students with multiple choice questions."}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <Form {...form}>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
              {/* Left Column (2/3) */}
              <div className="md:col-span-2 space-y-6">
                {/* Explanation */}
                <FormField
                  control={form.control}
                  name="quiz_title"
                  render={({ field }) => (
                    <FormItem className="bg-gradient-to-r from-blue-50 to-white p-4 rounded-lg border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-md">
                      <FormLabel className="flex items-center text-lg font-medium text-gray-800">
                        <span>Quiz Title</span>
                        <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                          Main Title
                        </span>
                      </FormLabel>
                      <p className="text-sm text-gray-600 mb-2">
                        Enter a clear, descriptive title for your quiz
                      </p>
                      <FormControl>
                        <Input
                          placeholder="e.g. JavaScript Fundamentals Quiz"
                          {...field}
                          required
                          disabled={isFieldDisabled}
                          className="shadow-sm border-2 border-blue-100 focus:border-blue-500 py-6 text-lg transition-all duration-200 font-medium"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Questions Section */}
                <div>
                  <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-white p-3 rounded-lg border border-blue-100 shadow-sm mb-6">
                    <div className="flex items-center">
                      <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 shadow-sm">
                        <span className="font-semibold">Q</span>
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-blue-800">
                          Questions
                        </h2>
                        <p className="text-sm text-gray-600">
                          Add multiple-choice questions for your quiz below
                        </p>
                      </div>
                    </div>
                    <div className="bg-blue-50 px-3 py-1 rounded-full">
                      <span className="text-blue-800 text-sm font-medium">
                        {fields.length} Question{fields.length !== 1 ? "s" : ""}{" "}
                        Added
                      </span>
                      {fields.length < 3 && (
                        <span className="text-red-500 text-xs block">
                          Minimum 3 questions required
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Questions List */}
                  {fields.map((field, index) => (
                    <QuestionItem
                      key={field.id}
                      index={index}
                      control={form.control}
                      remove={() => {
                        if (fields.length > 1) {
                          remove(index);
                          toast({
                            title: "Question Removed",
                            description: `Question ${
                              index + 1
                            } has been removed.`,
                            variant: "default",
                          });
                        } else {
                          toast({
                            title: "Cannot Remove",
                            description: "At least one question is required.",
                            variant: "destructive",
                          });
                        }
                      }}
                      isRemoveDisabled={fields.length <= 1 || !!isViewMode}
                    />
                  ))}

                  {/* Add Question Button */}
                  {!isViewMode && (
                    <Button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transform transition-all duration-300 hover:shadow-lg hover:scale-[1.03] active:scale-[0.98]"
                      onClick={() => {
                        handleAddQuestion();
                        toast({
                          title: "Question Added",
                          description: `Question ${
                            fields.length + 1
                          } has been added.`,
                          variant: "default",
                        });
                      }}
                    >
                      <PlusCircle className="w-5 h-5" />
                      <span>Add Question</span>
                      <div className="relative">
                        <span className="absolute -top-2 -right-2 bg-white text-blue-600 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-sm">
                          {fields.length}
                        </span>
                      </div>
                    </Button>
                  )}
                </div>
              </div>

              {/* Right Column (1/3) */}
              <div className="md:col-span-1 space-y-6">
                {/* Passing Score */}
                <FormField
                  control={form.control}
                  name="quiz_passing_score"
                  render={({ field }) => (
                    <FormItem className="bg-gradient-to-r from-gray-50 to-white p-4 rounded-lg border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-md">
                      <FormLabel className="flex items-center text-base font-medium text-gray-800">
                        <span>Passing Score</span>
                        <span className="ml-2 bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                          Required
                        </span>
                      </FormLabel>
                      <p className="text-sm text-gray-600 mb-2">
                        Minimum percentage required to pass the quiz
                      </p>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            {...field}
                            value={field.value}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                            disabled={isFieldDisabled}
                            className="shadow-sm border-2 border-purple-100 focus:border-purple-500 pr-10 transition-all duration-200 hover:bg-purple-50 text-lg font-semibold"
                          />
                        </FormControl>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <span className="text-gray-500">%</span>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Time Limit */}
                <FormField
                  control={form.control}
                  name="quiz_time_limit"
                  render={({ field }) => (
                    <FormItem className="bg-gradient-to-r from-gray-50 to-white p-4 rounded-lg border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-md">
                      <FormLabel className="flex items-center text-base font-medium text-gray-800">
                        <span>Time Limit</span>
                        <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                          Time Control
                        </span>
                      </FormLabel>
                      <p className="text-sm text-gray-600 mb-2">
                        Maximum time allowed for quiz completion
                      </p>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            {...field}
                            value={field.value}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                            disabled={isFieldDisabled}
                            className="shadow-sm border-2 border-red-100 focus:border-red-500 pr-16 transition-all duration-200 hover:bg-red-50 text-lg font-semibold"
                          />
                        </FormControl>
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                          <span className="text-gray-500">minutes</span>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Number of Attempts */}
                <FormField
                  control={form.control}
                  name="quiz_attempts_limit"
                  render={({ field }) => (
                    <FormItem className="bg-gradient-to-r from-gray-50 to-white p-4 rounded-lg border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-md">
                      <FormLabel className="flex items-center text-base font-medium text-gray-800">
                        <span>No. of Attempts</span>
                        <span className="ml-2 bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">
                          Retake Policy
                        </span>
                      </FormLabel>
                      <p className="text-sm text-gray-600 mb-2">
                        Maximum number of tries if student fails to complete
                      </p>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                          disabled={isFieldDisabled}
                          className="shadow-sm border-2 border-orange-100 focus:border-orange-500 transition-all duration-200 hover:bg-orange-50 text-lg font-semibold"
                        />
                      </FormControl>
                      <p className="text-xs bg-gray-100 text-gray-700 p-2 mt-2 rounded-md">
                        Set to 1 for single attempt only, or higher to allow
                        retakes
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Window/Tab Switch */}
                <FormField
                  control={form.control}
                  name="quiz_tab_change"
                  render={({ field }) => (
                    <FormItem className="bg-gradient-to-r from-gray-50 to-white p-4 rounded-lg border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-md">
                      <FormLabel className="flex items-center text-base font-medium text-gray-800">
                        <span>Window/Tab Switch</span>
                        <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                          Security Setting
                        </span>
                      </FormLabel>
                      <p className="text-sm text-gray-600 mb-2">
                        Student can switch window/tab during the quiz?
                      </p>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isFieldDisabled}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-white border-2 border-blue-100 focus:border-blue-500 shadow-sm transition-all duration-200 hover:bg-blue-50">
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-white border border-blue-100 shadow-lg rounded-md">
                          <SelectItem
                            value="OFF"
                            className="hover:bg-blue-50 cursor-pointer font-medium py-2"
                          >
                            Do not allow
                          </SelectItem>
                          <SelectItem
                            value="ON"
                            className="hover:bg-blue-50 cursor-pointer font-medium py-2"
                          >
                            Allow
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs bg-gray-100 text-gray-700 p-2 mt-2 rounded-md">
                        Controls whether students can navigate away during
                        testing
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Quiz Result Answers - Make this visible */}
                <FormField
                  control={form.control}
                  name="quiz_result_answers"
                  render={({ field }) => (
                    <FormItem className="bg-gradient-to-r from-gray-50 to-white p-4 rounded-lg border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-md">
                      <FormLabel className="flex items-center text-base font-medium text-gray-800">
                        <span>Review Display</span>
                        <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                          Student Feature
                        </span>
                      </FormLabel>
                      <p className="text-sm text-gray-600 mb-2">
                        Students can see their answers and correct answers after
                        quiz completion
                      </p>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isFieldDisabled}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-white border-2 border-green-100 focus:border-green-500 shadow-sm transition-all duration-200 hover:bg-green-50">
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-white border border-green-100 shadow-lg rounded-md">
                          <SelectItem
                            value="ON"
                            className="hover:bg-green-50 cursor-pointer font-medium py-2"
                          >
                            Allow
                          </SelectItem>
                          <SelectItem
                            value="OFF"
                            className="hover:bg-green-50 cursor-pointer font-medium py-2"
                          >
                            Do not allow
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs bg-gray-100 text-gray-700 p-2 mt-2 rounded-md">
                        Enables students to review their answers against correct
                        ones for learning
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="pt-6">
                  {error && (
                    <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg">
                      {error instanceof Error
                        ? error.message
                        : "An error occurred"}
                    </div>
                  )}
                  {!isViewMode ? (
                    <Button
                      type="submit"
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 text-lg rounded-lg shadow-md transform transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          <span>
                            {isEditMode ? "UPDATING..." : "PUBLISHING..."}
                          </span>
                        </>
                      ) : (
                        <span>
                          {isEditMode
                            ? "UPDATE THIS QUIZ"
                            : "PUBLISH THIS QUIZ"}
                        </span>
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
