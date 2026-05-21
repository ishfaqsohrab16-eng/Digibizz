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
      <td className={`px-6 py-4 whitespace-nowrap ${column.className}`}>
        {formatDate(value.toString())}
      </td>
    );
  }
  var keyChick = String(column.key);
  if (keyChick.includes("status")) {
    const statusText = value === 1 ? "Active" : "Inactive";
    const statusClass =
      value === 1 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";

    return (
      <UITableCell>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass}`}
        >
          {statusText}
        </span>
      </UITableCell>
    );
  }
  return <UITableCell className={column.className}>{value}</UITableCell>;
};
