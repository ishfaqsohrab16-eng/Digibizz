import { useState } from "react";
import TicketTable from "./TicketTable";
import CreateTicketForm from "./CreateTicketForm";
import ViewTicket from "./ViewTicket";

const Tickets = () => {
  const [activeForm, setActiveForm] = useState<string>("TicketList");
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  const openForm = (formName: string) => {
    setActiveForm(formName);
  };

  const renderActiveForm = () => {
    switch (activeForm) {
      case "CreateTicket":
        return <CreateTicketForm openForm={openForm} />;
      case "ViewTicket":
        return selectedTicketId ? (
          <ViewTicket openForm={openForm} ticketId={selectedTicketId} />
        ) : (
          <div className="text-center p-8">
            No ticket selected. 
            <button 
              className="text-blue-600 hover:underline ml-2"
              onClick={() => openForm("TicketList")}
            >
              Go back
            </button>
          </div>
        );
      case "TicketList":
      default:
        return (
          <TicketTable 
            openForm={openForm} 
            setSelectedTicketId={setSelectedTicketId} 
          />
        );
    }
  };

  return <>{renderActiveForm()}</>;
};

export default Tickets;
