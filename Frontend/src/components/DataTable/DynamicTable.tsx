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
    <div className="w-full overflow-hidden rounded-2xl bg-[hsl(var(--card))] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-[hsl(var(--border))]">
      <Table containerClassName="max-h-[68vh]">
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="border-0 bg-[hsl(var(--primary)/0.08)] hover:bg-[hsl(var(--primary)/0.08)]">
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
        <TableBody className="border-t-2 border-[hsl(var(--primary)/0.35)]">
          {sortedData.map((item, index) => (
            /*
             * Striping through the theme, not through bg-gray-50/bg-white.
             * Those are fixed light colours, so in dark mode every other row
             * was a white band across a dark page.
             */
            <TableRow
              key={index}
              className="group border-b border-[hsl(var(--border)/0.6)] transition-colors hover:bg-[hsl(var(--primary)/0.05)]"
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
