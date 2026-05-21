import React, { useState, useEffect } from "react";
import { getExamAssessmentAll } from "../../services/api";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Loader2, Download } from "lucide-react";
import { Button } from "../ui/button";
import SettingsHeader from "../Settings/SettingsHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import * as XLSX from "xlsx";

interface Graduate {
  ea_id: number;
  std_cnic: string;
  tb_id: number;
  center_id: number;
  course_id: number;
  total_score: string;
  ea_type: string;
  training_batches: {
    tb_name: string;
    tb_slug: string;
  };
  centers: {
    center_name: string;
    center_location: string;
  };
  courses: {
    course_name: string;
    course_full_name: string;
  };
  student: {
    std_gender: string;
    std_district: string;
    user: {
      user_name: string;
    };
  };
}

interface BatchWiseData {
  batch: string;
  count: number;
}

interface CourseWiseData {
  course: string;
  male: number;
  female: number;
  total: number;
}

interface CenterCourseData {
  center: string;
  course: string;
  batch: string;
  male: number;
  female: number;
  total: number;
}

interface PivotedTableData {
  batch: string;
  center: string;
  courseData: Record<string, { male: number; female: number }>;
  total: number;
}

interface GenderDistribution {
  name: string;
  value: number;
}

const MasterReportDashboard: React.FC = () => {
  const [, setGraduates] = useState<Graduate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [batchWiseData, setBatchWiseData] = useState<BatchWiseData[]>([]);
  const [courseWiseData, setCourseWiseData] = useState<CourseWiseData[]>([]);
  const [, setCenterCourseData] = useState<CenterCourseData[]>([]);
  const [pivotedTableData, setPivotedTableData] = useState<PivotedTableData[]>([]);
  const [uniqueCourses, setUniqueCourses] = useState<string[]>([]);
  const [genderDistribution, setGenderDistribution] = useState<GenderDistribution[]>([]);
  const [stats, setStats] = useState({
    totalGraduates: 0,
    totalMale: 0,
    totalFemale: 0,
    totalBatches: 0,
    totalCenters: 0,
    totalCourses: 0,
  });

  useEffect(() => {
    fetchGraduateData();
  }, []);

  const fetchGraduateData = async () => {
    setIsLoading(true);
    try {
      const response = await getExamAssessmentAll();
      if (response.success) {
        const graduateData = response.data;
        setGraduates(graduateData);
        processData(graduateData);
      } else {
        toast.error("Failed to fetch graduate data");
      }
    } catch (error) {
      console.error("Error fetching graduate data:", error);
      toast.error("An error occurred while fetching data");
    } finally {
      setIsLoading(false);
    }
  };

  const processData = (data: Graduate[]) => {
    // Process Batch-wise data
    const batchMap = new Map<string, number>();
    const courseMap = new Map<string, { male: number; female: number }>();
    const centerCourseMap = new Map<string, { male: number; female: number; batch: string; center: string; course: string }>();
    const centerSet = new Set<string>();
    const courseSet = new Set<string>();
    let maleCount = 0;
    let femaleCount = 0;

    data.forEach((graduate) => {
      const batch = graduate.training_batches?.tb_name || "Unknown Batch";
      const course = graduate.courses?.course_name || "Unknown Course";
      const center = graduate.centers?.center_name || "Unknown Center";
      const gender = (graduate.student?.std_gender || "Unknown").toLowerCase().trim();
      const key = `${batch}-${center}-${course}`;

      // Batch-wise count
      batchMap.set(batch, (batchMap.get(batch) || 0) + 1);

      // Course-wise gender count
      if (!courseMap.has(course)) {
        courseMap.set(course, { male: 0, female: 0 });
      }
      const courseData = courseMap.get(course)!;
      if (gender === "male") {
        courseData.male += 1;
        maleCount += 1;
      } else if (gender === "female") {
        courseData.female += 1;
        femaleCount += 1;
      }

      // Center-Course-Batch combination
      if (!centerCourseMap.has(key)) {
        centerCourseMap.set(key, { male: 0, female: 0, batch, center, course });
      }
      const ccData = centerCourseMap.get(key)!;
      if (gender === "male") {
        ccData.male += 1;
      } else if (gender === "female") {
        ccData.female += 1;
      }

      centerSet.add(center);
      courseSet.add(course);
    });

    // Convert to arrays
    const batchData: BatchWiseData[] = Array.from(batchMap.entries()).map(
      ([batch, count]) => ({
        batch,
        count,
      })
    );

    const courseData: CourseWiseData[] = Array.from(courseMap.entries()).map(
      ([course, counts]) => ({
        course,
        male: counts.male,
        female: counts.female,
        total: counts.male + counts.female,
      })
    );

    const centerCourseDataArray: CenterCourseData[] = Array.from(
      centerCourseMap.entries()
    ).map(([, counts]) => {
      return {
        batch: counts.batch,
        center: counts.center,
        course: counts.course,
        male: counts.male,
        female: counts.female,
        total: counts.male + counts.female,
      };
    });

    // Sort by total descending
    centerCourseDataArray.sort((a, b) => b.total - a.total);

    // Create pivoted table data (grouped by batch-center)
    const batchCenterMap = new Map<string, PivotedTableData>();
    const coursesSet = new Set<string>();

    centerCourseDataArray.forEach((row) => {
      const key = `${row.batch}-${row.center}`;
      coursesSet.add(row.course);

      if (!batchCenterMap.has(key)) {
        batchCenterMap.set(key, {
          batch: row.batch,
          center: row.center,
          courseData: {},
          total: 0,
        });
      }

      const entry = batchCenterMap.get(key)!;
      entry.courseData[row.course] = {
        male: row.male,
        female: row.female,
      };
      entry.total += row.total;
    });

    // Sort pivoted data by batch number first, then by center
    const pivotedData = Array.from(batchCenterMap.values()).sort((a, b) => {
      // Extract batch number from batch name (e.g., "Training Batch 1" -> 1)
      const aBatchNum = parseInt(a.batch.replace(/\D/g, '')) || 0;
      const bBatchNum = parseInt(b.batch.replace(/\D/g, '')) || 0;
      
      if (aBatchNum !== bBatchNum) {
        return aBatchNum - bBatchNum;
      }
      
      // If batch numbers are the same, sort by center name
      return a.center.localeCompare(b.center);
    });
    
    const sortedCourses = Array.from(coursesSet).sort();

    setBatchWiseData(batchData);
    setCourseWiseData(courseData);
    setCenterCourseData(centerCourseDataArray);
    setPivotedTableData(pivotedData);
    setUniqueCourses(sortedCourses);
    setGenderDistribution([
      { name: "Male", value: maleCount },
      { name: "Female", value: femaleCount },
    ]);
    setStats({
      totalGraduates: data.length,
      totalMale: maleCount,
      totalFemale: femaleCount,
      totalBatches: batchMap.size,
      totalCenters: centerSet.size,
      totalCourses: courseSet.size,
    });
  };

  const exportToExcel = () => {
    try {
      // Prepare data for Excel export in pivoted format
      const exportData = pivotedTableData.map((row) => {
        const rowData: Record<string, any> = {
          Batch: row.batch,
          Center: row.center,
        };

        // Add course columns
        uniqueCourses.forEach((course) => {
          const courseStats = row.courseData[course];
          if (courseStats) {
            rowData[`${course} (M)`] = courseStats.male;
            rowData[`${course} (F)`] = courseStats.female;
          } else {
            rowData[`${course} (M)`] = 0;
            rowData[`${course} (F)`] = 0;
          }
        });

        rowData["Total"] = row.total;
        return rowData;
      });

      // Create workbook and add worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Batch Center Breakdown");

      // Add Course Summary sheet
      const courseSummaryData = courseWiseData.map((row) => ({
        Course: row.course,
        Male: row.male,
        Female: row.female,
        Total: row.total,
        Percentage: `${((row.total / stats.totalGraduates) * 100).toFixed(1)}%`,
      }));
      const ws2 = XLSX.utils.json_to_sheet(courseSummaryData);
      XLSX.utils.book_append_sheet(wb, ws2, "Course Summary");

      // Add Summary Statistics sheet
      const summaryStats = [
        { Metric: "Total Graduates", Value: stats.totalGraduates },
        { Metric: "Total Male", Value: stats.totalMale },
        { Metric: "Total Female", Value: stats.totalFemale },
        { Metric: "Total Batches", Value: stats.totalBatches },
        { Metric: "Total Centers", Value: stats.totalCenters },
        { Metric: "Total Courses", Value: stats.totalCourses },
      ];
      const ws3 = XLSX.utils.json_to_sheet(summaryStats);
      XLSX.utils.book_append_sheet(wb, ws3, "Summary");

      // Set column widths
      const colWidths = [
        { wch: 20 }, // Batch
        { wch: 25 }, // Center
      ];
      // Add widths for course columns
      uniqueCourses.forEach(() => {
        colWidths.push({ wch: 12 }); // Course M
        colWidths.push({ wch: 12 }); // Course F
      });
      colWidths.push({ wch: 10 }); // Total

      ws["!cols"] = colWidths;

      ws2["!cols"] = [
        { wch: 25 }, // Course
        { wch: 10 }, // Male
        { wch: 10 }, // Female
        { wch: 10 }, // Total
        { wch: 15 }, // Percentage
      ];

      ws3["!cols"] = [
        { wch: 20 }, // Metric
        { wch: 15 }, // Value
      ];

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split("T")[0];
      const filename = `Master_Report_${timestamp}.xlsx`;

      // Write file
      XLSX.writeFile(wb, filename);
      toast.success("Report exported successfully!");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Failed to export report");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-8xl mx-auto p-6 space-y-6">
      <SettingsHeader
        SettingsHeader="Master Report Dashboard"
        SettingDescription="Comprehensive overview of all graduates across batches, centers, and courses"
      />

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Graduates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {stats.totalGraduates}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Male
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.totalMale}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Female
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-pink-600">
              {stats.totalFemale}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Batches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {stats.totalBatches}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Centers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.totalCenters}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Courses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.totalCourses}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Batch-wise and Gender Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Batch-wise Graduates Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Batch-wise Graduates</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={batchWiseData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="batch"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 12 }}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#10b981" name="Graduates" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gender Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Gender Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={genderDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value, percent }) =>
                    `${name}: ${value} (${(percent * 100).toFixed(1)}%)`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {genderDistribution.map((_entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === 0 ? "#3b82f6" : "#ec4899"}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Course-wise Gender Distribution Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Course-wise Gender Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={courseWiseData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="course" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="male" fill="#3b82f6" name="Male" />
              <Bar dataKey="female" fill="#ec4899" name="Female" />
              <Bar dataKey="total" fill="#10b981" name="Total" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Center-wise Course Distribution Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Center & Course-wise Graduate Breakdown</CardTitle>
          <Button
            onClick={exportToExcel}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            size="sm"
          >
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Batch Name</TableHead>
                  <TableHead className="w-[200px]">Center Name</TableHead>
                  {uniqueCourses.map((course) => (
                    <TableHead key={course} className="text-center min-w-[120px]">
                      {course}
                    </TableHead>
                  ))}
                  <TableHead className="text-right min-w-[80px]">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pivotedTableData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{row.batch}</TableCell>
                    <TableCell className="font-medium">{row.center}</TableCell>
                    {uniqueCourses.map((course) => {
                      const courseStats = row.courseData[course];
                      return (
                        <TableCell key={course} className="text-center">
                          {courseStats ? (
                            <div className="flex flex-col text-sm">
                              <span className="text-blue-600 font-semibold">
                                M: {courseStats.male}
                              </span>
                              <span className="text-pink-600 font-semibold">
                                F: {courseStats.female}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right text-emerald-600 font-bold">
                      {row.total}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Table by Course */}
      <Card>
        <CardHeader>
          <CardTitle>Course Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course Name</TableHead>
                  <TableHead className="text-right">Male</TableHead>
                  <TableHead className="text-right">Female</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Percentage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courseWiseData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{row.course}</TableCell>
                    <TableCell className="text-right text-blue-600 font-semibold">
                      {row.male}
                    </TableCell>
                    <TableCell className="text-right text-pink-600 font-semibold">
                      {row.female}
                    </TableCell>
                    <TableCell className="text-right text-emerald-600 font-bold">
                      {row.total}
                    </TableCell>
                    <TableCell className="text-right">
                      {((row.total / stats.totalGraduates) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MasterReportDashboard;
