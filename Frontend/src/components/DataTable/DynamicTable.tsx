import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { DataTableCell } from "./DataTableCell";
import { TableHeaderCell } from "./TableHeader";
import { ColumnDef, SortState } from "../../types/table";
import { sortData } from "../../utils/sorting";

interface DynamicTableProps<T> {
  columns: ColumnDef[];
  data: T[];
  onEdit?: (item: T) => void;
  onView?: (item: T) => void;
}

export function DynamicTable<T extends {}>({
  columns,
  data,
  onEdit,
  onView,
}: DynamicTableProps<T>) {
  const [sort, setSort] = useState<SortState>({
    column: null,
    direction: null,
  });

  const handleSort = (column: string) => {
    setSort((prev) => ({
      column,
      direction:
        prev.column === column
          ? prev.direction === "asc"
            ? "desc"
            : prev.direction === "desc"
            ? null
            : "asc"
          : "asc",
    }));
  };

  const sortedData = useMemo(
    () => sortData(data, sort.column, sort.direction),
    [data, sort.column, sort.direction]
  );

  return (
    <div className="w-full overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
      <Table containerClassName="max-h-[70vh]">
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] hover:bg-[hsl(var(--muted))]">
            {columns.map((column, index) => (
              <TableHeaderCell
                key={index}
                column={column}
                sortColumn={sort.column}
                sortDirection={sort.direction}
                onSort={handleSort}
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((item, index) => (
            /*
             * Striping through the theme, not through bg-gray-50/bg-white.
             * Those are fixed light colours, so in dark mode every other row
             * was a white band across a dark page.
             */
            <TableRow
              key={index}
              className="border-b border-[hsl(var(--border))] transition-colors even:bg-[hsl(var(--muted))/0.35] hover:bg-[hsl(var(--primary))/0.06]"
            >
              {columns.map((column) => (
                <DataTableCell
                  key={`${index}-${column.key}`}
                  column={column}
                  value={
                    column.key === "actions"
                      ? { item, onEdit, onView }
                      : column.renderCell
                      ? { item }
                      : item[column.key as keyof T]
                  }
                />
              ))}
            </TableRow>
          ))}
          {sortedData.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-40 text-center text-sm text-[hsl(var(--muted-foreground))]"
              >
                Nothing to show yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
