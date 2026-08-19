import { useMemo } from "react";
import MasterEarningReport from "./MasterEarningReport";
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
  successOthers: number;
}

interface BatchTrainingStats {
  batchName: string;
  totalEarnings: string;
  centerWiseAnalytics: CenterAnalytics[];
}
interface StudentStatistics {
  totalStudents: number;
  maleCount: number;
  femaleCount: number;
}
interface BatchReportProps {
  courseWiseEarnings: CourseWiseEarning[];
  centerWiseAnalytics: CenterAnalytics[];
  centerWiseSuccessStories: any[];
  trainerPerformance: TrainerPerformance[];
  batchTrainingStats: BatchTrainingStats[];
  studentStatistics: StudentStatistics;
}

/**
 * All-batches version of BatchReport.
 *
 * Same fix: rows are keyed by the lower-cased course name and the course list
 * is derived from the data rather than the hardcoded Digital/AWE/Creative/
 * Technical set, which silently reported zero for any renamed course and could
 * never show a new one.
 */
const MasterReport: React.FC<BatchReportProps> = ({
  centerWiseAnalytics,
  centerWiseSuccessStories,
  trainerPerformance,
  batchTrainingStats,
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
          ...batchTrainingStats.flatMap((batch) =>
            (batch.centerWiseAnalytics || []).flatMap((center) =>
              (center.courseEarnings || []).map((course) => course.course)
            )
          ),
          ...centerWiseSuccessStories.flatMap((center: any) =>
            (center.courseSuccesses || []).map((entry: any) => entry.course)
          ),
        ],
        dbCourses.map((course) => course.course_name || course.course_full_name)
      ),
    [centerWiseAnalytics, batchTrainingStats, centerWiseSuccessStories, dbCourses]
  );

  const earningsData = useMemo(() => {
    const centers = centerWiseAnalytics.map((center) => {
      const row: Record<string, any> = {
        name: center.center,
        genderWise: {} as Record<string, { male: number; female: number }>,
      };

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

    // One flat row per batch, already summed per course, so the chart does not
    // have to re-walk the nested center/course structure.
    const batchTrainingStatsData = batchTrainingStats.map((batch) => {
      const row: Record<string, any> = {
        batchName: batch.batchName || "Unknown Batch",
      };
      for (const course of courses) row[course.key] = 0;

      for (const center of batch.centerWiseAnalytics || []) {
        for (const entry of center.courseEarnings || []) {
          const key = courseKey(entry.course);
          row[key] = (row[key] || 0) + (parseFloat(entry.total) || 0);
        }
      }

      row.total = courses.reduce(
        (sum, course) => sum + (Number(row[course.key]) || 0),
        0
      );
      return row;
    });

    const centerWiseStories = centerWiseSuccessStories.map(
      ({
        center,
        courseSuccesses,
        totalSuccesses,
      }: {
        center: string;
        courseSuccesses: { course: string; successCount: number }[];
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
      batchTrainingStats: batchTrainingStatsData,
      successStories: {
        total: centerWiseStories.reduce((sum, center) => sum + center.total, 0),
        centerWise: centerWiseStories,
      },
      trainerStats: trainerPerformance.map((trainer) => ({
        name: trainer.trainer,
        earnings: parseFloat(trainer.earnings) || 0,
        successStories: trainer.successStories,
        successOthers: trainer.successOthers,
      })),
    };
  }, [
    courses,
    studentStatistics,
    centerWiseAnalytics,
    centerWiseSuccessStories,
    trainerPerformance,
    batchTrainingStats,
  ]);

  return <MasterEarningReport data={earningsData} courses={courses} />;
};

export default MasterReport;
