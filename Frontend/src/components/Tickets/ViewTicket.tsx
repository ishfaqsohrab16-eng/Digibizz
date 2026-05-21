import { useEffect, useState } from "react";
import { getTicketById, createTicketReply } from "../../services/api";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { ArrowLeft, Paperclip, MessageSquare } from "lucide-react";

import { format } from "date-fns";
import { Input } from "../../components/ui/input";
import { useBatch } from "../../context/BatchContext";
import { toast } from "sonner";
import { Ticket, TicketReply } from "../../types/ticket";
import SettingsHeader from "../Settings/SettingsHeader";

interface ViewTicketProps {
  openForm: (formName: string) => void;
  ticketId: number;
}

const ViewTicket: React.FC<ViewTicketProps> = ({ openForm, ticketId }) => {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const { user_id, selectedBatchId, userType } = useBatch();

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        setLoading(true);
        const response = await getTicketById(
          ticketId,
          user_id,
          selectedBatchId
        );

        if (response.success) {
          setTicket(response.data);
          // Set reply message if there's an existing reply
          if (response.data.replies) {
            if (Array.isArray(response.data.replies) && response.data.replies.length > 0) {
              setReplyMessage(response.data.replies[0].reply_message);
            } else if (!Array.isArray(response.data.replies)) {
              setReplyMessage(response.data.replies.reply_message);
            }
          }
        } else {
          toast.error("Failed to load ticket");
        }
      } catch (error) {
        console.error("Error loading ticket:", error);
        toast.error("Error loading ticket details");
      } finally {
        setLoading(false);
      }
    };

    if (ticketId) {
      fetchTicket();
    }
  }, [ticketId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePhoto(e.target.files[0]);
    }
  };

  const handleReplySubmit = async (ticket_status: string) => {
    if (!replyMessage.trim() && ticket_status === "ANSWERED") {
      toast.error("Reply message cannot be empty", {
        style: {
          background: "hsl(var(--background))",
          color: "hsl(var(--foreground))",
          border: "1px solid hsl(var(--border))",
        },
      });
      return;
    }

    try {
      setSubmitting(true);
      const replyData = {
        ticket_no: ticket?.ticket_no || "",
        reply_by: userType || "student",
        reply_message: replyMessage,
        reply_date: format(new Date(), "yyyy-MM-dd"),
        reply_time: format(new Date(), "HH:mm:ss"),
        ticket_status: ticket_status || "ANSWERED",
      };

      const response = await createTicketReply(
        replyData,
        profilePhoto || undefined
      );

      if (response.success) {
        toast.success(`Ticket ${ticket_status} sent successfully`, {
          style: {
            background: "hsl(var(--primary))",
            color: "hsl(var(--primary-foreground))",
          },
        });
        setReplyMessage("");
        setProfilePhoto(null);

        const updatedTicket = await getTicketById(
          ticketId,
          user_id,
          selectedBatchId
        );

        if (updatedTicket.success) {
          setTicket(updatedTicket.data);
          // Update reply message if there's a new reply
          if (updatedTicket.data.replies) {
            if (Array.isArray(updatedTicket.data.replies) && updatedTicket.data.replies.length > 0) {
              setReplyMessage(updatedTicket.data.replies[0].reply_message);
            } else if (!Array.isArray(updatedTicket.data.replies)) {
              setReplyMessage(updatedTicket.data.replies.reply_message);
            }
          }
        } else {
          throw new Error("Failed to refresh ticket data");
        }
      } else {
        throw new Error(response.message || "Failed to send reply");
      }
    } catch (error) {
      console.error("Error sending reply:", error);
      toast.error(
        error instanceof Error ? error.message : "Error sending reply",
        {
          style: {
            background: "hsl(var(--background))",
            color: "hsl(var(--destructive))",
            border: "1px solid hsl(var(--destructive))",
          },
        }
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-md">
        <p>Ticket not found.</p>
        <Button onClick={() => openForm("TicketList")} className="mt-4">
          Back to Tickets
        </Button>
      </div>
    );
  }

  const getStatusBadgeClass = (status: string) => {
    if (status === "ANSWERED") return "bg-green-100 text-green-800";
    return "bg-orange-100 text-orange-800";
  };

  return (
    <div className="max-w-8xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <SettingsHeader
        SettingsHeader="Ticket Details"
        SettingDescription={`Ticket #${ticket.ticket_no}`}
      />

      <Button
        variant="ghost"
        className="mb-6 flex items-center gap-2"
        onClick={() => openForm("TicketList")}
      >
        <ArrowLeft size={16} />
        Back to Tickets
      </Button>

      <div className="border rounded-md overflow-hidden mb-8">
        {/* Ticket Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white px-6 py-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-semibold">{ticket.ticket_subject}</h2>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(
                ticket.ticket_status
              )}`}
            >
              {ticket.ticket_status}
            </span>
          </div>
          <div className="text-sm text-blue-100">
            <span>
              Created on {ticket.ticket_date} at {ticket.ticket_time}
            </span>
            <span className="mx-2">•</span>
            <span>Ticket #{ticket.ticket_no}</span>
          </div>
        </div>

        {/* Ticket Details */}
        <div className="p-6 border-b">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500">From</p>
              <p className="font-medium">
                {ticket.user_name || ticket.std_rollno}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">To</p>
              <p className="font-medium">
                {ticket.ticket_to === "trainer" ||
                ticket.ticket_to === "TRAINER"
                  ? `Trainer: ${ticket.trainers?.trainer_name || "N/A"} `
                  : ticket.ticket_to === "admin" || ticket.ticket_to === "ADMIN"
                  ? `Administrator`
                  : `Master Trainer`}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Center</p>
              <p className="font-medium">{ticket.centers?.center_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Course</p>
              <p className="font-medium">{ticket.courses?.course_name}</p>
            </div>
          </div>

          {/* Ticket Content */}
          <div className="mt-6">
            <p className="text-sm text-gray-500 mb-2">Description</p>
            <div
              className="bg-gray-50 p-4 rounded-md whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: ticket.ticket_description,
              }}
            />
          </div>

          {/* Attachment */}
          {ticket.ticket_attachment && (
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">Attachment</p>
              <a
                href={`${BACKEND_URL}/${ticket.ticket_attachment}`}
                download
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
              >
                <Paperclip size={16} />
                View Attachment
              </a>
            </div>
          )}
        </div>

        {/* Ticket Replies */}
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MessageSquare size={18} />
            Replies
          </h3>

          {ticket.replies ? (
            <div className="space-y-4">
              {Array.isArray(ticket.replies) ? (
                // Handle array of replies
                ticket.replies.map((reply: TicketReply) => (
                  <div key={reply.treply_id} className="p-4 border rounded-md">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">{reply.reply_by}</span>
                      <span className="text-sm text-gray-500">
                        {reply.reply_date} at {reply.reply_time}
                      </span>
                    </div>
                    <p
                      className="whitespace-pre-wrap mb-2"
                      dangerouslySetInnerHTML={{
                        __html: reply.reply_message,
                      }}
                    />

                    {reply.reply_attachment && (
                      <a
                        href={`${BACKEND_URL}/${reply.reply_attachment}`}
                        download
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        <Paperclip size={14} />
                        Attachment
                      </a>
                    )}
                  </div>
                ))
              ) : (
                // Handle single reply object
                <div className="p-4 border rounded-md">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{(ticket.replies as TicketReply).reply_by}</span>
                    <span className="text-sm text-gray-500">
                      {(ticket.replies as TicketReply).reply_date} at {(ticket.replies as TicketReply).reply_time}
                    </span>
                  </div>
                  <p
                    className="whitespace-pre-wrap mb-2"
                    dangerouslySetInnerHTML={{
                      __html: (ticket.replies as TicketReply).reply_message,
                    }}
                  />

                  {(ticket.replies as TicketReply).reply_attachment && (
                    <a
                      href={`${BACKEND_URL}/${(ticket.replies as TicketReply).reply_attachment}`}
                      download
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                      <Paperclip size={14} />
                      Attachment
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 italic">No replies yet.</p>
          )}

          {/* Reply Form */}
          {ticket.ticket_status === "OPEN" &&
            ((ticket.ticket_to.toLowerCase() === "trainer" &&
              userType === "trainer" &&
              !ticket.replies) ||
              (ticket.ticket_to.toLowerCase() === "admin" &&
                (userType === "SuperAdmin" || userType === "ContentAdmin") &&
                !ticket.replies) ||
              (ticket.ticket_to.toLowerCase() === "mt" &&
                userType === "MasterTrainer" &&
                !ticket.replies)) && (
              <div className="mt-8 border-t pt-6">
                <h4 className="font-medium mb-3">Post a Reply</h4>
                <Textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your reply here..."
                  rows={4}
                  className="w-full mb-4"
                />

                <div className="space-y-4">
                  <div>
                    <Input
                      type="file"
                      onChange={handleFileChange}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Max file size: 5MB. Supported formats: PDF, JPG, PNG
                    </p>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      onClick={() => handleReplySubmit("ANSWERED")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={submitting}
                    >
                      {submitting ? "Sending..." : "Send Reply"}
                    </Button>
                    <Button
                      onClick={() => handleReplySubmit("CLOSED")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={submitting}
                    >
                      {submitting ? "Sending..." : "Close Ticket"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ViewTicket;
