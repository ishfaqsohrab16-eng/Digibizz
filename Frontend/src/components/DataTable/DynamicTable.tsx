import React, { useState, useMemo } from "react";
import { Table, TableBody, TableHeader, TableRow } from "../../components/ui/table";
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
    <Table>
      <TableHeader>
        <TableRow>
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
          <TableRow
            key={index}
            className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}
          >
            {columns.map((column, columnIndex) => (
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
      </TableBody>
    </Table>
  );
}
