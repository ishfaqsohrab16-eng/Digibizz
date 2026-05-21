import React, { useState } from "react";
import { sendStudentMail } from "../../services/api";
import Loader from "../Loader";

interface Props {
  email?: string;
  onClose?: () => void;
}

const StudentSendMail: React.FC<Props> = ({ email = "", onClose }) => {
  const [toEmail, setToEmail] = useState(email);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);
    try {
      await sendStudentMail({ email: toEmail, subject, message });
      setStatus("Email sent successfully!");
      setToEmail("");
      setSubject("");
      setMessage("");
    } catch (error: any) {
      setStatus(error.message || "Failed to send email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="rounded-lg shadow-lg mx-auto mt-10 p-8"
      style={{
        background: "hsl(var(--card))",
        color: "hsl(var(--foreground))",
        border: "1px solid hsl(var(--border))",
      }}
    >
      <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: "hsl(var(--primary))" }}>
        Send Email to Student
      </h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block mb-1 font-medium text-[hsl(var(--muted-foreground))]">
            Student Email
          </label>
          <input
            type="email"
            className="w-full border rounded px-3 py-2 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] focus:ring-2 focus:ring-[hsl(var(--primary))] outline-none"
            value={toEmail}
            onChange={e => setToEmail(e.target.value)}
            required
            disabled
          />
        </div>
        <div>
          <label className="block mb-1 font-medium text-[hsl(var(--muted-foreground))]">
            Subject
          </label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] focus:ring-2 focus:ring-[hsl(var(--primary))] outline-none"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div>
          <label className="block mb-1 font-medium text-[hsl(var(--muted-foreground))]">
            Message
          </label>
          <textarea
            className="w-full border rounded px-3 py-2 bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] focus:ring-2 focus:ring-[hsl(var(--primary))] outline-none min-h-[120px]"
            value={message}
            onChange={e => setMessage(e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] px-5 py-2 rounded shadow hover:bg-[hsl(var(--accent))] transition-colors disabled:opacity-60"
            disabled={loading}
          >
            {loading && <Loader />}
            {loading ? "Sending..." : "Send Email"}
          </button>
          {onClose && (
            <button
              type="button"
              className="bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] px-5 py-2 rounded shadow hover:bg-[hsl(var(--border))] transition-colors"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
          )}
        </div>
        {status && (
          <div
            className={`mt-2 text-center rounded py-2 ${
              status.includes("success")
                ? "bg-[hsl(var(--teal-light))] text-[hsl(var(--teal))]"
                : "bg-[hsl(var(--pink-light))] text-[hsl(var(--pink))]"
            }`}
          >
            {status}
          </div>
        )}
      </form>
    </div>
  );
};

export default StudentSendMail;
