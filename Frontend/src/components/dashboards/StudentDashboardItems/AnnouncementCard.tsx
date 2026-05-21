import React from "react";

interface AnnouncementCardProps {
  title: string;
  message: string;
  author: string;
  date: string;
}

const AnnouncementCard: React.FC<AnnouncementCardProps> = ({
  title,
  message,
  author,
  date,
}) => {
  return (
    <div className="announcement-card bg-accent text-accent-foreground p-4 rounded-lg shadow-sm animate-fade-up">
      <div className="flex items-center mb-2">
        <span className="bg-accent-foreground bg-opacity-20 p-1 rounded-md mr-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        <h3 className="font-bold">Official Announcements!</h3>
        <div className="flex-grow"></div>
      </div>

      <div className="border-t border-accent-foreground border-opacity-20 pt-3 mt-2">
        <h4 className="font-semibold mb-1">{title}</h4>
        {message}
        <p className="text-sm opacity-90">Regards</p>
        <p className="text-sm font-medium mt-1">{author}</p>
      </div>

      <div className="text-right text-xs opacity-70 mt-3">{date}</div>
    </div>
  );
};

export default AnnouncementCard;
