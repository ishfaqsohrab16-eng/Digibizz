import React, { useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import StatisticsCards from "./StatisticsCards";
import EarningsTable from "./EarningsTable";
import TrainerReport from "./TrainerReport";
import SuccessStoryReport from "./SuccessStoryReport";
import { Button } from "../../components/ui/button";
import { Printer } from "lucide-react";
import { useToast } from "../../components/ui/use-toast";
import BatchEarningsChart from "./BatchEarningsChart";
import EarningsChart from "./EarningsChart";
import GenderDistributionChart from "./GenderDistributionChart";

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
      totalDigital: number;
      totalAWE: number;
      totalCreative: number;
      totalTechnical: number;
    };
    batchTrainingStats: any[];
    successStories: {
      total: number;
      centerWise: any[];
    };
    trainerStats: any[];
  };
}

const MasterEarningReport = ({ data }: EarningsReportProps) => {
  const printRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    const element = printRef.current;
    if (!element) {
      setIsGeneratingPdf(false);
      return;
    }

    const canvas = await html2canvas(element, {
      scale: 2,
    });
    const data = canvas.toDataURL("image/png");

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: "a4",
    });

    const imgWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(data, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(data, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save("MasterEarningReport.pdf");
    setIsGeneratingPdf(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 print:p-0 print:bg-white">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Print button outside printable area */}
        <div className="flex justify-between items-center print:hidden">
          <div></div>

          <Button
            onClick={(e) => {
              e.preventDefault();
              handleDownloadPdf();
            }}
            className="hover:-translate-y-1 transition-transform duration-200"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print Report
          </Button>
        </div>

        {/* Printable content wrapped in ref */}
        <div ref={printRef} className="print:p-6">
          {/* Header for print version */}
          <div className="print:block justify-center items-center mb-8">
            <h1 className="text-3xl text-center font-bold text-gray-900">
              Master Earning Report - DigiBizz
            </h1>
            <p className="text-lg text-center text-gray-900 mt-2">
              This report includes all the data since 1st Batch of DigiBizz
            </p>
          </div>

          <StatisticsCards
            statistics={{
              totalEarnings: data.centerWiseEarnings.totalEarnings,
              totalDigital: data.centerWiseEarnings.totalDigital,
              totalAWE: data.centerWiseEarnings.totalAWE,
              totalCreative: data.centerWiseEarnings.totalCreative,
            }}
          />

          {/* Rest of your report content */}
          <div className="grid grid-cols-1 mt-5 lg:grid-cols-1 gap-6">
            <div className="card p-6 bg-white rounded-lg shadow print:shadow-none">
              <h2 className="text-xl font-semibold mb-4">
                Earnings Distribution
              </h2>
              <BatchEarningsChart
                data={data.batchTrainingStats.map((batch) => {
                  const getCourseEarnings = (courseName: string) => {
                    return (batch.centers || []).reduce((total: number, center: { courseEarnings?: { course?: string; total?: string }[] }) => {
                      const course = (center.courseEarnings || []).find(
                        (c: any) =>
                          c.course?.toLowerCase() === courseName.toLowerCase()
                      );
                      return total + (course?.total ? parseFloat(course.total) : 0);
                    }, 0);
                  };

                  return {
                    batchName: batch.batchName || "Unknown Batch",
                    digital: getCourseEarnings("Digital"),
                    awe: getCourseEarnings("AWE"),
                    creative: getCourseEarnings("Creative"),
                    technical: getCourseEarnings("Technical"),
                    total:
                      getCourseEarnings("Digital") +
                      getCourseEarnings("AWE") +
                      getCourseEarnings("Creative") +
                      getCourseEarnings("Technical"),
                  };
                })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 mt-3 lg:grid-cols-2 gap-6">
            <div className="card p-6 bg-white rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">
                Earnings Distribution
              </h2>
              <EarningsChart
                type="bar"
                data={data.centerWiseEarnings.centers.map((center) => ({
                  name: center.name,
                  digital: center.digital,
                  awe: center.awe,
                  creative: center.creative,
                  technical: center.technical,
                }))}
              />
            </div>

            <div className="card p-6 bg-white rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">
                Success Stories Distribution
              </h2>
              <EarningsChart type="bar" data={data.successStories.centerWise} />
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
          <EarningsTable centers={data.centerWiseEarnings.centers} />
          <SuccessStoryReport
            stories={data.successStories.centerWise}
            total={{
              digital: data.successStories.centerWise.reduce(
                (acc, curr) => acc + curr.digital,
                0
              ),
              awe: data.successStories.centerWise.reduce(
                (acc, curr) => acc + curr.awe,
                0
              ),
              creative: data.successStories.centerWise.reduce(
                (acc, curr) => acc + curr.creative,
                0
              ),
              technical: data.successStories.centerWise.reduce(
                (acc, curr) => acc + curr.technical,
                0
              ),
              total: data.successStories.total,
            }}
          />
          <TrainerReport trainers={data.trainerStats} />
        </div>
      </div>
    </div>
  );
};

export default MasterEarningReport;
