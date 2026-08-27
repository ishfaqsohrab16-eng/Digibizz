import React, { useState, useEffect } from "react";
import {
  Star,
  Building,
  User,
  Book,
  MessageSquare,
  Send,
  Sparkles,
  Wifi,
  Loader2,
} from "lucide-react";

import { useBatch } from "../../context/BatchContext";
import {
  submitFeedback,
  getTrainersForFeedBack,
  getFeedbackWindow,
} from "../../services/api";
import { toast } from "sonner";
import Loader from "../Loader";

interface FeedbackRating {
  label: string;
  value: number;
  icon: React.ReactNode;
}
export interface FeedbackSubmission {
  user_id: number;
  sf_lecture: number;
  sf_queries: number;
  sf_knowledge: number;
  sf_punctuality: number;
  sf_trainer_feedback: string;
  sf_lab_clean: number;
  sf_lab_internet: number;
  sf_lab_feedback: string;
  sf_date: string;
  sf_month: string;
}

// Update the TrainerProfile interface
interface TrainerProfile {
  user: {
    user_id: number;
    user_name: string;
    user_username: string;
    user_email: string;
    user_profile_photo: string;
    user_type: string;
    user_status: number;
    createdAt: string;
    updatedAt: string;
  };
  trainerCenterAllocation: {
    tca_id: number;
    t_id: number;
    course_id: number;
    center_id: number;
    tb_id: number;
    trainer: {
      user_id: number;
    };
    course: {
      course_full_name: string;
    };
    center: {
      center_name: string;
    };
  };
}

export function StudentFeedback() {
  const [ratings, setRatings] = useState<FeedbackRating[]>([
    { label: "Lecture Quality", value: 0, icon: <Book className="w-5 h-5" /> },
    {
      label: "Query Resolution",
      value: 0,
      icon: <MessageSquare className="w-5 h-5" />,
    },
    { label: "Knowledge", value: 0, icon: <User className="w-5 h-5" /> },
    { label: "Punctuality", value: 0, icon: <Star className="w-5 h-5" /> },
    {
      label: "Lab Cleanliness",
      value: 0,
      icon: <Building className="w-5 h-5" />,
    },
    { label: "Internet Quality", value: 0, icon: <Wifi className="w-5 h-5" /> },
  ]);
  const [trainerFeedback, setTrainerFeedback] = useState("");
  const [labFeedback, setLabFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const {
    user_id,
    center_id,
    course_id,
    selectedBatchId,
    latestSelectedBatch,
  } = useBatch();
  const [error, setError] = useState<string | null>(null);
  const [trainerProfile, setTrainerProfile] = useState<TrainerProfile | null>(
    null
  );

  const handleRating = (index: number, value: number) => {
    const newRatings = [...ratings];
    newRatings[index].value = value;
    setRatings(newRatings);
  };

  /**
   * Whether this week's feedback is still open.
   *
   * Feedback is once per week on ANY day of that week. It used to be
   * Friday-only, and that check lived only here - so a student who was busy on
   * Friday lost the week entirely, while the API itself accepted unlimited
   * submissions on any day. The server is now the authority; this state only
   * decides what the form says before it is filled in.
   */
  const [feedbackWindow, setFeedbackWindow] = useState<{
    canSubmit: boolean;
    weekLabel: string;
    submittedOn: string | null;
    message: string;
  } | null>(null);

  const loadWindow = async () => {
    try {
      const result = await getFeedbackWindow();
      setFeedbackWindow(result);
    } catch {
      // Not fatal: the server re-checks on submit, so leave the form usable
      // rather than blocking a student because one extra call failed.
      setFeedbackWindow(null);
    }
  };

  useEffect(() => {
    loadWindow();
  }, []);

  const validateFeedback = () => {
    if (feedbackWindow && !feedbackWindow.canSubmit) {
      setError(feedbackWindow.message);
      return false;
    }

    if (ratings.some((r) => r.value === 0)) {
      setError("Please provide ratings for all categories");
      return false;
    }

    if (!trainerFeedback.trim() || !labFeedback.trim()) {
      setError("Please provide both trainer and lab feedback");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    // Declared outside the try so the catch can dismiss it - a const inside
    // the try block is not in scope there.
    let loadingToast: string | number | undefined;
    try {
      setError(null);
      if (!validateFeedback()) return;

      setIsSubmitting(true);
      loadingToast = toast.loading("Submitting feedback...");

      const today = new Date();
      const feedbackData: FeedbackSubmission = {
        user_id,
        sf_lecture: ratings[0].value,
        sf_queries: ratings[1].value,
        sf_knowledge: ratings[2].value,
        sf_punctuality: ratings[3].value,
        sf_lab_clean: ratings[4].value,
        sf_lab_internet: ratings[5].value,
        sf_trainer_feedback: trainerFeedback.trim(),
        sf_lab_feedback: labFeedback.trim(),
        sf_date: today.toISOString().split("T")[0], // Format: YYYY-MM-DD
        sf_month: today.toLocaleString("default", { month: "long" }), // Format: January, February, etc.
      };

      const result = await submitFeedback(feedbackData);
      toast.success(result?.message || "Feedback submitted", { id: loadingToast });

      // Reset form
      setRatings(ratings.map((r) => ({ ...r, value: 0 })));
      setTrainerFeedback("");
      setLabFeedback("");
      // Re-check so the form immediately shows that this week is now used.
      await loadWindow();
    } catch (err: any) {
      // Show the server's own message. It explains WHY - already submitted
      // this week, no trainer allocated, a rating out of range - where a
      // generic "failed to submit" leaves the student with nothing to act on.
      const errorMessage =
        err?.response?.data?.message ||
        (err instanceof Error ? err.message : "Could not submit your feedback");
      toast.error(errorMessage, { id: loadingToast });
      setError(errorMessage);
      if (err?.response?.status === 409) await loadWindow();
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchTrainersProfile = async () => {
    setIsLoading(true);
    try {
      const data = await getTrainersForFeedBack(latestSelectedBatch, user_id);
      setTrainerProfile(data);
    } catch (error) {
      console.error("Error fetching trainers profile:", error);
      toast.error("Failed to load trainer profile");
      setError("Failed to load trainer profile");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBatchId >= 0 && user_id > 0) {
      fetchTrainersProfile();
    }
  }, [selectedBatchId, user_id]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-8xl mx-auto">
      <div className=" rounded-xl shadow-2xl overflow-hidden transform transition-all">
        <div className="relative p-8 border-b header-gradient border-blue-700">
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full filter blur-3xl opacity-20 animate-pulse-custom"></div>
          <h2 className="text-3xl font-bold text-white mb-2 relative animate-slide-in">
            Training Feedback
            <Sparkles className="inline-block ml-2 w-6 h-6 text-yellow-300 animate-pulse-custom" />
          </h2>
          <p className="text-blue-200 relative">
            Help us improve by sharing your experience
          </p>
        </div>

        <div className="p-8 space-y-8 to-transparent">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Building,
                title: "Training Center",
                value:
                  trainerProfile?.trainerCenterAllocation.center.center_name ||
                  "Loading...",
                color: "blue",
              },
              {
                icon: User,
                title: "Trainer",
                value: trainerProfile?.user.user_name || "Loading...",
                color: "purple",
              },
              {
                icon: Book,
                title: "Course",
                value:
                  trainerProfile?.trainerCenterAllocation.course
                    .course_full_name || "Loading...",
                color: "indigo",
              },
            ].map((item, index) => (
              <div
                key={item.title}
                className={`bg-green-900/20 backdrop-blur-lg rounded-xl p-6 transform transition-all duration-300 hover:scale-105 hover:shadow-lg animate-fade-in`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div
                  className={`p-3 bg-${item.color}-500/20 rounded-full w-fit mb-4 animate-float`}
                >
                  <item.icon className={`w-6 h-6 text-${item.color}-400`} />
                </div>
                <p className="text-sm text-gray-400">{item.title}</p>
                <p className="font-medium text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {ratings.map((rating, index) => (
              <div
                key={rating.label}
                onMouseEnter={() => setActiveSection(index)}
                onMouseLeave={() => setActiveSection(null)}
                className={`p-6 rounded-xl transition-all duration-300 ${
                  activeSection === index
                    ? "bg-green-800/40 shadow-lg animate-glow"
                    : "bg-green-900/20"
                }`}
              >
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 rounded-full">{rating.icon}</div>
                  <label className="text-sm font-medium text-white">
                    {rating.label}
                  </label>
                </div>
                <div className="flex space-x-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleRating(index, star)}
                      className={`p-2 rounded-full transition-all duration-300 transform hover:scale-110 ${
                        rating.value >= star
                          ? "text-yellow-300 animate-pulse-custom"
                          : "text-gray-500 hover:text-yellow-200"
                      }`}
                    >
                      <Star
                        className="w-7 h-7"
                        fill={rating.value >= star ? "currentColor" : "none"}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            {[
              {
                label: "Trainer Feedback",
                value: trainerFeedback,
                setter: setTrainerFeedback,
                icon: User,
              },
              {
                label: "Lab Feedback",
                value: labFeedback,
                setter: setLabFeedback,
                icon: Building,
              },
            ].map((field, index) => (
              <div
                key={field.label}
                className="transform transition-all duration-300"
              >
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                  <field.icon className="w-4 h-4 text-gray-700" />
                  <span>{field.label}</span>
                </label>
                <textarea
                  value={field.value}
                  onChange={(e) => field.setter(e.target.value)}
                  className="w-full p-4 border border-blue-700/50 rounded-xl text-gray-700  focus:ring-2  focus:border-transparent transition-all duration-300"
                  rows={3}
                  placeholder={`Share your thoughts about the ${field.label.toLowerCase()}...`}
                />
              </div>
            ))}
          </div>

          {/* States the rule up front, so a student is not told only after
              filling the whole form in. */}
          {feedbackWindow && (
            <div
              className={`mb-4 p-4 rounded-xl border ${
                feedbackWindow.canSubmit
                  ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                  : "bg-amber-50 border-amber-300 text-amber-800"
              }`}
            >
              <p className="font-medium">
                {feedbackWindow.canSubmit
                  ? `This week is open — ${feedbackWindow.weekLabel}`
                  : `Already submitted this week — ${feedbackWindow.weekLabel}`}
              </p>
              <p className="text-sm mt-0.5">{feedbackWindow.message}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-xl">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || feedbackWindow?.canSubmit === false}
            className={`
              w-full py-4 rounded-xl font-medium
              flex items-center justify-center space-x-2
              transform transition-all duration-300
              ${
                feedbackWindow?.canSubmit === false
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : isSubmitting
                  ? "bg-green-300 cursor-not-allowed"
                  : "header-gradient text-white hover:bg-green-700"
              }
            `}
          >
            <Send
              className={`w-5 h-5 ${
                isSubmitting ? "animate-pulse" : "animate-none"
              }`}
            />
            <span>
              {feedbackWindow?.canSubmit === false
                ? "Already submitted for this week"
                : isSubmitting
                ? "Submitting..."
                : "Submit Feedback"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
