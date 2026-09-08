import { useState, useEffect, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Download,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  Inbox,
  LogIn,
  Mail,
  Pencil,
  Rows3,
  Rows4,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { ColumnSelector } from "./ColumnSelector";
import {
  StudentData,
  Column,
  FilterStatus,
  FilterBy,
} from "../../types/columns";
import { sortData, filterData } from "../../utils/tableUtils";
import PersonAvatar from "../ui/PersonAvatar";

/**
 * The table every list in the LMS is drawn with.
 *
 * Thirty screens render through this one component, so what it looks like is
 * what the product looks like. It is drawn as a SHEET rather than a boxed-in
 * grid: no heavy frame, no zebra banding, one hairline between rows, and the
 * weight moved off the container and onto the data sitting in it.
 *
 *   THE HEADER IS THE ANCHOR - tinted with the brand colour, ruled underneath,
 *   set in small wide capitals, and pinned while the body scrolls. A table of
 *   four hundred trainees is unreadable once the column names have gone.
 *
 *   THE HOVERED ROW IS MARKED DOWN ITS LEADING EDGE. Following one record
 *   across eight columns is the whole job, and a bar at the start of the row
 *   holds the eye better than a change of background on its own.
 *
 *   HAIRLINES BETWEEN COLUMNS, because these tables are wide and the eye needs
 *   rails when it travels sideways.
 *
 *   ROW ACTIONS STAY FAINT until the row is under the cursor. Four identical
 *   icons repeated down two hundred rows is noise, and it competes with the
 *   data for exactly the attention the data needs.
 *
 * Everything about WHICH data appears is unchanged - the props below are the
 * same ones the thirty callers already pass.
 *
 * Colours come from theme tokens throughout. Several themes ship here and some
 * of them invert - --navy is dark in one and pale in another - so anything
 * hard-coded is unreadable in at least one of them.
 */

interface DataTableProps {
  data: any[];
  columns: Column[];
  filterBy?: FilterBy[];
  filterStatus?: any;
  setColumns: (columns: Column[]) => void;
  setFilterStatus?: (filterStatus: any) => void;
  isActionBtn?: boolean;
  isProofBtn?: boolean;
  isEarningStatusBtn?: boolean;
  isEarningStatusChangedBtn?: number;
  onView?: (row: any) => void;
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onEmail?: (row: any) => void;
  onLogin?: (row: any) => void;
  onDownloadProof?: (row: any) => void;
  onEarningStatus?: (row: any) => void;
  onEarningStatusChange?: (row: any, status: string) => void;
  photo?: string;
  isLoading?: boolean;
  isLink?: boolean;
  linkColumn?: string;
  logInAsSubUser?: string;
  currentPage?: number;
  setCurrentPage?: (page: number) => void;
  /**
   * Optional extra action rendered as its own column, e.g. "Enroll" for
   * recommended candidates. `isEnabled` decides per row whether the button is
   * clickable; rows that fail it show a disabled button rather than nothing,
   * so the column stays aligned.
   */
  rowAction?: {
    label: string;
    onClick: (row: any) => void;
    isEnabled?: (row: any) => boolean;
  };
}

/** Page sizes worth offering: a screenful, a scroll, and a whole class. */
const PAGE_SIZES = [15, 30, 60, 120];

const CHARACTER_LIMIT = 80;

/**
 * The name and gender on a row, whatever this particular table calls them.
 *
 * One component serves candidates, students, trainers and centre managers, and
 * each names these differently.
 */
const NAME_KEYS = ["user_name", "cand_name", "t_name", "name", "std_name", "title"];
const GENDER_KEYS = ["std_gender", "cand_gender", "gender", "user_gender"];

const firstValue = (row: any, keys: string[]) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "";
};

/** Values that should line up digit-for-digit down a column. */
const looksNumeric = (value: any) =>
  typeof value === "number" ||
  (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value)));

/**
 * The page numbers to offer: the ends, the neighbours, and gaps for the rest.
 *
 * "Page 7 of 40" says where you are and offers one step either way. Numbers
 * let somebody jump, which is what people actually do with a list they are
 * working through.
 */
const pageWindow = (current: number, total: number): (number | "gap")[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current]);
  if (current - 1 > 1) pages.add(current - 1);
  if (current + 1 < total) pages.add(current + 1);
  if (current <= 3) [2, 3, 4].forEach((p) => p < total && pages.add(p));
  if (current >= total - 2)
    [total - 3, total - 2, total - 1].forEach((p) => p > 1 && pages.add(p));

  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) out.push("gap");
    out.push(page);
  });
  return out;
};

export function DataTable({
  data,
  columns,
  filterStatus,
  setColumns,
  setFilterStatus,
  isActionBtn = false,
  isProofBtn = false,
  isEarningStatusBtn = false,
  onView,
  onEdit,
  onDelete,
  onEmail,
  onLogin,
  onEarningStatusChange,
  photo,
  filterBy,
  isLoading = false,
  isLink = false,
  linkColumn,
  logInAsSubUser,
  rowAction,
  currentPage: propCurrentPage,
  setCurrentPage: propSetCurrentPage,
}: DataTableProps) {
  // Use internal state if props are not provided
  const [internalCurrentPage, internalSetCurrentPage] = useState(1);
  const currentPage = propCurrentPage ?? internalCurrentPage;
  const setCurrentPage = propSetCurrentPage ?? internalSetCurrentPage;

  const [sortConfig, setSortConfig] = useState<{
    key: keyof any;
    direction: "asc" | "desc";
  } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(30);
  /** A wide table is worked through differently from a short one. */
  const [compact, setCompact] = useState(false);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  const filteredData = useMemo(() => {
    let processed = [...data];
    processed = filterData(processed, filterStatus || "all");

    const term = searchTerm.trim().toLowerCase();
    if (term) {
      const terms = term.split(/\s+/);
      const visible = columns.filter((col) => col.visible);
      processed = processed.filter((item) =>
        terms.every((word) =>
          visible.some((column) => {
            const value = item[column.id];
            return value != null && String(value).toLowerCase().includes(word);
          })
        )
      );
    }

    if (sortConfig) {
      processed = sortData(processed, sortConfig.key, sortConfig.direction);
    }
    return processed;
    // `columns` belongs here: the search only looks at visible ones, so hiding
    // a column has to re-run it.
  }, [data, columns, filterStatus, searchTerm, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));

  /**
   * Searching from page 5 used to leave you looking at an empty table, because
   * the filtered results no longer reached that far.
   */
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages, currentPage, setCurrentPage]);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const handleSort = (key: keyof any) => {
    setSortConfig({
      key,
      direction:
        sortConfig?.key === key && sortConfig.direction === "asc" ? "desc" : "asc",
    });
  };

  const toggleColumn = (columnId: string) => {
    setColumns(
      columns.map((col) =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    );
  };

  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    const visibleCols = columns.filter((col) => col.visible);
    const headers = visibleCols.map((col) => col.label).join(",");
    const rows = filteredData
      .map((row) => visibleCols.map((col) => row[col.id as keyof StudentData]).join(","))
      .join("\n");
    downloadFile(`${headers}\n${rows}`, "students_data.csv", "text/csv");
  };

  const exportToXLSX = () => {
    import("xlsx").then((XLSX) => {
      const visibleCols = columns.filter((col) => col.visible);
      const exportData = filteredData.map((row) =>
        visibleCols.reduce(
          (acc, col) => ({ ...acc, [col.label]: row[col.id as keyof StudentData] }),
          {}
        )
      );

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
      XLSX.writeFile(workbook, "students_data.xlsx");
    });
  };

  const exportToPDF = () => {
    import("jspdf").then((jsPDFModule) => {
      const jsPDF = jsPDFModule.default;
      import("jspdf-autotable").then((autoTable) => {
        autoTable.default(jsPDF, {});
        const doc = new jsPDF();
        const visibleCols = columns.filter((col) => col.visible && col.id !== photo);

        (doc as any).autoTable({
          head: [visibleCols.map((col) => col.label)],
          body: filteredData.map((row) =>
            visibleCols.map((col) => row[col.id as keyof StudentData])
          ),
        });
        doc.save("students_data.pdf");
      });
    });
  };

  const visibleColumns = columns.filter((col) => col.visible);

  // The leading "#" is always there; each optional column adds one more.
  const totalColumnCount =
    visibleColumns.length +
    1 +
    (rowAction ? 1 : 0) +
    (isActionBtn ? 1 : 0) +
    (isProofBtn ? 1 : 0) +
    (isEarningStatusBtn ? 1 : 0);

  /* Small wide capitals in the brand colour: the header reads as a label for
     the data rather than as a first row of it. */
  const headCell =
    "whitespace-nowrap border-r border-[hsl(var(--primary)/0.12)] px-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[hsl(var(--primary))] last:border-r-0";

  const cellPad = compact ? "px-4 py-1.5" : "px-4 py-3";
  const cellEdge = "border-r border-[hsl(var(--border)/0.55)] last:border-r-0";

  return (
    <div className="w-full">
      {/* ------------------------------------------------------ command bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            className="h-10 w-full rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-10 pr-9 text-sm text-[hsl(var(--foreground))] shadow-sm outline-none transition focus:border-[hsl(var(--primary))] focus:ring-4 focus:ring-[hsl(var(--primary)/0.12)]"
            placeholder="Search anything in this table..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              title="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {(filterBy ?? []).length > 0 && (
          <Select
            value={filterStatus}
            onValueChange={(value: FilterStatus) => {
              setFilterStatus && setFilterStatus(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-10 w-[170px] rounded-full border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {(filterBy ?? []).map((item) => (
                <SelectItem key={item.id} value={item.value}>
                  {item.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <ColumnSelector columns={columns} onColumnToggle={toggleColumn} />

        {/* How tight the rows sit. A wide table is read differently from a
            short one, and one setting does not suit both. */}
        <button
          type="button"
          onClick={() => setCompact((value) => !value)}
          title={compact ? "Comfortable rows" : "Compact rows"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] shadow-sm transition hover:text-[hsl(var(--primary))]"
        >
          {compact ? <Rows3 className="h-4 w-4" /> : <Rows4 className="h-4 w-4" />}
        </button>

        {/* One export control, instead of three buttons competing with the
            things people press far more often. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-10 gap-2 rounded-full border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 shadow-sm"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[180px] rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg"
          >
            <DropdownMenuItem onClick={exportToCSV} className="gap-2 text-sm">
              <FileText className="h-4 w-4" />
              CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToXLSX} className="gap-2 text-sm">
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToPDF} className="gap-2 text-sm">
              <FileDown className="h-4 w-4" />
              PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ------------------------------------------------------------ sheet */}
      <div className="overflow-hidden rounded-2xl bg-[hsl(var(--card))] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.18)] ring-1 ring-[hsl(var(--border))]">
        {/* The height belongs on the primitive's own scroll box, or the sticky
            header sticks to a container that never scrolls. */}
        <Table containerClassName="max-h-[68vh]">
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="border-0 bg-[hsl(var(--primary)/0.08)] hover:bg-[hsl(var(--primary)/0.08)]">
              <TableHead className={`${headCell} w-[62px]`}>#</TableHead>

              {/* Order must match the body cells below. */}
              {rowAction && (
                <TableHead className={`${headCell} w-[120px]`}>
                  {rowAction.label}
                </TableHead>
              )}
              {isActionBtn && (
                <TableHead className={`${headCell} w-[150px]`}>Actions</TableHead>
              )}

              {visibleColumns.map((column) => {
                const active = sortConfig?.key === column.id;
                return (
                  <TableHead key={column.id} className={headCell}>
                    <button
                      onClick={() => handleSort(column.id as keyof StudentData)}
                      className="group flex w-full items-center gap-1.5 text-left uppercase tracking-[0.12em]"
                      title={`Sort by ${column.label}`}
                    >
                      <span className={active ? "underline underline-offset-4" : ""}>
                        {column.label}
                      </span>
                      {/* Which column, and which way. */}
                      {active ? (
                        sortConfig?.direction === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-50" />
                      )}
                    </button>
                  </TableHead>
                );
              })}

              {isProofBtn && (
                <TableHead className={`${headCell} w-[100px]`}>Proof</TableHead>
              )}
              {isEarningStatusBtn && (
                <TableHead className={`${headCell} w-[170px]`}>
                  Earning Status
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          {/* A single rule under the header, in the brand colour, so the header
              reads as a band rather than as another row. */}
          <TableBody className="border-t-2 border-[hsl(var(--primary)/0.35)]">
            {isLoading ? (
              // Skeleton rows rather than a lone spinner: the table keeps its
              // shape, so the page does not jump when the data lands.
              Array.from({ length: 8 }).map((_, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className="border-b border-[hsl(var(--border)/0.6)]"
                >
                  {Array.from({ length: totalColumnCount }).map((__, cellIndex) => (
                    <TableCell key={cellIndex} className={cellPad}>
                      <div
                        className="h-3.5 animate-pulse rounded-full bg-[hsl(var(--muted))]"
                        style={{ width: `${55 + ((rowIndex * 7 + cellIndex * 13) % 40)}%` }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : paginatedData.length > 0 ? (
              paginatedData.map((row, index) => (
                <TableRow
                  key={row.id ?? row.std_id ?? row.cand_id ?? `${startIndex}-${index}`}
                  className="group border-b border-[hsl(var(--border)/0.6)] transition-colors hover:bg-[hsl(var(--primary)/0.05)]"
                >
                  <TableCell
                    className={`${cellPad} ${cellEdge} relative w-[62px] whitespace-nowrap text-xs font-medium tabular-nums text-[hsl(var(--muted-foreground))]`}
                  >
                    {/* The leading-edge marker. It holds the eye across a wide
                        row better than a change of background alone. */}
                    <span className="absolute inset-y-0 left-0 w-[3px] origin-center scale-y-0 rounded-r bg-[hsl(var(--primary))] transition-transform duration-150 group-hover:scale-y-100" />
                    {/* Continues across pages rather than restarting at 1. */}
                    {startIndex + index + 1}
                  </TableCell>

                  {rowAction && (
                    <TableCell className={`${cellPad} ${cellEdge} w-[120px]`}>
                      <Button
                        size="sm"
                        disabled={rowAction.isEnabled ? !rowAction.isEnabled(row) : false}
                        onClick={() => rowAction.onClick(row)}
                        className="h-8 rounded-full bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                        title={
                          rowAction.isEnabled && !rowAction.isEnabled(row)
                            ? "Only recommended candidates can be enrolled"
                            : rowAction.label
                        }
                      >
                        {rowAction.label}
                      </Button>
                    </TableCell>
                  )}

                  {isActionBtn && (
                    <TableCell className={`${cellPad} ${cellEdge} w-[150px]`}>
                      {/* Faint until the row is under the cursor: hundreds of
                          identical icon rows are noise, and they compete with
                          the data for the attention the data needs. */}
                      <div className="flex items-center gap-0.5 opacity-55 transition group-hover:opacity-100">
                        {onView && (
                          <button
                            onClick={() => onView(row)}
                            title="View details"
                            className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--navy-light))] hover:text-[hsl(var(--navy))]"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View</span>
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(row)}
                            title="Edit record"
                            className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--accent)/0.15)] hover:text-[hsl(var(--accent))]"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </button>
                        )}
                        {onEmail && (
                          <button
                            onClick={() => onEmail(row)}
                            title="Send email"
                            className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--teal-light))] hover:text-[hsl(var(--teal))]"
                          >
                            <Mail className="h-4 w-4" />
                            <span className="sr-only">Send Email</span>
                          </button>
                        )}
                        {onLogin && (
                          <button
                            onClick={() => onLogin(row)}
                            title={logInAsSubUser}
                            className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--primary)/0.15)] hover:text-[hsl(var(--primary))]"
                          >
                            <LogIn className="h-4 w-4" />
                            <span className="sr-only">Login</span>
                          </button>
                        )}
                        {/* Destructive last, and set apart from the button
                            people press most. */}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(row)}
                            title="Delete record"
                            className="ml-auto rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--destructive)/0.15)] hover:text-[hsl(var(--destructive))]"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </button>
                        )}
                      </div>
                    </TableCell>
                  )}

                  {visibleColumns.map((column) => {
                    const value = row[column.id];

                    if (isLink && column.id === linkColumn) {
                      return (
                        <TableCell
                          key={column.id}
                          className={`${cellPad} ${cellEdge} text-sm`}
                        >
                          <a
                            href={value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-[hsl(var(--primary))] underline-offset-4 hover:underline"
                          >
                            {value}
                          </a>
                        </TableCell>
                      );
                    }

                    if (column.id === photo) {
                      const name = firstValue(row, NAME_KEYS);
                      const hasPhoto =
                        value && String(value) !== "null" && String(value) !== "undefined";
                      return (
                        <TableCell
                          key={column.id}
                          className={`${compact ? "px-4 py-1" : "px-4 py-2"} ${cellEdge}`}
                        >
                          <button
                            type="button"
                            disabled={!hasPhoto}
                            onClick={() =>
                              window.open(
                                `${BACKEND_URL}${value}`,
                                "_blank",
                                "noopener,noreferrer"
                              )
                            }
                            title={hasPhoto ? "Open the full picture" : "No photo on file"}
                            className="relative block rounded-full transition enabled:hover:ring-2 enabled:hover:ring-[hsl(var(--primary)/0.45)] disabled:cursor-default"
                          >
                            <PersonAvatar
                              src={value}
                              baseUrl={BACKEND_URL}
                              name={name}
                              gender={firstValue(row, GENDER_KEYS)}
                              className={compact ? "h-8 w-8" : "h-11 w-11"}
                            />
                          </button>
                        </TableCell>
                      );
                    }

                    const long = String(value ?? "").length > CHARACTER_LIMIT;
                    return (
                      <TableCell
                        key={column.id}
                        className={`${cellPad} ${cellEdge} text-sm text-[hsl(var(--foreground))] ${
                          looksNumeric(value) ? "tabular-nums" : ""
                        }`}
                      >
                        <span
                          className={
                            long
                              ? "block max-w-[26rem] whitespace-pre-wrap break-words"
                              : "whitespace-nowrap"
                          }
                        >
                          {value}
                        </span>
                      </TableCell>
                    );
                  })}

                  {isProofBtn && (
                    <TableCell className={`${cellPad} ${cellEdge} w-[100px]`}>
                      {row.proof && (
                        <a
                          href={`${BACKEND_URL}${row.proof}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[hsl(var(--teal))] transition hover:bg-[hsl(var(--teal-light))]"
                          title="View proof in new tab"
                        >
                          <FileDown className="h-5 w-5" />
                          <span className="sr-only">View Proof</span>
                        </a>
                      )}
                    </TableCell>
                  )}

                  {isEarningStatusBtn && (
                    <TableCell className={`${cellPad} ${cellEdge} w-[170px]`}>
                      <div className="flex items-center gap-2">
                        {row.earningStatus === 2 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full border-[hsl(var(--teal))] text-xs text-[hsl(var(--teal))] hover:bg-[hsl(var(--teal))] hover:text-[hsl(var(--primary-foreground))]"
                            onClick={() =>
                              onEarningStatusChange && onEarningStatusChange(row, "approved")
                            }
                          >
                            Approved
                          </Button>
                        )}
                        {row.earningStatus === 1 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-full border-[hsl(var(--destructive))] text-xs text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive-foreground))]"
                            onClick={() =>
                              onEarningStatusChange && onEarningStatusChange(row, "rejected")
                            }
                          >
                            Reject
                          </Button>
                        )}
                        {row.earningStatus === 0 && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-full border-[hsl(var(--teal))] text-xs text-[hsl(var(--teal))] hover:bg-[hsl(var(--teal))] hover:text-[hsl(var(--primary-foreground))]"
                              onClick={() =>
                                onEarningStatusChange && onEarningStatusChange(row, "approved")
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-full border-[hsl(var(--destructive))] text-xs text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive-foreground))]"
                              onClick={() =>
                                onEarningStatusChange && onEarningStatusChange(row, "rejected")
                              }
                            >
                              Rejected
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={totalColumnCount} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 p-8">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/0.08)] text-[hsl(var(--primary))]">
                      <Inbox className="h-7 w-7" />
                    </span>
                    <p className="mt-1 text-sm font-semibold text-[hsl(var(--foreground))]">
                      {searchTerm ? "Nothing matches that search" : "No data available"}
                    </p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {searchTerm
                        ? "Try fewer words, or clear the search to see everything."
                        : "Records will appear here once there are some."}
                    </p>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="mt-2 rounded-full border border-[hsl(var(--border))] px-4 py-1.5 text-xs font-medium text-[hsl(var(--foreground))] transition hover:bg-[hsl(var(--muted))]"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ------------------------------------------------------- pagination */}
      {!isLoading && filteredData.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              <span className="font-semibold text-[hsl(var(--foreground))] tabular-nums">
                {startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredData.length)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-[hsl(var(--foreground))] tabular-nums">
                {filteredData.length}
              </span>
              {filteredData.length !== data.length && (
                <span> (filtered from {data.length})</span>
              )}
            </span>

            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-1 text-xs text-[hsl(var(--foreground))] shadow-sm outline-none focus:border-[hsl(var(--primary))]"
              title="Rows per page"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              title="First page"
              className="rounded-full p-2 text-[hsl(var(--muted-foreground))] transition enabled:hover:bg-[hsl(var(--muted))] enabled:hover:text-[hsl(var(--foreground))] disabled:opacity-25"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              title="Previous page"
              className="rounded-full p-2 text-[hsl(var(--muted-foreground))] transition enabled:hover:bg-[hsl(var(--muted))] enabled:hover:text-[hsl(var(--foreground))] disabled:opacity-25"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Numbers, so a long list can be jumped through rather than
                stepped through one page at a time. */}
            {pageWindow(currentPage, totalPages).map((page, index) =>
              page === "gap" ? (
                <span
                  key={`gap-${index}`}
                  className="px-1 text-xs text-[hsl(var(--muted-foreground))]"
                >
                  …
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 min-w-[2rem] rounded-full px-2.5 text-xs font-semibold tabular-nums transition ${
                    page === currentPage
                      ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-sm"
                      : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
                  }`}
                >
                  {page}
                </button>
              )
            )}

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              title="Next page"
              className="rounded-full p-2 text-[hsl(var(--muted-foreground))] transition enabled:hover:bg-[hsl(var(--muted))] enabled:hover:text-[hsl(var(--foreground))] disabled:opacity-25"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              title="Last page"
              className="rounded-full p-2 text-[hsl(var(--muted-foreground))] transition enabled:hover:bg-[hsl(var(--muted))] enabled:hover:text-[hsl(var(--foreground))] disabled:opacity-25"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;
