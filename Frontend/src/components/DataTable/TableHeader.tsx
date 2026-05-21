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
    if (!isSorted) return <ArrowUpDown size={16} />;
    return sortDirection === "asc" ? (
      <ArrowUp size={16} />
    ) : (
      <ArrowDown size={16} />
    );
  };

  return (
    <TableHead
      className={`${column.headerClassName} ${
        column.sortable ? "cursor-pointer select-none" : ""
      }`}
      onClick={() => column.sortable && onSort(column.key)}
    >
      <div className="flex items-center gap-2">
        {column.header}
        {column.sortable && (
          <span className="text-gray-400 hover:text-gray-600">
            {getSortIcon()}
          </span>
        )}
      </div>
    </TableHead>
  );
};
