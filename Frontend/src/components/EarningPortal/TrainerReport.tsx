import { Card } from "../../components/ui/card";
import { Award, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";

interface TrainerStats {
  name: string;
  earnings: number;
  successStories: number;
}

interface TrainerReportProps {
  trainers: TrainerStats[];
}

const TrainerReport = ({ trainers }: TrainerReportProps) => {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Award className="h-6 w-6 text-report-primary" />
        <h2 className="text-xl font-semibold">
          Earning & Success Stories Report by Trainers
        </h2>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Trainer</TableHead>
              <TableHead className="font-semibold">Earning</TableHead>
              <TableHead className="font-semibold">Success Stories</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trainers.map((trainer, index) => (
              <TableRow
                key={index}
                className="transition-colors hover:bg-muted/50 cursor-pointer hover:-translate-y-0.5 duration-200"
              >
                <TableCell className="font-medium">{trainer.name}</TableCell>
                <TableCell>${trainer.earnings.toLocaleString()}</TableCell>
                <TableCell>{trainer.successStories}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

export default TrainerReport;
