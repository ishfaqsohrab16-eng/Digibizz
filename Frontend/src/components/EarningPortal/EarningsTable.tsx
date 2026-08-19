import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { CourseSeries } from "../../utils/courseSeries";

/**
 * Center rows keyed by course.
 *
 * Course amounts live under the lower-cased course name (`row[series.key]`)
 * and the male/female split under `genderWise[series.key]`, so the columns are
 * whatever `courses` says rather than a fixed Digital/AWE/Creative/Technical
 * set.
 */
interface Center {
  name: string;
  total: number;
  genderWise?: Record<string, { male: number; female: number }>;
  [courseKey: string]: any;
}

interface EarningsTableProps {
  centers: Center[];
  courses: CourseSeries[];
}

const money = (value: unknown) => `$${(Number(value) || 0).toLocaleString()}`;

const EarningsTable = ({ centers, courses }: EarningsTableProps) => {
  return (
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
          {centers.map((center) => (
            <TableRow
              key={center.name}
              className="transition-colors hover:bg-muted/50 cursor-pointer"
            >
              <TableCell className="font-medium">{center.name}</TableCell>
              {courses.map((course) => {
                const split = center.genderWise?.[course.key] || {
                  male: 0,
                  female: 0,
                };
                return (
                  <TableCell key={course.key}>
                    <div className="space-y-1">
                      <div>{money(center[course.key])}</div>
                      <div className="text-xs text-muted-foreground">
                        M: {money(split.male)}
                        <br />
                        F: {money(split.female)}
                      </div>
                    </div>
                  </TableCell>
                );
              })}
              <TableCell className="font-semibold">
                {money(center.total)}
              </TableCell>
            </TableRow>
          ))}
          {centers.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={courses.length + 2}
                className="text-center text-muted-foreground py-6"
              >
                No earnings recorded for this batch yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default EarningsTable;
