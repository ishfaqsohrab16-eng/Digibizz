import React, { useEffect, useRef, useState } from "react";
import { Upload, X, AlertCircle, CheckCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useBatch } from "../../context/BatchContext";
import {
  getAllCourse,
  getAllTrainer,
  getCenter,
  registerStudent,
} from "../../services/api";
import { StudentRegistrationData } from "../../types/student";
import { generateRollNumber } from "../../utils/rollNumber";
import SettingsHeader from "../Settings/SettingsHeader";
import * as XLSX from "xlsx";
import { toast } from "sonner";

interface BulkImportResult {
  success: number;
  failed: number;
  total: number;
  failedRows: Array<{
    row: number;
    name: string;
    error: string;
  }>;
}

interface ParsedRow {
  rowNumber: number;
  raw: Record<string, unknown>;
}

interface PreviewIssue {
  row: number;
  name: string;
  error: string;
}

interface CourseItem {
  course_id: number;
  course_name: string;
}

interface CenterItem {
  center_id: number;
  center_name: string;
}

interface TrainerItem {
  t_id: number;
  user_name: string;
}

const REQUIRED_HEADERS = [
  "CNIC",
  "Full Name",
  "Father's Name",
  "Email",
  "Phone",
  "Gender",
  "Qualification",
  "District",
  "Course",
  "Center",
];

const SUPPORTED_HEADERS = [
  ...REQUIRED_HEADERS,
  "Course",
  "Course ID",
  "Center",
  "Center ID",
  "Trainer",
  "Trainer ID",
  "Password",
  "Special Case",
  "Special Case Comments",
];

const FIELD_ALIASES: Record<string, string[]> = {
  "CNIC": ["CNIC", "cnic"],
  "Full Name": ["Full Name", "Student Name", "Name", "full_name", "user_name"],
  "Father's Name": [
    "Father's Name",
    "Father Name",
    "Fathers Name",
    "std_fathername",
  ],
  "Email": ["Email", "E-mail", "user_email"],
  "Phone": ["Phone", "Mobile", "Contact", "std_phone"],
  "Gender": ["Gender", "std_gender"],
  "Qualification": ["Qualification", "std_qualification"],
  "District": ["District", "City", "std_district"],
  "Course": ["Course", "Training Course", "course_name"],
  "Course ID": ["Course ID", "course_id"],
  "Center": ["Center", "Training Center", "Center Name", "center_name"],
  "Center ID": ["Center ID", "center_id"],
  "Trainer": ["Trainer", "Trainer Name", "trainer_name"],
  "Trainer ID": ["Trainer ID", "t_id"],
  "Password": ["Password", "user_password"],
  "Special Case": ["Special Case", "special_case"],
  "Special Case Comments": ["Special Case Comments", "special_case_comments"],
};

const BulkImportStudents: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<BulkImportResult | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [previewIssues, setPreviewIssues] = useState<PreviewIssue[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { selectedBatchId } = useBatch();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [centers, setCenters] = useState<CenterItem[]>([]);
  const [trainers, setTrainers] = useState<TrainerItem[]>([]);

  useEffect(() => {
    const fetchMetadata = async () => {
      setIsFetchingMetadata(true);
      try {
        const [courseData, centerData, trainerData] = await Promise.all([
          getAllCourse(),
          getCenter(),
          getAllTrainer(),
        ]);

        setCourses(Array.isArray(courseData) ? courseData : []);
        setCenters(Array.isArray(centerData) ? centerData : []);
        setTrainers(
          Array.isArray(trainerData?.data) ? trainerData.data : []
        );
      } catch (error) {
        toast.error(
          "Failed to load courses/centers/trainers. Please refresh and try again."
        );
      } finally {
        setIsFetchingMetadata(false);
      }
    };

    fetchMetadata();
  }, []);

  const normalize = (value: string): string =>
    value.toLowerCase().trim().replace(/\s+/g, " ");

  const getFieldValue = (
    row: Record<string, unknown>,
    canonicalField: string
  ): unknown => {
    const aliases = FIELD_ALIASES[canonicalField] ?? [canonicalField];
    for (const alias of aliases) {
      if (Object.prototype.hasOwnProperty.call(row, alias)) {
        return row[alias];
      }
    }
    return "";
  };

  const generateUsernameFromEmail = (email: string): string => {
    const cleanEmail = email.trim();
    if (!cleanEmail.includes("@")) return "";
    const username = cleanEmail.split("@")[0];
    return `${username}@`;
  };

  const parseTruthy = (value: unknown): boolean => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    const normalized = String(value ?? "")
      .trim()
      .toLowerCase();
    return ["1", "true", "yes", "y"].includes(normalized);
  };

  const getNumericValue = (value: unknown): number | null => {
    const parsed = Number(String(value ?? "").trim());
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  };

  const findCourseId = (row: Record<string, unknown>): number | null => {
    const byId = getNumericValue(getFieldValue(row, "Course ID"));
    if (byId) {
      const exists = courses.some((item) => item.course_id === byId);
      return exists ? byId : null;
    }
    const byName = String(getFieldValue(row, "Course") ?? "").trim();
    if (!byName) return null;
    const matched = courses.find(
      (item) => normalize(item.course_name) === normalize(byName)
    );
    return matched ? matched.course_id : null;
  };

  const findCenterId = (row: Record<string, unknown>): number | null => {
    const byId = getNumericValue(getFieldValue(row, "Center ID"));
    if (byId) {
      const exists = centers.some((item) => item.center_id === byId);
      return exists ? byId : null;
    }
    const byName = String(getFieldValue(row, "Center") ?? "").trim();
    if (!byName) return null;
    const matched = centers.find(
      (item) => normalize(item.center_name) === normalize(byName)
    );
    return matched ? matched.center_id : null;
  };

  const findTrainerId = (row: Record<string, unknown>): number => {
    const byId = getNumericValue(getFieldValue(row, "Trainer ID"));
    if (byId) {
      const exists = trainers.some((item) => item.t_id === byId);
      if (exists) return byId;
    }
    const byName = String(getFieldValue(row, "Trainer") ?? "").trim();
    if (!byName) return 0;
    const matched = trainers.find(
      (item) => normalize(item.user_name) === normalize(byName)
    );
    return matched ? matched.t_id : 0;
  };

  const validateStudentRow = (row: Record<string, unknown>): string[] => {
    const errors: string[] = [];

    for (const header of REQUIRED_HEADERS) {
      if (!String(getFieldValue(row, header) ?? "").trim()) {
        errors.push(`${header} is required`);
      }
    }

    const gender = String(getFieldValue(row, "Gender") ?? "")
      .trim()
      .toLowerCase();
    if (!["male", "female"].includes(gender)) {
      errors.push("Gender must be Male or Female");
    }

    const email = String(getFieldValue(row, "Email") ?? "").trim();
    if (email && !email.includes("@")) {
      errors.push("Email format is invalid");
    }

    if (!findCourseId(row)) {
      errors.push("Course/Course ID is missing or invalid");
    }

    if (!findCenterId(row)) {
      errors.push("Center/Center ID is missing or invalid");
    }

    return errors;
  };

  const extractRowsFromFile = async (
    selectedFile: File
  ): Promise<ParsedRow[]> => {
    const buffer = await selectedFile.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheet];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });

    return rows.map((raw, index) => ({
      rowNumber: index + 2,
      raw,
    }));
  };

  const resetPreviewState = () => {
    setPreviewData([]);
    setPreviewIssues([]);
    setParsedRows([]);
    setFileHeaders([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];

    if (!validTypes.includes(selectedFile.type)) {
      toast.error("Please select a valid Excel file (.xlsx, .xls) or CSV file");
      return;
    }

    setFile(selectedFile);
    setResults(null);
    resetPreviewState();
  };

  const handlePreview = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }
    if (!selectedBatchId) {
      toast.error("Please select a training batch before bulk importing");
      return;
    }
    try {
      const rows = await extractRowsFromFile(file);
      if (rows.length === 0) {
        toast.error("The selected file is empty");
        return;
      }

      const headers = Object.keys(rows[0].raw);
      setFileHeaders(headers);

      const availableHeaders = headers.map((item) => normalize(item));
      const missingRequired = REQUIRED_HEADERS.filter((header) => {
        const aliases = FIELD_ALIASES[header] ?? [header];
        return !aliases.some((alias) =>
          availableHeaders.includes(normalize(alias))
        );
      });
      if (missingRequired.length > 0) {
        toast.error(
          `Missing required columns: ${missingRequired.join(", ")}`
        );
      }

      const issues: PreviewIssue[] = [];
      for (const row of rows) {
        const validationErrors = validateStudentRow(row.raw);
        if (validationErrors.length > 0) {
          issues.push({
            row: row.rowNumber,
            name:
              String(getFieldValue(row.raw, "Full Name") ?? "").trim() ||
              "Unknown",
            error: validationErrors.join(", "),
          });
        }
      }

      setParsedRows(rows);
      setPreviewData(rows.slice(0, 5).map((item) => item.raw));
      setPreviewIssues(issues);

      if (issues.length > 0) {
        toast.warning(
          `Preview loaded with ${issues.length} row(s) needing correction`
        );
      } else {
        toast.success("Preview loaded. File looks valid.");
      }
    } catch (error) {
      toast.error("Error reading file");
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    if (!selectedBatchId) {
      toast.error("Please select a training batch before importing");
      return;
    }
    if (parsedRows.length === 0) {
      toast.error("Please click Preview first");
      return;
    }

    setIsLoading(true);
    const result: BulkImportResult = {
      success: 0,
      failed: 0,
      total: 0,
      failedRows: [],
    };

    try {
      result.total = parsedRows.length;

      for (const { rowNumber, raw } of parsedRows) {
        const validationErrors = validateStudentRow(raw);
        if (validationErrors.length > 0) {
          result.failed++;
          result.failedRows.push({
            row: rowNumber,
            name: String(raw["Full Name"] ?? "").trim() || "Unknown",
            error: validationErrors.join(", "),
          });
          continue;
        }

        try {
          const email = String(getFieldValue(raw, "Email") ?? "").trim();
          const password = String(getFieldValue(raw, "Password") ?? "").trim();
          const courseId = findCourseId(raw);
          const centerId = findCenterId(raw);
          const trainerId = findTrainerId(raw);

          if (!courseId || !centerId) {
            throw new Error("Course or center mapping failed");
          }

          const studentData: StudentRegistrationData = {
            std_rollno: generateRollNumber(selectedBatchId),
            std_cnic: String(getFieldValue(raw, "CNIC") ?? "").trim(),
            user_name: String(getFieldValue(raw, "Full Name") ?? "").trim(),
            user_username: generateUsernameFromEmail(email),
            std_fathername: String(
              getFieldValue(raw, "Father's Name") ?? ""
            ).trim(),
            std_gender:
              String(getFieldValue(raw, "Gender") ?? "")
                .trim()
                .toLowerCase() === "female"
                ? "Female"
                : "Male",
            std_qualification: String(
              getFieldValue(raw, "Qualification") ?? ""
            ).trim(),
            std_district: String(getFieldValue(raw, "District") ?? "").trim(),
            user_email: email,
            std_phone: String(getFieldValue(raw, "Phone") ?? "").trim(),
            user_password: password,
            confirm_password: password,
            user_type: "Student",
            course_id: courseId,
            center_id: centerId,
            t_id: trainerId,
            tb_id: selectedBatchId,
            user_status: 0,
            dark_mode: "0",
            special_case: parseTruthy(getFieldValue(raw, "Special Case")) ? 1 : 0,
            special_case_comments: String(
              getFieldValue(raw, "Special Case Comments") ?? ""
            ).trim(),
          };

          await registerStudent(studentData);
          result.success++;
        } catch (error: any) {
          result.failed++;
          result.failedRows.push({
            row: rowNumber,
            name:
              String(getFieldValue(raw, "Full Name") ?? "").trim() || "Unknown",
            error:
              error?.message ||
              error?.response?.data?.message ||
              "Unknown error",
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      setResults(result);
      if (result.success > 0) {
        toast.success(`Successfully imported ${result.success} student(s)!`, {
          position: "top-right",
          duration: 5000,
        });
      }
      if (result.failed > 0) {
        toast.error(`Failed to import ${result.failed} student(s).`, {
          position: "top-right",
          duration: 5000,
        });
      }

      setFile(null);
      resetPreviewState();
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      toast.error("Error reading file");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto p-6 bg-[hsl(var(--card))] rounded-lg shadow-md">
      <SettingsHeader
        SettingsHeader="Bulk Import Students"
        SettingDescription="Import multiple students at once from an Excel file"
      />

      <div className="space-y-6">
        {/* File Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Select Excel File
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-[hsl(var(--border))] rounded-lg p-8 hover:border-[hsl(var(--primary))] transition-colors cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
                id="bulk-import-file"
              />
              <label
                htmlFor="bulk-import-file"
                className="flex flex-col items-center justify-center cursor-pointer"
              >
                <Upload className="w-12 h-12 text-[hsl(var(--muted-foreground))] mb-2" />
                <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                  Click to select or drag and drop
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Excel (.xlsx, .xls) or CSV files
                </p>
              </label>
            </div>

            {file && (
              <div className="flex items-center justify-between bg-[hsl(var(--muted))] p-3 rounded-lg">
                <span className="text-sm font-medium text-[hsl(var(--foreground))]">
                  📄 {file.name}
                </span>
                <button
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handlePreview}
                disabled={!file || isLoading || isFetchingMetadata}
                variant="outline"
              >
                Preview
              </Button>
              <Button
                onClick={handleImport}
                disabled={
                  !file || isLoading || parsedRows.length === 0 || isFetchingMetadata
                }
                className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90"
              >
                {isLoading ? "Importing..." : "Import Students"}
              </Button>
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Required columns: {REQUIRED_HEADERS.join(", ")}
            </p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Optional columns: Trainer/Trainer ID, Password, Special Case, Special
              Case Comments
            </p>
            {isFetchingMetadata && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Loading course/center/trainer data...
              </p>
            )}
          </CardContent>
        </Card>

        {/* Preview Section */}
        {previewData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>File Preview (First 5 rows)</CardTitle>
            </CardHeader>
            <CardContent>
              {fileHeaders.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Detected columns: {fileHeaders.join(", ")}
                  </p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Supported columns: {SUPPORTED_HEADERS.join(", ")}
                  </p>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      {Object.keys(previewData[0]).map((key) => (
                        <th
                          key={key}
                          className="border border-[hsl(var(--border))] p-2 bg-[hsl(var(--muted))] text-left font-medium"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, idx) => (
                      <tr key={idx}>
                        {Object.values(row).map((value: any, colIdx) => (
                          <td
                            key={colIdx}
                            className="border border-[hsl(var(--border))] p-2"
                          >
                            {String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {previewIssues.length > 0 && (
          <Card className="border-orange-500 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                Preview Validation Issues ({previewIssues.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {previewIssues.map((issue, idx) => (
                  <div
                    key={`${issue.row}-${idx}`}
                    className="bg-white p-2 rounded border border-orange-200 text-sm"
                  >
                    <p className="font-medium">
                      Row {issue.row}: {issue.name}
                    </p>
                    <p className="text-orange-700 text-xs">{issue.error}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Section */}
        {results && (
          <Card
            className={
              results.failed === 0
                ? "border-green-500 bg-green-50"
                : "border-orange-500 bg-orange-50"
            }
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {results.failed === 0 ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                )}
                Import Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-3 rounded-lg border">
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    Total
                  </p>
                  <p className="text-2xl font-bold">{results.total}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-green-500">
                  <p className="text-xs text-green-600">Success</p>
                  <p className="text-2xl font-bold text-green-600">
                    {results.success}
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-red-500">
                  <p className="text-xs text-red-600">Failed</p>
                  <p className="text-2xl font-bold text-red-600">
                    {results.failed}
                  </p>
                </div>
              </div>

              {results.failedRows.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2 text-sm">Failed Rows:</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {results.failedRows.map((failedRow, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-2 rounded border border-red-200 text-sm"
                      >
                        <p className="font-medium">
                          Row {failedRow.row}: {failedRow.name}
                        </p>
                        <p className="text-red-600 text-xs">{failedRow.error}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Download Template */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Need a template?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">
              Download the sample CSV file to see the required format:
            </p>
            <Button
              variant="outline"
              onClick={() => {
                const csvContent = `CNIC,Full Name,Father's Name,Email,Phone,Gender,Qualification,District,Training Course,Training Center,Special Case,Special Case Comments
12345-1234567-1,Ali Ahmed,Muhammad Ahmed,ali@example.com,03001234567,Male,Bachelors,Karachi,Web Development,Karachi Center,false,
12346-1234567-2,Fatima Khan,Hassan Khan,fatima@example.com,03109876543,Female,Masters,Lahore,Data Science,Lahore Center,true,Low vision support`;

                const blob = new Blob([csvContent], { type: "text/csv" });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "student-template.csv";
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              }}
            >
              📥 Download Template (CSV)
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BulkImportStudents;
