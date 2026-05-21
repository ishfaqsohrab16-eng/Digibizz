import React from "react";

interface WhatsNewCardProps {
  version: string;
  features: string[];
}

const WhatsNewCard: React.FC<WhatsNewCardProps> = ({ version, features }) => {
  return (
    <div className="bg-primary text-primary-foreground p-4 rounded-lg shadow-sm animate-fade-up">
      <div className="flex items-center mb-2">
        <span className="bg-primary-foreground bg-opacity-20 p-1 rounded-md mr-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        <h3 className="font-bold">What's New?</h3>
        <div className="flex-grow"></div>
        <span className="text-xs">{version}</span>
      </div>

      <div className="border-t border-primary-foreground border-opacity-20 pt-3 mt-2">
        {features.map((feature, index) => (
          <p key={index} className="text-sm mb-2">
            - {feature}
          </p>
        ))}
      </div>
    </div>
  );
};

export default WhatsNewCard;
