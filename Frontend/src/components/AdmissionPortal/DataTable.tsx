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
  Pencil,
  Trash2,
  FileDown,
  FileSpreadsheet,
  FileText,
  Inbox,
  LogIn,
  Mail,
  Search,
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
 * what the product looks like. It is built for the way these lists are
 * actually used - long, wide, scanned rather than read, and exported - which
 * drives most of the decisions here:
 *
 *   THE HEADER STAYS PUT while the body scrolls, because a table of four
 *   hundred trainees is unreadable once the column names are off the screen.
 *
 *   ROWS ALTERNATE FAINTLY and the hovered one is marked down its leading
 *   edge. Tracking a single record across eight columns is the whole job.
 *
 *   SORTING SAYS WHICH COLUMN AND WHICH WAY. A single unchanging icon on
 *   every header cannot answer the one question a sorted table raises.
 *
 *   NUMBERS AND DATES ARE TABULAR so digits line up in a column, and long
 *   text wraps instead of stretching the table sideways.
 *
 * Everything about which data appears is unchanged; the props below are the
 * same ones the thirty callers already pass.
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
 * each table names these differently. The alt text used to be hard-coded to
 * `cand_name`, so every table that was not the admissions list rendered
 * "undefined's photo" beside a broken image.
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
    // a column has to re-run it. It was missing, and the results went stale.
  }, [data, columns, filterStatus, searchTerm, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));

  /**
   * Searching from page 5 used to leave you looking at an empty table, because
   * the filtered results no longer reached that far. Going back to the first
   * page is what every other table does and what people expect.
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
    const visibleColumns = columns.filter((col) => col.visible);
    const headers = visibleColumns.map((col) => col.label).join(",");
    const rows = filteredData
      .map((row) =>
        visibleColumns.map((col) => row[col.id as keyof StudentData]).join(",")
      )
      .join("\n");
    downloadFile(`${headers}\n${rows}`, "students_data.csv", "text/csv");
  };

  const exportToXLSX = () => {
    import("xlsx").then((XLSX) => {
      const visibleColumns = columns.filter((col) => col.visible);
      const exportData = filteredData.map((row) =>
        visibleColumns.reduce(
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
        const visibleColumns = columns.filter(
          (col) => col.visible && col.id !== photo
        );

        (doc as any).autoTable({
          head: [visibleColumns.map((col) => col.label)],
          body: filteredData.map((row) =>
            visibleColumns.map((col) => row[col.id as keyof StudentData])
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

  const headCell =
    "whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]";

  return (
    <div className="w-full overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
      {/* ---------------------------------------------------------- toolbar */}
      <div className="flex flex-col gap-3 border-b border-[hsl(var(--border))] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[15rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              type="text"
              className="w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] py-2 pl-9 pr-9 text-sm text-[hsl(var(--foreground))] outline-none transition focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))/0.15]"
              placeholder="Search in all columns..."
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
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
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
              <SelectTrigger className="h-9 w-[170px]">
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

          {/* One segmented control rather than three loose buttons. */}
          <div className="ml-auto flex items-center overflow-hidden rounded-lg border border-[hsl(var(--border))]">
            <button
              onClick={exportToCSV}
              title="Download as CSV"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <span className="h-5 w-px bg-[hsl(var(--border))]" />
            <button
              onClick={exportToXLSX}
              title="Download as Excel"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--teal-light))] hover:text-[hsl(var(--teal))]"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Excel
            </button>
            <span className="h-5 w-px bg-[hsl(var(--border))]" />
            <button
              onClick={exportToPDF}
              title="Download as PDF"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--primary))/0.12] hover:text-[hsl(var(--primary))]"
            >
              <FileText className="h-3.5 w-3.5" />
              PDF
            </button>
          </div>
        </div>

        {/* What is on screen, in words, so a filtered table cannot be mistaken
            for the whole list. */}
        {!isLoading && (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            {filteredData.length === data.length
              ? `${data.length} ${data.length === 1 ? "record" : "records"}`
              : `${filteredData.length} of ${data.length} records match`}
            {sortConfig && (
              <>
                {" · sorted by "}
                <span className="font-medium text-[hsl(var(--foreground))]">
                  {columns.find((col) => col.id === sortConfig.key)?.label ||
                    String(sortConfig.key)}
                </span>
                {sortConfig.direction === "asc" ? " ↑" : " ↓"}
              </>
            )}
          </p>
        )}
      </div>

      {/* ------------------------------------------------------------ table */}
      {/* The height belongs on the primitive's own scroll box, or the sticky
          header sticks to a container that never scrolls. */}
      <div className="relative">
        <Table containerClassName="max-h-[70vh]">
          <TableHeader className="sticky top-0 z-10">
            <TableRow className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] hover:bg-[hsl(var(--muted))]">
              <TableHead className={`${headCell} w-[64px]`}>#</TableHead>

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
                      className={`group -mx-2 flex w-full items-center gap-1.5 rounded px-2 py-1 text-left uppercase tracking-wider transition hover:bg-[hsl(var(--background))] ${
                        active ? "text-[hsl(var(--primary))]" : ""
                      }`}
                      title={`Sort by ${column.label}`}
                    >
                      {column.label}
                      {/* Which column, and which way. A single unchanging icon
                          on every header answered neither. */}
                      {active ? (
                        sortConfig?.direction === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-0 transition group-hover:opacity-40" />
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

          <TableBody>
            {isLoading ? (
              // Skeleton rows rather than a lone spinner: the table keeps its
              // shape, so the page does not jump when the data lands.
              Array.from({ length: 8 }).map((_, rowIndex) => (
                <TableRow key={rowIndex} className="border-b border-[hsl(var(--border))]">
                  {Array.from({ length: totalColumnCount }).map((__, cellIndex) => (
                    <TableCell key={cellIndex} className="px-4 py-3.5">
                      <div
                        className="h-3.5 animate-pulse rounded bg-[hsl(var(--muted))]"
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
                  className="group border-b border-[hsl(var(--border))] transition-colors even:bg-[hsl(var(--muted))/0.35] hover:bg-[hsl(var(--primary))/0.06]"
                >
                  <TableCell className="w-[64px] whitespace-nowrap px-4 py-3 text-xs font-medium tabular-nums text-[hsl(var(--muted-foreground))]">
                    {/* Continues across pages - it used to restart at 1 on
                        every page, so row 31 was labelled 1. */}
                    {startIndex + index + 1}
                  </TableCell>

                  {rowAction && (
                    <TableCell className="w-[120px] px-4 py-3">
                      <Button
                        size="sm"
                        disabled={rowAction.isEnabled ? !rowAction.isEnabled(row) : false}
                        onClick={() => rowAction.onClick(row)}
                        className="h-8 bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
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
                    <TableCell className="w-[150px] px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        {onView && (
                          <button
                            onClick={() => onView(row)}
                            title="View details"
                            className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--navy-light))] hover:text-[hsl(var(--navy))]"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View</span>
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(row)}
                            title="Edit record"
                            className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--accent))/0.15] hover:text-[hsl(var(--accent))]"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </button>
                        )}
                        {onEmail && (
                          <button
                            onClick={() => onEmail(row)}
                            title="Send email"
                            className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--teal-light))] hover:text-[hsl(var(--teal))]"
                          >
                            <Mail className="h-4 w-4" />
                            <span className="sr-only">Send Email</span>
                          </button>
                        )}
                        {onLogin && (
                          <button
                            onClick={() => onLogin(row)}
                            title={logInAsSubUser}
                            className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--primary))/0.15] hover:text-[hsl(var(--primary))]"
                          >
                            <LogIn className="h-4 w-4" />
                            <span className="sr-only">Login</span>
                          </button>
                        )}
                        {/* Destructive last, and set apart, so it is not next
                            to the button people press most. */}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(row)}
                            title="Delete record"
                            className="ml-auto rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition hover:bg-[hsl(var(--destructive))/0.15] hover:text-[hsl(var(--destructive))]"
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
                        <TableCell key={column.id} className="px-4 py-3 text-sm">
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
                        <TableCell key={column.id} className="px-4 py-2.5">
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
                            className="relative block rounded-full transition enabled:hover:ring-2 enabled:hover:ring-[hsl(var(--primary))/0.4] disabled:cursor-default"
                          >
                            <PersonAvatar
                              src={value}
                              baseUrl={BACKEND_URL}
                              name={name}
                              gender={firstValue(row, GENDER_KEYS)}
                              className="h-11 w-11"
                            />
                          </button>
                        </TableCell>
                      );
                    }

                    const long = String(value ?? "").length > CHARACTER_LIMIT;
                    return (
                      <TableCell
                        key={column.id}
                        className={`px-4 py-3 text-sm text-[hsl(var(--foreground))] ${
                          looksNumeric(value) ? "tabular-nums" : ""
                        }`}
                      >
                        <span
                          className={long ? "block max-w-[26rem] whitespace-pre-wrap break-words" : "whitespace-nowrap"}
                        >
                          {value}
                        </span>
                      </TableCell>
                    );
                  })}

                  {isProofBtn && (
                    <TableCell className="w-[100px] px-4 py-3">
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
                    <TableCell className="w-[170px] px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.earningStatus === 2 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-[hsl(var(--teal))] text-xs text-[hsl(var(--teal))] hover:bg-[hsl(var(--teal))] hover:text-[hsl(var(--primary-foreground))]"
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
                            /* These class strings had a comma where a bracket
                               belonged - "hsl(var,--teal))" - so they produced
                               no colour at all. */
                            className="h-8 border-[hsl(var(--destructive))] text-xs text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive-foreground))]"
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
                              className="h-8 border-[hsl(var(--teal))] text-xs text-[hsl(var(--teal))] hover:bg-[hsl(var(--teal))] hover:text-[hsl(var(--primary-foreground))]"
                              onClick={() =>
                                onEarningStatusChange && onEarningStatusChange(row, "approved")
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 border-[hsl(var(--destructive))] text-xs text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive-foreground))]"
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
                <TableCell colSpan={totalColumnCount} className="h-56 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 p-8">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--muted))]">
                      <Inbox className="h-6 w-6 text-[hsl(var(--muted-foreground))]" />
                    </span>
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
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
                        className="mt-1 rounded-lg border border-[hsl(var(--border))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--foreground))] transition hover:bg-[hsl(var(--muted))]"
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--border))] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[hsl(var(--muted-foreground))]">
              Showing{" "}
              <span className="font-medium text-[hsl(var(--foreground))] tabular-nums">
                {startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredData.length)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-[hsl(var(--foreground))] tabular-nums">
                {filteredData.length}
              </span>
            </span>

            {/* Long lists are worked through at different speeds, and 30 was
                not a choice anybody made. */}
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-2 py-1 text-xs text-[hsl(var(--foreground))] outline-none focus:border-[hsl(var(--primary))]"
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
              className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition enabled:hover:bg-[hsl(var(--muted))] enabled:hover:text-[hsl(var(--foreground))] disabled:opacity-30"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              title="Previous page"
              className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition enabled:hover:bg-[hsl(var(--muted))] enabled:hover:text-[hsl(var(--foreground))] disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="px-2 text-xs text-[hsl(var(--muted-foreground))]">
              Page{" "}
              <span className="font-semibold text-[hsl(var(--foreground))] tabular-nums">
                {currentPage}
              </span>{" "}
              of <span className="tabular-nums">{totalPages}</span>
            </span>

            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages}
              title="Next page"
              className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition enabled:hover:bg-[hsl(var(--muted))] enabled:hover:text-[hsl(var(--foreground))] disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              title="Last page"
              className="rounded-md p-1.5 text-[hsl(var(--muted-foreground))] transition enabled:hover:bg-[hsl(var(--muted))] enabled:hover:text-[hsl(var(--foreground))] disabled:opacity-30"
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
