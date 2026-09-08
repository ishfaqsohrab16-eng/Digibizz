import { useEffect } from "react";
import { TableCell as UITableCell } from "../../components/ui/table";
import { ColumnDef } from "../../types/table";

interface DataTableCellProps {
  column: ColumnDef;
  value: any;
}
const isDate = (value: any): boolean => {
  const date = new Date(value);

  return value && date instanceof Date && !isNaN(date.getTime());
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};
export const DataTableCell: React.FC<DataTableCellProps> = ({
  column,
  value,
}) => {
  if (column.renderCell) {
    return <UITableCell>{column.renderCell(value)}</UITableCell>;
  }
  if (
    value &&
    ((isDate(value) && column.key === "tb_start") || column.key === "tb_end")
  ) {
    return (
      <UITableCell
        className={`whitespace-nowrap px-4 py-3 text-sm tabular-nums ${
          column.className || ""
        }`}
      >
        {formatDate(value.toString())}
      </UITableCell>
    );
  }
  var keyChick = String(column.key);
  if (keyChick.includes("status")) {
    const active = value === 1;

    return (
      <UITableCell className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
            active
              ? "bg-[hsl(var(--teal-light))] text-[hsl(var(--teal))] ring-[hsl(var(--teal))/0.25]"
              : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] ring-[hsl(var(--border))]"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              active ? "bg-[hsl(var(--teal))]" : "bg-[hsl(var(--muted-foreground))]"
            }`}
          />
          {active ? "Active" : "Inactive"}
        </span>
      </UITableCell>
    );
  }
  return (
    <UITableCell className={`px-4 py-3 text-sm ${column.className || ""}`}>
      {value}
    </UITableCell>
  );
};
