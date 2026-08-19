import StatisticsCards from "./StatisticsCards";
import EarningsChart from "./EarningsChart";
import EarningsTable from "./EarningsTable";
import TrainerReport from "./TrainerReport";
import SuccessStoryReport from "./SuccessStoryReport";
import { Button } from "../../components/ui/button";
import { Printer } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import React from "react";
import GenderDistributionChart from "./GenderDistributionChart";
import { useBatch } from "../../context/BatchContext";
import { CourseSeries } from "../../utils/courseSeries";

interface EarningsReportProps {
  data: {
    studentStatistics: {
      maleCount: number;
      femaleCount: number;
      totalStudents: number;
    };
    centerWiseEarnings: {
      centers: any[];
      totalEarnings: number;
      /** Earnings per course keyed by lower-cased course name. */
      byCourse?: Record<string, number>;
    };
    successStories: {
      total: number;
      centerWise: any[];
    };
    trainerStats: any[];
  };
  /** Courses to chart and tabulate, derived from the data + courses table. */
  courses: CourseSeries[];
}

const EarningsReport = ({ data, courses }: EarningsReportProps) => {
  const printRef = React.useRef(null);
  const { selectedBatchName } = useBatch();

  const handleDownloadPdf = async () => {
    const element = printRef.current;
    if (!element) {
      return;
    }
    const canvas = await html2canvas(element, {
      scale: 2,
    });
    const dataUrl = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: "a4",
    });

    const imgWidth = pdf.internal.pageSize.getWidth();
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(dataUrl, "PNG", 0, 0, imgWidth, imgHeight);
    pdf.save("BatchEarningReport.pdf");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 print:p-0 print:bg-white">
      <div ref={printRef} className="print:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl m-5 font-bold text-gray-900">
                {`DigiBizz Earning Report - ${selectedBatchName}`}
              </h1>
            </div>
            <Button
              onClick={handleDownloadPdf}
              className="print:hidden hover:-translate-y-1 transition-transform duration-200"
            >
              <Printer className="mr-2 h-4 w-4" />
              Print Report
            </Button>
          </div>

          <StatisticsCards
            statistics={{
              totalEarnings: data.centerWiseEarnings.totalEarnings,
              byCourse: data.centerWiseEarnings.byCourse,
            }}
            courses={courses}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6 bg-white rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">
                Earnings Distribution
              </h2>
              <EarningsChart
                type="bar"
                courses={courses}
                data={data.centerWiseEarnings.centers}
              />
            </div>

            <div className="card p-6 bg-white rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">
                Success Stories Distribution
              </h2>
              <EarningsChart
                type="bar"
                courses={courses}
                data={data.successStories.centerWise}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 mt-2 lg:grid-cols-3 gap-6">
            <div className="card p-6 bg-white rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">
                Student Gender Distribution
              </h2>
              {data.studentStatistics && (
                <GenderDistributionChart
                  maleCount={data.studentStatistics.maleCount}
                  femaleCount={data.studentStatistics.femaleCount}
                />
              )}
            </div>
          </div>

          <EarningsTable
            centers={data.centerWiseEarnings.centers}
            courses={courses}
          />

          <SuccessStoryReport
            stories={data.successStories.centerWise}
            courses={courses}
            total={data.successStories.total}
          />

          <TrainerReport trainers={data.trainerStats} />
        </div>
      </div>
    </div>
  );
};

export default EarningsReport;
