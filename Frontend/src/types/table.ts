export interface ColumnDef {
  key: string;
  header: string;
  headerClassName?: string;
  className?: string;
  renderCell?: (value: { item: any }) => React.ReactNode;
  sortable?: boolean;
}

export type SortDirection = "asc" | "desc" | null;

export interface SortState {
  column: string | null;
  direction: SortDirection;
}
