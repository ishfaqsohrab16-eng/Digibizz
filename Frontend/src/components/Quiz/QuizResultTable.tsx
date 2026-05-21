import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import SettingsHeader from "../Settings/SettingsHeader";

interface Student {
  cnic: string;
  name: string;
  email: string;
}

interface Result {
  student: Student;
  marks_obtained: string;
  status: string;
  attempt_date: string;
  start_time: string;
  end_time: string;
}

interface QuizResultTableProps {
  quizTitle: string;
  quizPassingScore: number;
  totalAttempts: number;
  results: Result[];
}

const QuizResultTable: React.FC = () => {
  const quizResulte = JSON.parse(localStorage.getItem("selectedQuizResult") || "{}");
  console.log("quizResulte", quizResulte); // Debugging log
  const quizTitle = quizResulte.quiz_title || "Unknown Quiz";
  const quizPassingScore = quizResulte.quiz_passing_score || 0;
  const totalAttempts = quizResulte.total_attempts || 0;
  const results = quizResulte.results || [];
  const quizResults = results.map((result: any) => ({
    student: {
      cnic: result.student.cnic,
      name: result.student.name,
      email: result.student.email,
    },
    marks_obtained: result.marks_obtained,
    status: result.status,
    attempt_date: result.attempt_date,
    start_time: result.start_time,
    end_time: result.end_time,
  }));
  return (
    <div
      className="container mx-auto mt-5 p-6 max-w-6xl"
      style={{ backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }}
    >
        <SettingsHeader
            SettingsHeader="Quiz Manager"
            SettingDescription="Create and manage your quizzes to assess student learning. Set questions, time limits, and passing criteria to evaluate student performance."
        />
      <div
        className="bg-gradient-to-r rounded-xl shadow-md p-8 border"
        style={{
          backgroundColor: "hsl(var(--card))",
          borderColor: "hsl(var(--border))",
        }}
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "hsl(var(--foreground))" }}>
            {quizTitle}
          </h1>
          <p className="text-gray-600" style={{ color: "hsl(var(--muted-foreground))" }}>
            Passing Score: <strong>{quizPassingScore}%</strong> | Total Attempts: <strong>{totalAttempts}</strong>
          </p>
        </div>
        <div
          className="overflow-x-auto rounded-lg border shadow-sm"
          style={{
            backgroundColor: "hsl(var(--card))",
            borderColor: "hsl(var(--border))",
          }}
        >
          <Table>
            <TableHeader className="bg-gray-50" style={{ backgroundColor: "hsl(var(--muted))" }}>
              <TableRow>
                <TableHead className="font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Student Name
                </TableHead>
                <TableHead className="font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Email
                </TableHead>
                <TableHead className="font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
                  CNIC
                </TableHead>
                <TableHead className="font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Marks Obtained
                </TableHead>
                <TableHead className="font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Status
                </TableHead>
                <TableHead className="font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Attempt Date
                </TableHead>
                <TableHead className="font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Start Time
                </TableHead>
                <TableHead className="font-semibold" style={{ color: "hsl(var(--muted-foreground))" }}>
                  End Time
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quizResults.map((result: Result, index: number) => (
                <TableRow
                  key={index}
                  className="border-b hover:bg-blue-50 transition-colors duration-200"
                  style={{
                    borderColor: "hsl(var(--border))",
                    backgroundColor: "hsl(var(--background))",
                  }}
                >
                  <TableCell>{result.student.name}</TableCell>
                  <TableCell>{result.student.email}</TableCell>
                  <TableCell>{result.student.cnic}</TableCell>
                  <TableCell>{result.marks_obtained}</TableCell>
                  <TableCell>
                    <Badge
                      variant={result.status === "PASS" ? "default" : "destructive"}
                      style={{
                        backgroundColor:
                          result.status === "PASS"
                            ? "hsl(var(--primary))"
                            : "hsl(var(--pink))",
                        color: "hsl(var(--primary-foreground))",
                      }}
                    >
                      {result.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{result.attempt_date}</TableCell>
                  <TableCell>{result.start_time}</TableCell>
                  <TableCell>{result.end_time}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default QuizResultTable;
