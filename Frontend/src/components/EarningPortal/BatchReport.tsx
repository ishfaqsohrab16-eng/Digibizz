import { useMemo } from "react";
import EarningsReport from "./EarningsReport";
import { buildCourseSeries, courseKey } from "../../utils/courseSeries";
import { useReferenceData } from "../../hooks/useReferenceData";

interface CourseWiseEarning {
  course: string;
  amount: string;
}

interface CourseEarning {
  course: string;
  male: string;
  female: string;
  total: string;
}
interface StudentStatistics {
  totalStudents: number;
  maleCount: number;
  femaleCount: number;
}

interface CenterAnalytics {
  center: string;
  courseEarnings: CourseEarning[];
  totalEarnings: {
    male: string;
    female: string;
    total: string;
  };
}

interface TrainerPerformance {
  trainer: string;
  earnings: string;
  successStories: number;
}

interface BatchReportProps {
  courseWiseEarnings: CourseWiseEarning[];
  centerWiseAnalytics: CenterAnalytics[];
  centerWiseSuccessStories: any[];
  trainerPerformance: TrainerPerformance[];
  studentStatistics: StudentStatistics;
}

/**
 * Reshapes the earnings API payload for the report components.
 *
 * The previous version flattened every center into fixed `digital` / `awe` /
 * `creative` / `technical` fields, so a course renamed in the database landed
 * in none of them and reported zero. Rows are now keyed by the lower-cased
 * course name and the list of courses is derived from the data itself (topped
 * up from the courses table), so renames and additions both flow through.
 */
const BatchReport: React.FC<BatchReportProps> = ({
  centerWiseAnalytics,
  centerWiseSuccessStories,
  trainerPerformance,
  studentStatistics,
}) => {
  const { courses: dbCourses } = useReferenceData();

  const courses = useMemo(
    () =>
      buildCourseSeries(
        [
          ...centerWiseAnalytics.flatMap((center) =>
            (center.courseEarnings || []).map((course) => course.course)
          ),
          ...centerWiseSuccessStories.flatMap((center: any) =>
            (center.courseSuccesses || []).map((entry: any) => entry.course)
          ),
        ],
        dbCourses.map((course) => course.course_name || course.course_full_name)
      ),
    [centerWiseAnalytics, centerWiseSuccessStories, dbCourses]
  );

  const earningsData = useMemo(() => {
    const centers = centerWiseAnalytics.map((center) => {
      const row: Record<string, any> = {
        name: center.center,
        genderWise: {} as Record<string, { male: number; female: number }>,
      };

      // Seed every known course so a center with no earnings in one course
      // still renders a 0 rather than an empty cell.
      for (const course of courses) {
        row[course.key] = 0;
        row.genderWise[course.key] = { male: 0, female: 0 };
      }

      for (const entry of center.courseEarnings || []) {
        const key = courseKey(entry.course);
        row[key] = parseFloat(entry.total) || 0;
        row.genderWise[key] = {
          male: parseFloat(entry.male) || 0,
          female: parseFloat(entry.female) || 0,
        };
      }

      row.total = parseFloat(center.totalEarnings?.total) || 0;
      return row;
    });

    const byCourse = courses.reduce<Record<string, number>>((acc, course) => {
      acc[course.key] = centers.reduce(
        (sum, center) => sum + (Number(center[course.key]) || 0),
        0
      );
      return acc;
    }, {});

    const centerWiseStories = centerWiseSuccessStories.map(
      ({
        center,
        courseSuccesses,
        totalSuccesses,
      }: {
        center: string;
        courseSuccesses: Array<{ course: string; successCount: number }>;
        totalSuccesses: number;
      }) => {
        const row: Record<string, any> = { center, name: center };
        for (const course of courses) row[course.key] = 0;
        for (const entry of courseSuccesses || []) {
          row[courseKey(entry.course)] = Number(entry.successCount) || 0;
        }
        row.total = Number(totalSuccesses) || 0;
        return row;
      }
    );

    return {
      studentStatistics: {
        totalStudents: studentStatistics?.totalStudents || 0,
        maleCount: studentStatistics?.maleCount || 0,
        femaleCount: studentStatistics?.femaleCount || 0,
      },
      centerWiseEarnings: {
        centers,
        byCourse,
        totalEarnings: centers.reduce((sum, center) => sum + center.total, 0),
      },
      successStories: {
        total: centerWiseStories.reduce((sum, center) => sum + center.total, 0),
        centerWise: centerWiseStories,
      },
      trainerStats: trainerPerformance.map((trainer) => ({
        name: trainer.trainer,
        earnings: parseFloat(trainer.earnings) || 0,
        successStories: trainer.successStories,
      })),
    };
  }, [
    courses,
    studentStatistics,
    centerWiseAnalytics,
    centerWiseSuccessStories,
    trainerPerformance,
  ]);

  return <EarningsReport data={earningsData} courses={courses} />;
};

export default BatchReport;
