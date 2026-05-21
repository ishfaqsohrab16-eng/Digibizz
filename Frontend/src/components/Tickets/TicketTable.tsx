import { useEffect, useState } from "react";
import { getTickets } from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import { DataTable } from "../../components/AdmissionPortal/DataTable";
import { Column, FilterBy } from "../../types/columns";
import {
  DEFAULT_TICKET_COLUMNS,
  DEFAULT_FILTER_BY_TICKET_STATUS,
} from "../../utils/tableUtils";
import { Button } from "../../components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import SettingsHeader from "../Settings/SettingsHeader";

interface TicketTableProps {
  openForm: (formName: string) => void;
  setSelectedTicketId: (id: number) => void;
}

const TicketTable: React.FC<TicketTableProps> = ({
  openForm,
  setSelectedTicketId,
}) => {
  const [ticketData, setTicketData] = useState<any[]>([]);
  const [columns, setColumns] = useState<Column[]>(DEFAULT_TICKET_COLUMNS);
  const [filterStatus, setFilterStatus] = useState<string>("all"); // Ensure default matches "all" in DEFAULT_FILTER_BY_TICKET_STATUS
  const [filterBy] = useState<FilterBy[]>(DEFAULT_FILTER_BY_TICKET_STATUS);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState("EarningSubmissions");

  const { selectedBatchId, user_id, userType } = useBatch();

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await getTickets({
        tb_id: selectedBatchId,
        user_id,
        user_type: userType,
      });

      if (response.success) {
        // Format data for the table
        const formattedTickets = response.data.map((ticket: any) => ({
          ...ticket,
          center_name: ticket.centers?.center_name || "N/A",
          course_name: ticket.courses?.course_name || "N/A",
          student_name: ticket.student?.user_id || ticket.user_name || "N/A",
          tb_name: ticket.training_batches?.tb_name || "N/A",
        }));

        setTicketData(formattedTickets);
      } else {
        toast.error("Failed to fetch tickets");
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
      toast.error("Error fetching tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBatchId) {
      fetchTickets();
    }
  }, [selectedBatchId, userType]);

  const handleTicketView = (ticket: { ticket_id: number }) => {
    setSelectedTicketId(ticket.ticket_id);
    console.log("Selected ticket ID:", ticket);
    openForm("ViewTicket");
  };

  return (
    <div className="max-w-8xl mx-auto p-6 rounded-lg shadow-md" style={{ background: "hsl(var(--card))" }}>
      <SettingsHeader
        SettingsHeader="Support Tickets"
        SettingDescription="View and manage support tickets"
      />

      <div className="flex items-center justify-between mb-6">
        {userType === "student" && (
          <Button
            className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)_/_0.9)] text-[hsl(var(--primary-foreground))] font-medium px-4 py-2 rounded-lg shadow-md transform transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            onClick={() => openForm("CreateTicket")}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Ticket
          </Button>
        )}
      </div>
      {userType !== "trainer" && userType !== "MasterTrainer" ? (
        <>
          <nav className="shadow-md rounded-lg" style={{ background: "hsl(var(--card))" }}>
            <div className="container mx-auto px-4">
              <div className="flex items-center space-x-4 h-14">
                <button
                  onClick={() => setActiveTab("EarningSubmissions")}
                  className={`px-3 py-2 rounded-md transition-colors duration-200 ${
                    activeTab === "EarningSubmissions"
                      ? "bg-[hsl(var(--primary)_/_0.1)] text-[hsl(var(--primary))]"
                      : "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                  }`}
                >
                  All Tickets
                </button>
                <button
                  onClick={() => setActiveTab("SuccessStories")}
                  className={`px-3 py-2 rounded-md transition-colors duration-200 ${
                    activeTab === "SuccessStories"
                      ? "bg-[hsl(var(--primary)_/_0.1)] text-[hsl(var(--primary))]"
                      : "text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                  }`}
                >
                  Support Tickets
                </button>
              </div>
            </div>
          </nav>
          <main className="flex-1 overflow-auto mt-4">
            {activeTab === "EarningSubmissions" && (
              <DataTable
                data={ticketData}
                columns={columns}
                setColumns={setColumns}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                filterBy={filterBy}
                isActionBtn={true}
                onView={handleTicketView}
              />
            )}
            {activeTab === "SuccessStories" && (
              <DataTable
                data={ticketData.filter(
                  (tickets) => tickets.ticket_to.toLowerCase() === "admin"
                )}
                columns={columns}
                setColumns={setColumns}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                filterBy={filterBy}
                isActionBtn={true}
                onView={handleTicketView}
              />
            )}
          </main>
        </>
      ) : (
        <DataTable
          data={ticketData}
          columns={columns}
          setColumns={setColumns}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          filterBy={filterBy}
          isActionBtn={true}
          onView={handleTicketView}
        />
      )}
    </div>
  );
};

export default TicketTable;
