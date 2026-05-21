import React from "react";

interface DiscussionItemProps {
  text: string;
  color: string;
}

const DiscussionItem: React.FC<DiscussionItemProps> = ({ text, color }) => {
  // Update color class to use theme variables if color matches a theme color
  let colorClass = color;
  if (color === "bg-teal") colorClass = "bg-primary";
  
  return (
    <div className="py-2 px-1 flex items-center">
      <div className={`w-2 h-2 rounded-full ${colorClass} mr-2`}></div>
      <p className="text-sm text-foreground">{text}</p>
    </div>
  );
};

export default DiscussionItem;
