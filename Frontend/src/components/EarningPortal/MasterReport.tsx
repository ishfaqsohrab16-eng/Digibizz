import { useState, useEffect } from "react";
import MasterEarningReport from "./MasterEarningReport";

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

interface CenterWiseEarnings {
  centers: Array<{
    name: string;
    digital: number;
    awe: number;
    creative: number;
    technical: number;
    total: number;
    genderWise: {
      digital: { male: number; female: number };
      awe: { male: number; female: number };
      creative: { male: number; female: number };
      technical: { male: number; female: number };
    };
  }>;
  totalEarnings: number;
  totalDigital: number;
  totalAWE: number;
  totalCreative: number;
  totalTechnical: number;
}

const MasterReport: React.FC<BatchReportProps> = ({
  courseWiseEarnings,
  centerWiseAnalytics,
  centerWiseSuccessStories,
  trainerPerformance,
  batchTrainingStats,
  studentStatistics,
}) => {
  const [earningsData, setEarningsData] = useState({
    studentStatistics: {
      totalStudents: 0,
      maleCount: 0,
      femaleCount: 0,
    },
    centerWiseEarnings: {
      centers: [],
      totalEarnings: 0,
      totalDigital: 0,
      totalAWE: 0,
      totalCreative: 0,
      totalTechnical: 0,
    } as CenterWiseEarnings,
    batchTrainingStats: [] as any[],
    successStories: {
      total: 0,
      centerWise: [] as any[],
    },
    trainerStats: [] as any[],
  });

  useEffect(() => {
    // Transform centerWiseAnalytics to match the required format
    const centers = centerWiseAnalytics.map((center) => {
      const courseData = center.courseEarnings.reduce(
        (acc, course) => {
          const courseName = course.course.toLowerCase();
          return {
            ...acc,
            [courseName]: parseFloat(course.total) || 0,
            genderWise: {
              ...acc.genderWise,
              [courseName]: {
                male: parseFloat(course.male) || 0,
                female: parseFloat(course.female) || 0,
              },
            },
          };
        },
        {
          digital: 0,
          awe: 0,
          creative: 0,
          technical: 0,
          genderWise: {
            digital: { male: 0, female: 0 },
            awe: { male: 0, female: 0 },
            creative: { male: 0, female: 0 },
            technical: { male: 0, female: 0 },
          },
        }
      );

      return {
        name: center.center,
        ...courseData,
        total: parseFloat(center.totalEarnings.total) || 0,
      };
    });

    // Process batch training stats
    const batchTrainingStatsData = batchTrainingStats.map((batch) => ({
      batchName: batch.batchName,
      totalEarnings: parseFloat(batch.totalEarnings) || 0,
      centers: batch.centerWiseAnalytics.map((center) => ({
        name: center.center,
        courseEarnings: center.courseEarnings.map((course) => ({
          course: course.course,
          male: parseFloat(course.male) || 0,
          female: parseFloat(course.female) || 0,
          total: parseFloat(course.total) || 0,
        })),
        totalEarnings: {
          male: parseFloat(center.totalEarnings.male) || 0,
          female: parseFloat(center.totalEarnings.female) || 0,
          total: parseFloat(center.totalEarnings.total) || 0,
        },
      })),
    }));

    // Calculate course-wise totals
    const totals = centers.reduce(
      (acc, center) => ({
        totalEarnings: acc.totalEarnings + center.total,
        totalDigital: acc.totalDigital + center.digital,
        totalAWE: acc.totalAWE + center.awe,
        totalCreative: acc.totalCreative + center.creative,
        totalTechnical: acc.totalTechnical + center.technical,
      }),
      {
        totalEarnings: 0,
        totalDigital: 0,
        totalAWE: 0,
        totalCreative: 0,
        totalTechnical: 0,
      }
    );

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
        const successMap = {
          Digital: 0,
          AWE: 0,
          Creative: 0,
          Technical: 0,
        };

        // Populate successMap with actual success counts
        courseSuccesses.forEach(
          ({
            course,
            successCount,
          }: {
            course: string;
            successCount: number;
          }) => {
            if (course in successMap) {
              successMap[course as keyof typeof successMap] = successCount;
            }
          }
        );

        return {
          center,
          digital: successMap.Digital || 0,
          awe: successMap.AWE || 0,
          creative: successMap.Creative || 0,
          technical: successMap.Technical || 0,
          total: totalSuccesses || 0,
        };
      }
    );

    // Transform trainerPerformance
    const transformedTrainerStats = trainerPerformance.map((trainer) => ({
      name: trainer.trainer,
      earnings: parseFloat(trainer.earnings) || 0,
      successStories: trainer.successStories,
      successOthers: trainer.successOthers,
    }));

    setEarningsData({
      studentStatistics: {
        totalStudents: studentStatistics.totalStudents || 0,
        maleCount: studentStatistics.maleCount || 0,
        femaleCount: studentStatistics.femaleCount || 0,
      },
      centerWiseEarnings: {
        centers,
        ...totals,
      },
      batchTrainingStats: batchTrainingStatsData,
      successStories: {
        total: centerWiseStories.reduce((sum, center) => sum + center.total, 0),
        centerWise: centerWiseStories,
      },
      trainerStats: transformedTrainerStats,
    });
  }, [
    courseWiseEarnings,
    centerWiseAnalytics,
    centerWiseSuccessStories,
    trainerPerformance,
    batchTrainingStats,
  ]);

  return <MasterEarningReport data={earningsData} />;
};

export default MasterReport;
