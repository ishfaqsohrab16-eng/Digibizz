import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";

interface Center {
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
}

interface EarningsTableProps {
  centers: Center[];
}

const EarningsTable = ({ centers }: EarningsTableProps) => {
  return (
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
          {centers.map((center) => (
            <TableRow
              key={center.name}
              className="transition-colors hover:bg-muted/50 cursor-pointer"
            >
              <TableCell className="font-medium">{center.name}</TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div>${center.digital.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">
                    M: ${center.genderWise.digital.male.toLocaleString()}
                    <br />
                    F: ${center.genderWise.digital.female.toLocaleString()}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div>${center.awe.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">
                    M: ${center.genderWise.awe.male.toLocaleString()}
                    <br />
                    F: ${center.genderWise.awe.female.toLocaleString()}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div>${center.creative.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">
                    M: ${center.genderWise.creative.male.toLocaleString()}
                    <br />
                    F: ${center.genderWise.creative.female.toLocaleString()}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div>${center.technical.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">
                    M: ${center.genderWise.technical.male.toLocaleString()}
                    <br />
                    F: ${center.genderWise.technical.female.toLocaleString()}
                  </div>
                </div>
              </TableCell>
              <TableCell className="font-semibold">
                ${center.total.toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default EarningsTable;
