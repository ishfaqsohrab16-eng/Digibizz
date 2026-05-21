import { useState, useEffect, useRef, useMemo } from "react";
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
  ArrowUpDown,
  Download,
  Eye,
  Pencil,
  Trash2,
  FileDown,
  LogIn,
  Mail,
  Loader2,
} from "lucide-react";
import { ColumnSelector } from "./ColumnSelector";
import {
  StudentData,
  Column,
  FilterStatus,
  FilterBy,
} from "../../types/columns";
import { sortData, filterData, DEFAULT_COLUMNS } from "../../utils/tableUtils";
import { Input } from "../ui/input";
import { useBatch } from "../../context/BatchContext";
import { updateEarningStatus } from "../../services/api";
import { toast } from "sonner";

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
  onEarningStatusChange?: (row: any, status: string) => void; // add this prop
  photo?: string;
  isLoading?: boolean;
  isLink?: boolean;
  linkColumn?: string;
  logInAsSubUser?: string;
  currentPage?: number;
  setCurrentPage?: (page: number) => void;
}

export function DataTable({
  data,
  columns,
  filterStatus,
  setColumns,
  setFilterStatus,
  isActionBtn = false,
  isProofBtn = false,
  isEarningStatusBtn = false,
  isEarningStatusChangedBtn = 0,
  onView,
  onEdit,
  onDelete,
  onEmail,
  onLogin,
  onDownloadProof,
  onEarningStatus,
  onEarningStatusChange, // add this to destructure
  photo,
  filterBy,
  isLoading = false,
  isLink = false,
  linkColumn,
  logInAsSubUser,
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
  const itemsPerPage = 30;
  const [earningData, setEarningsData] = useState({
    success: false,
    message: "",
    data: [],
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const CHARACTER_LIMIT = 80;

  const filterSearchData = (data: any[], searchTerm: string) => {
    if (!searchTerm.trim()) return data; // Ensure searchTerm is not empty or just spaces

    const searchTerms = searchTerm.toLowerCase().split(/\s+/); // Split by spaces, handling multiple spaces

    return data.filter((item) => {
      return searchTerms.every((term) => {
        // Check if the term matches any visible column value
        return columns
          .filter((col) => col.visible)
          .some((column) => {
            const value = item[column.id];
            if (value == null) return false;
            return String(value).toLowerCase().includes(term);
          });
      });
    });
  };
  const filteredData = useMemo(() => {
    let processed = [...data];
    processed = filterData(processed, filterStatus || "all");
    processed = filterSearchData(processed, searchTerm);
    if (sortConfig) {
      processed = sortData(processed, sortConfig.key, sortConfig.direction);
    }
    return processed;
  }, [data, filterStatus, searchTerm, sortConfig, refreshKey]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(
    startIndex,
    startIndex + itemsPerPage
  );
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  const handleSort = (key: keyof any) => {
    setSortConfig({
      key,
      direction:
        sortConfig?.key === key && sortConfig.direction === "asc"
          ? "desc"
          : "asc",
    });
  };

  const toggleColumn = (columnId: string) => {
    setColumns(
      columns.map((col) =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
    );
  };

  const exportToCSV = () => {
    const visibleColumns = columns.filter((col) => col.visible);
    const headers = visibleColumns.map((col) => col.label).join(",");
    const rows = filteredData
      .map((row) =>
        visibleColumns.map((col) => row[col.id as keyof StudentData]).join(",")
      )
      .join("\n");
    const csvContent = `${headers}\n${rows}`;
    downloadFile(csvContent, "students_data.csv", "text/csv");
  };

  const exportToXLSX = () => {
    import("xlsx").then((XLSX) => {
      const visibleColumns = columns.filter((col) => col.visible);
      const exportData = filteredData.map((row) =>
        visibleColumns.reduce(
          (acc, col) => ({
            ...acc,
            [col.label]: row[col.id as keyof StudentData],
          }),
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
        autoTable.default(jsPDF, {}); // Extend jsPDF with autoTable
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

  const handleDownloadProof = async (proof: string) => {
    try {
      const fullUrl = `${BACKEND_URL}${proof}`;
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error("File not found");
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      const fileName = proof.split("/").pop() || "download";
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Error downloading the file");
    }
  };

  const downloadFile = (
    content: string,
    fileName: string,
    contentType: string
  ) => {
    const blob = new Blob([content], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto p-4 md:p-6 bg-[hsl(var(--card))] rounded-lg shadow-md w-full">
      <div className="flex flex-col gap-4 mb-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="max-w-sm mr-5 relative">
            <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
              <svg
                className="w-4 h-4 text-[hsl(var(--muted-foreground))]"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 18 20"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 5v10M3 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm12 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 0V6a3 3 0 0 0-3-3H9m1.5-2-2 2 2 2"
                />
              </svg>
            </div>
            <input
              type="text"
              id="simple-search"
              className="max-w-sm mr-5 bg-[hsl(var(--background))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] text-sm rounded-lg focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))] block w-full ps-10 p-2.5"
              placeholder="Search in all columns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              required
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={exportToCSV}
              variant="outline"
              className="flex items-center gap-2 bg-[hsl(var(--navy-light))] text-[hsl(var(--navy))] hover:bg-[hsl(var(--navy))] hover:text-[hsl(var(--primary-foreground))]"
              size="sm"
            >
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button
              onClick={exportToXLSX}
              variant="outline"
              className="flex items-center gap-2 bg-[hsl(var(--teal-light))] text-[hsl(var(--teal))] hover:bg-[hsl(var(--teal))] hover:text-[hsl(var(--primary-foreground))]"
              size="sm"
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button
              onClick={exportToPDF}
              variant="outline"
              className="flex items-center gap-2 bg-[hsl(var(--primary))/0.15] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))]"
              size="sm"
            >
              <Download className="h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {(filterBy ?? []).length > 0 && (
            <Select
              value={filterStatus}
              onValueChange={(value: FilterStatus) =>
                setFilterStatus && setFilterStatus(value)
              }
            >
              <SelectTrigger className="w-[180px]">
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
        </div>
      </div>

      <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
        <Table className="table table-hover">
          <TableHeader className="sticky top-0 z-10 bg-[hsl(var(--muted))]">
            <TableRow className="border-b border-[hsl(var(--border))]">
              <TableHead className="w-[60px] px-4 py-3 font-semibold whitespace-nowrap text-[hsl(var(--foreground))]">
                #
              </TableHead>
              {isActionBtn && (
                <TableHead className="w-[120px] px-4 py-3 font-semibold whitespace-nowrap text-[hsl(var(--foreground))]">
                  Actions
                </TableHead>
              )}
              {columns
                .filter((col) => col.visible)
                .map((column) => (
                  <TableHead
                    key={column.id}
                    className="px-4 py-3 font-semibold whitespace-nowrap text-[hsl(var(--foreground))]"
                  >
                    <Button
                      variant="ghost"
                      onClick={() => handleSort(column.id as keyof StudentData)}
                      className="h-8 w-full justify-start font-medium hover:bg-[hsl(var(--muted))/0.3]"
                    >
                      {column.label}
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                ))}

              {isProofBtn && (
                <TableHead className="w-[100px] px-4 py-3 font-semibold whitespace-nowrap text-[hsl(var(--foreground))]">
                  Proof
                </TableHead>
              )}
              {isEarningStatusBtn && (
                <TableHead className="w-[160px] px-4 py-3 font-semibold whitespace-nowrap text-[hsl(var(--foreground))]">
                  Earning Status
                </TableHead>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={
                    columns.filter((col) => col.visible).length +
                    (isActionBtn ? 2 : 1) +
                    (isProofBtn ? 1 : 0) +
                    (isEarningStatusBtn ? 1 : 0)
                  }
                  className="h-60 text-center"
                >
                  <div className="flex flex-col items-center justify-center p-8">
                    <Loader2 className="h-10 w-10 animate-spin text-[hsl(var(--primary))] mb-4" />
                    <p className="text-[hsl(var(--muted-foreground))]">
                      Loading data...
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedData.length > 0 ? (
              paginatedData.map((row, index) => (
                <TableRow
                  key={index}
                  className="border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))/0.3] transition-all duration-200"
                >
                  <TableCell className="w-[60px] px-4 py-3 whitespace-nowrap">
                    {index + 1}
                  </TableCell>
                  {isActionBtn && (
                    <TableCell className="w-[120px] px-4 py-3">
                      <div className="flex items-center gap-2">
                        {onView && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-[hsl(var(--navy-light))] hover:text-[hsl(var(--navy))]"
                            onClick={() => onView(row)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View</span>
                          </Button>
                        )}
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-[hsl(var(--accent))/0.15] hover:text-[hsl(var(--accent))]"
                            onClick={() => onEdit(row)}
                            title="Edit record"
                          >
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-[hsl(var(--destructive))/0.15] hover:text-[hsl(var(--destructive))]"
                            onClick={() => onDelete(row)}
                            title="Delete record"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        )}
                        {onEmail && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-[hsl(var(--teal-light))] hover:text-[hsl(var(--teal))]"
                            onClick={() => onEmail(row)}
                            title="Send email"
                          >
                            <Mail className="h-4 w-4" />
                            <span className="sr-only">Send Email</span>
                          </Button>
                        )}
                        {onLogin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-[hsl(var(--primary))/0.15] hover:text-[hsl(var(--primary))]"
                            onClick={() => onLogin(row)}
                            title={logInAsSubUser}
                          >
                            <LogIn className="h-4 w-4" />
                            <span className="sr-only">Login</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {columns
                    .filter((col) => col.visible)
                    .map((column) => (
                      <TableCell key={column.id} className="px-4 py-3">
                        {isLink && column.id === linkColumn ? (
                          <a
                            href={row[column.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[hsl(var(--primary))] underline hover:text-[hsl(var(--primary))]"
                          >
                            {row[column.id]}
                          </a>
                        ) : column.id === photo ? (
                          <div
                            className="relative group/photo cursor-pointer"
                            onClick={() => {
                              window.open(
                                `${BACKEND_URL}${row[column.id]}`,
                                "_blank",
                                "noopener,noreferrer"
                              );
                            }}
                          >
                            <img
                              src={`${BACKEND_URL}${row[column.id]}`}
                              alt={`${row.cand_name}'s photo`}
                              className="h-16 w-16 rounded-lg object-cover transition-all duration-300 ease-in-out transform group-hover/photo:scale-105 group-hover/photo:shadow-lg ring-2 ring-[hsl(var(--border))]"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover/photo:bg-opacity-10 transition-all duration-300 rounded-lg" />
                            <div className="absolute inset-0 opacity-0 group-hover/photo:opacity-100 transition-all duration-300 flex items-center justify-center bg-black/20 rounded-lg">
                              <Eye className="w-5 h-5 text-[hsl(var(--primary-foreground))]" />
                            </div>
                          </div>
                        ) : (
                          <span
                            className={`block text-[hsl(var(--foreground))] ${
                              String(row[column.id as keyof StudentData])
                                .length > CHARACTER_LIMIT
                                ? "whitespace-pre-wrap break-words"
                                : "whitespace-nowrap"
                            }`}
                            style={{
                              wordWrap: "break-word",
                              maxWidth: "400px",
                            }}
                          >
                            {row[column.id as keyof StudentData]}
                          </span>
                        )}
                      </TableCell>
                    ))}

                  {isProofBtn && (
                    <TableCell className="w-[100px] px-4 py-3">
                      {row.proof && (
                        <a
                          href={`${BACKEND_URL}${row.proof}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-[hsl(var(--teal-light))] hover:text-[hsl(var(--teal))] transition-colors"
                          title="View proof in new tab"
                        >
                          <FileDown className="h-6 w-6 text-[hsl(var(--teal))]" />
                          <span className="sr-only">View Proof</span>
                        </a>
                      )}
                    </TableCell>
                  )}

                  {isEarningStatusBtn && (
                    <TableCell className="w-[160px] px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.earningStatus === 2 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-[hsl(var(--teal))] text-[hsl(var(--teal))] hover:bg-[hsl(var(--teal))] hover:text-[hsl(var(--primary-foreground))]"
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
                            className="border-[hsl(var(--destructive))] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))] hover:text-[hsl(var,--destructive-foreground))]"
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
                              className="border-[hsl(var(--teal))] text-[hsl(var,--teal))] hover:bg-[hsl(var(--teal))] hover:text-[hsl(var(--primary-foreground))]"
                              onClick={() =>
                                onEarningStatusChange && onEarningStatusChange(row, "approved")
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-[hsl(var(--destructive))] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))] hover:text-[hsl(var,--destructive-foreground))]"
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
                <TableCell
                  colSpan={
                    columns.filter((col) => col.visible).length +
                    (isActionBtn ? 2 : 1) +
                    (isProofBtn ? 1 : 0) +
                    (isEarningStatusBtn ? 1 : 0)
                  }
                  className="h-40 text-center"
                >
                  <div className="flex flex-col items-center justify-center p-8">
                    <p className="text-[hsl(var(--muted-foreground))] text-lg">
                      No data available
                    </p>
                    <p className="text-[hsl(var(--muted-foreground))/70] text-sm mt-2">
                      Try adjusting your search or filters
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && paginatedData.length > 0 && (
        <div className="flex items-center justify-between mt-4 px-4">
          <div className="text-sm text-[hsl(var(--muted-foreground))]">
            Showing {startIndex + 1} to{" "}
            {Math.min(startIndex + itemsPerPage, filteredData.length)} of{" "}
            {filteredData.length} entries
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage && setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm text-[hsl(var(--foreground))]">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage && setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;