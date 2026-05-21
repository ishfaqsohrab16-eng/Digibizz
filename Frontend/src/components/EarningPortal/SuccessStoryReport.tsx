import { Card } from "../../components/ui/card";
import { Trophy } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";

interface CenterSuccessStories {
  center: string;
  digital: number;
  awe: number;
  creative: number;
  technical: number;
  total: number;
}

interface SuccessStoryReportProps {
  stories: CenterSuccessStories[];
  total: {
    digital: number;
    awe: number;
    creative: number;
    technical: number;
    total: number;
  };
}

const SuccessStoryReport = ({ stories, total }: SuccessStoryReportProps) => {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-6 w-6 text-report-warning" />
        <h2 className="text-xl font-semibold">Success Story Report</h2>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Centers</TableHead>
              <TableHead className="font-semibold">Digital</TableHead>
              <TableHead className="font-semibold">AWE</TableHead>
              <TableHead className="font-semibold">Creative</TableHead>
              <TableHead className="font-semibold">Technical</TableHead>
              <TableHead className="font-semibold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stories.map((story) => (
              <TableRow
                key={story.center}
                className="transition-colors hover:bg-muted/50 cursor-pointer hover:-translate-y-0.5 duration-200"
              >
                <TableCell className="font-medium">{story.center}</TableCell>
                <TableCell>{story.digital}</TableCell>
                <TableCell>{story.awe}</TableCell>
                <TableCell>{story.creative}</TableCell>
                <TableCell>{story.technical}</TableCell>
                <TableCell className="font-semibold">{story.total}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/10 font-semibold">
              <TableCell>Total</TableCell>
              <TableCell>{total.digital}</TableCell>
              <TableCell>{total.awe}</TableCell>
              <TableCell>{total.creative}</TableCell>
              <TableCell>{total.technical}</TableCell>
              <TableCell>{total.total}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

export default SuccessStoryReport;
