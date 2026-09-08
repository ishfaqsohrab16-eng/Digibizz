import React from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TableHead } from "../../components/ui/table";
import { ColumnDef, SortDirection } from "../../types/table";

interface TableHeaderProps {
  column: ColumnDef;
  sortColumn: string | null;
  sortDirection: SortDirection;
  onSort: (column: string) => void;
}

export const TableHeaderCell: React.FC<TableHeaderProps> = ({
  column,
  sortColumn,
  sortDirection,
  onSort,
}) => {
  const isSorted = sortColumn === column.key;

  const getSortIcon = () => {
    if (!isSorted) return <ArrowUpDown size={14} />;
    return sortDirection === "asc" ? (
      <ArrowUp size={14} />
    ) : (
      <ArrowDown size={14} />
    );
  };

  return (
    <TableHead
      className={`whitespace-nowrap border-r border-[hsl(var(--primary)/0.12)] px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[hsl(var(--primary))] last:border-r-0 ${
        column.headerClassName || ""
      } ${column.sortable ? "cursor-pointer select-none" : ""}`}
      onClick={() => column.sortable && onSort(column.key)}
      title={column.sortable ? `Sort by ${column.header}` : undefined}
    >
      <div className="flex items-center gap-1.5">
        <span className={isSorted ? "underline underline-offset-4" : ""}>
          {column.header}
        </span>
        {column.sortable && (
          /* Faint until this is the sorted column, so the one that IS
             sorted is the one that stands out. */
          <span className={isSorted ? "" : "opacity-30"}>{getSortIcon()}</span>
        )}
      </div>
    </TableHead>
  );
};
