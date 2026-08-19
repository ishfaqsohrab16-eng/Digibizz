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
import { CourseSeries, sumByCourse } from "../../utils/courseSeries";

/** Story counts live under the lower-cased course name, e.g. `row["creative"]`. */
interface CenterSuccessStories {
  center: string;
  total: number;
  [courseKey: string]: any;
}

interface SuccessStoryReportProps {
  stories: CenterSuccessStories[];
  /** Columns to render; the totals row is derived from `stories`. */
  courses: CourseSeries[];
  /** Grand total across all centers and courses. */
  total: number;
}

const SuccessStoryReport = ({
  stories,
  courses,
  total,
}: SuccessStoryReportProps) => {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="h-6 w-6 text-report-warning" />
        <h2 className="text-xl font-semibold">Success Story Report</h2>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Centers</TableHead>
              {courses.map((course) => (
                <TableHead key={course.key} className="font-semibold">
                  {course.label}
                </TableHead>
              ))}
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
                {courses.map((course) => (
                  <TableCell key={course.key}>
                    {Number(story[course.key]) || 0}
                  </TableCell>
                ))}
                <TableCell className="font-semibold">
                  {Number(story.total) || 0}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/10 font-semibold">
              <TableCell>Total</TableCell>
              {courses.map((course) => (
                <TableCell key={course.key}>
                  {sumByCourse(stories, course.key)}
                </TableCell>
              ))}
              <TableCell>{total}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

export default SuccessStoryReport;
