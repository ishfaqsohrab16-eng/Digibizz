import React, { useState } from "react";

interface Ticket {
  id: string;
  subject: string;
  created: string;
}

const TicketsTable: React.FC = () => {
  const [entries, setEntries] = useState("100");
  const [search, setSearch] = useState("");
  const tickets: Ticket[] = [];

  return (
    <div className="bg-card rounded-lg shadow-sm p-6 animate-fade-up">
      <h2 className="text-lg font-semibold mb-1 text-foreground">Answered Tickets</h2>
      <p className="text-xs text-muted-foreground mb-4">
        List of your tickets/queries recently answered
      </p>

      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <span className="text-sm mr-2 text-foreground">Show</span>
          <select
            value={entries}
            onChange={(e) => setEntries(e.target.value)}
            className="border border-border rounded px-2 py-1 text-sm bg-background text-foreground"
          >
            <option value="100">100</option>
            <option value="50">50</option>
            <option value="25">25</option>
          </select>
          <span className="text-sm ml-2 text-foreground">entries</span>
        </div>

        <div className="flex items-center">
          <span className="text-sm mr-2 text-foreground">Search:</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border border-border rounded px-2 py-1 text-sm bg-background text-foreground"
          />
        </div>
      </div>

      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="text-sm font-medium py-2 px-2 text-foreground text-left">
              <div className="flex items-center">
                Ticket #
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 ml-1 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                  />
                </svg>
              </div>
            </th>
            <th className="text-sm font-medium py-2 px-2 text-foreground text-left">
              <div className="flex items-center">
                Subject
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 ml-1 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                  />
                </svg>
              </div>
            </th>
            <th className="text-sm font-medium py-2 px-2 text-foreground text-left">
              <div className="flex items-center">
                Created on
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 ml-1 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                  />
                </svg>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {tickets.length === 0 ? (
            <tr>
              <td
                colSpan={3}
                className="text-center py-4 text-sm text-muted-foreground"
              >
                No data available in table
              </td>
            </tr>
          ) : (
            tickets.map((ticket) => (
              <tr key={ticket.id} className="border-b border-border">
                <td className="py-2 text-sm text-foreground px-2">{ticket.id}</td>
                <td className="py-2 text-sm text-foreground px-2">{ticket.subject}</td>
                <td className="py-2 text-sm text-foreground px-2">{ticket.created}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="flex justify-between items-center mt-4">
        <div className="text-sm text-muted-foreground">Showing 0 to 0 of 0 entries</div>

        <div className="flex">
          <button className="px-3 py-1 border border-border rounded text-sm mr-1 bg-background text-foreground hover:bg-muted transition-colors">
            Previous
          </button>
          <button className="px-3 py-1 border border-border rounded text-sm bg-background text-foreground hover:bg-muted transition-colors">
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketsTable;
