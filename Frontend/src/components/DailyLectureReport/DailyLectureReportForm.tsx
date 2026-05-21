import { useState, useEffect } from "react";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../components/ui/form";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import { CalendarIcon } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../../components/ui/popover";
import { Calendar } from "../../components/ui/calendar";
import { cn } from "../../lib/utils";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as zod from "zod";
import { useBatch } from "../../context/BatchContext";
import { createDailyReport } from "../../services/api";
import { toast } from "sonner";
import { clearFormData, getFormData } from "../../utils/formStorage";
import { format } from "date-fns";

// Function to check if date is valid (past or today, but not a weekend)
const isValidReportDate = (dateStr: string): boolean => {
  try {
    const inputDate = new Date(dateStr);
    if (isNaN(inputDate.getTime())) return false; // Invalid date check

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    inputDate.setHours(0, 0, 0, 0);

    // Check if date is not in future and not a weekend
    const day = inputDate.getDay();
    const isWeekend = day === 0 || day === 6; // Only Sunday (0) and Saturday (6) are weekend
    const isNotFuture = inputDate.getTime() <= today.getTime();

    return isNotFuture && !isWeekend; // Changed logic to be more clear
  } catch {
    return false;
  }
};

// Update the form schema with modified validation
const formSchema = zod.object({
  dlr_date: zod.string().min(1, "Date is required"),
  dlr_title: zod.string().min(1, "Title is required"),
  dlr_topics: zod.string().min(1, "Topics are required"),
  dlr_practical: zod.boolean().default(false),
  dlr_assignment: zod.boolean().default(false),
  dlr_challenges: zod.string().min(1, "Challenges are required"),
  dlr_month: zod.string().min(1, "Month is required"),
});

// Create a separate interface for the API data which can have string values
export interface DailyReportAPIData {
  t_id: number;
  center_id: number;
  course_id: number;
  tb_id: number;
  dlr_date: string;
  dlr_title: string;
  dlr_topics: string;
  dlr_practical: string; // API expects string ("Yes" or "No")
  dlr_assignment: string; // API expects string ("Yes" or "No")
  dlr_challenges: string;
  dlr_month: string;
}

// Form data interface matches the schema (with boolean values)
export interface DailyReportFormData {
  t_id: number;
  center_id: number;
  course_id: number;
  tb_id: number;
  dlr_date: string;
  dlr_title: string;
  dlr_topics: string;
  dlr_practical: boolean; // Form uses boolean
  dlr_assignment: boolean; // Form uses boolean
  dlr_challenges: string;
  dlr_month: string;
}

// Utility function for weekend check
const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

const DailyLectureReportForm = () => {
  const { user_id, latestSelectedBatch, center_id, course_id } = useBatch();
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const today = new Date().toISOString().split("T")[0];
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

  const form = useForm<DailyReportFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      t_id: user_id,
      center_id: center_id,
      course_id: course_id,
      tb_id: latestSelectedBatch,
      dlr_date: today,
      dlr_title: "",
      dlr_topics: "",
      dlr_practical: false, // Initialize as boolean
      dlr_assignment: false, // Initialize as boolean
      dlr_challenges: "",
      dlr_month: currentMonth,
    },
  });

  // Sync the form's date value with our local state
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "dlr_date") {
        setSelectedDate(value.dlr_date || "");
      }
    });

    return () => subscription.unsubscribe();
  }, [form.watch]);

  // Set initial date value
  useEffect(() => {
    setSelectedDate(today);
  }, [today]);

  // Sync date state with form value
  useEffect(() => {
    if (selectedDate) {
      const d = new Date(selectedDate);
      if (!isNaN(d.getTime())) setDate(d);
    }
  }, [selectedDate]);

  // Manual date change handler
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;

    setSelectedDate(newDate);
    const isWeekend =
      new Date(newDate).getDay() === 0 || new Date(newDate).getDay() === 6;
    if (isWeekend) {
      toast.error(
        "Reports can only be submitted for past weekdays (no weekends or future dates)"
      );
      return;
    }
    form.setValue("dlr_date", newDate, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  // When calendar changes, update form value
  const handleCalendarSelect = (day: Date | undefined) => {
    if (!day) return;
    setDate(day);
    // Use date-fns format to get local date string
    const iso = format(day, "yyyy-MM-dd");
    setSelectedDate(iso);
    form.setValue("dlr_date", iso, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  const handleSubmit = async (data: zod.infer<typeof formSchema>) => {
    try {
      setLoading(true);

      // Create API-compatible data object with string values
      // Use the date string directly as it comes from the form (already in YYYY-MM-DD format)
      // Avoid timezone conversion issues
      const reportData: DailyReportAPIData = {
        t_id: user_id,
        center_id: center_id,
        course_id: course_id,
        tb_id: latestSelectedBatch,
        dlr_date: data.dlr_date, // Use date directly in YYYY-MM-DD format
        dlr_title: data.dlr_title,
        dlr_topics: data.dlr_topics,
        dlr_practical: data.dlr_practical ? "Yes" : "No", // Convert boolean to string
        dlr_assignment: data.dlr_assignment ? "Yes" : "No", // Convert boolean to string
        dlr_challenges: data.dlr_challenges,
        dlr_month: data.dlr_month,
      };

      // TypeScript will allow this because createDailyReport should accept DailyReportAPIData
      let report;
      try {
        report = await createDailyReport(reportData as any);
      } catch (err: any) {
        // Axios error handling for backend error response
        const backendMsg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Failed to submit report";
        toast.error(backendMsg);
        setLoading(false);
        return;
      }

      if (report.success) {
        toast.success("Report submitted successfully");
        const batchCacheKey = `trainerDashboardData_${user_id}_${latestSelectedBatch}`;
        const data = localStorage.getItem(batchCacheKey);
        if (data) {
          const parsedData = JSON.parse(data);
          // Check if formattedDate is today's date
          const today = format(new Date(), "yyyy-MM-dd");
          if (reportData.dlr_date === today) {
            // Update the local storage data
            parsedData.data.statistics.isDailyReportSubmitted = true;
            console.log("Updated local storage data:", parsedData);
            // Save the updated data back to local storage
            localStorage.setItem(batchCacheKey, JSON.stringify(parsedData));
          }
        }
        clearFormData("dailylecturecreat");
      } else {
        // Always show backend error message if present
        if (report.message) {
          toast.error(report.message);
        } else {
          toast.error("Failed to submit report");
        }
      }

      form.reset();
    } catch (error) {
      console.error("Error submitting report:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to submit report"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 bg-background">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Create New Report</h2>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Debug div to see what's happening */}
          <div className="text-xs text-slate-500 mb-2">
            Current date state: {selectedDate || "none"}
          </div>

          <FormField
            control={form.control}
            name="dlr_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Report Date</FormLabel>
                <FormControl>
                  {/* Date Picker Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-[240px] justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                        style={{
                          background: "hsl(var(--background))",
                          color: "hsl(var(--foreground))",
                          borderColor: "hsl(var(--border))",
                        }}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0"
                      align="start"
                      style={{
                        background: "hsl(var(--card))",
                        color: "hsl(var(--foreground))",
                        border: "1px solid hsl(var(--border))",
                      }}
                    >
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={handleCalendarSelect}
                        disabled={
                          (d) =>
                            d > new Date() || // Disable future dates
                            isWeekend(d) // Disable weekends
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dlr_title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Lecture title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dlr_topics"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Topics Covered</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Topics covered in the lecture"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-row gap-4">
            <FormField
              control={form.control}
              name="dlr_practical"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 flex-1">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="mb-0">Practical Work</FormLabel>
                  <span className="ml-auto text-sm text-muted-foreground">
                    {field.value ? "Yes" : "No"}
                  </span>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dlr_assignment"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 flex-1">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="mb-0">Assignment</FormLabel>
                  <span className="ml-auto text-sm text-muted-foreground">
                    {field.value ? "Yes" : "No"}
                  </span>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="dlr_challenges"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Challenges</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Challenges faced during the lecture"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                Submitting...
              </div>
            ) : (
              "Submit Report"
            )}
          </Button>
        </form>
      </Form>
    </Card>
  );
};

export default DailyLectureReportForm;
