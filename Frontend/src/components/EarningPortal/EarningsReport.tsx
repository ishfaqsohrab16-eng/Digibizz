import StatisticsCards from "./StatisticsCards";
import EarningsChart from "./EarningsChart";
import EarningsTable from "./EarningsTable";
import TrainerReport from "./TrainerReport";
import SuccessStoryReport from "./SuccessStoryReport";
import { Button } from "../../components/ui/button";
import { Printer } from "lucide-react";
import { useToast } from "../../components/ui/use-toast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import React from "react";
import GenderDistributionChart from "./GenderDistributionChart";
import { useBatch } from "../../context/BatchContext";

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
    successStories: {
      total: number;
      centerWise: any[];
    };
    trainerStats: any[];
  };
}

const EarningsReport = ({ data }: EarningsReportProps) => {
  const { toast } = useToast();
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
              totalDigital: data.centerWiseEarnings.totalDigital,
              totalAWE: data.centerWiseEarnings.totalAWE,
              totalCreative: data.centerWiseEarnings.totalCreative,
            }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

export default EarningsReport;
