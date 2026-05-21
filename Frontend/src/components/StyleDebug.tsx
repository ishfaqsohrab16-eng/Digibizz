import React from 'react';

const StyleDebug: React.FC = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Style Debug Panel</h1>
      
      <h2 className="text-lg font-semibold mt-4 mb-2">Tailwind Core Styles</h2>
      <div className="flex flex-wrap gap-2">
        <div className="bg-red-500 text-white p-2 rounded">bg-red-500</div>
        <div className="bg-blue-500 text-white p-2 rounded">bg-blue-500</div>
        <div className="bg-green-500 text-white p-2 rounded">bg-green-500</div>
        <div className="text-xl text-purple-700 font-bold">text-xl text-purple-700</div>
      </div>
      
      <h2 className="text-lg font-semibold mt-4 mb-2">Custom Theme Colors</h2>
      <div className="flex flex-wrap gap-2">
        <div className="bg-primary text-primary-foreground p-2 rounded">Primary</div>
        <div className="bg-secondary text-secondary-foreground p-2 rounded">Secondary</div>
        <div className="bg-dashboard-teal text-white p-2 rounded">Dashboard Teal</div>
        <div className="bg-dashboard-navy text-white p-2 rounded">Dashboard Navy</div>
      </div>
      
      <h2 className="text-lg font-semibold mt-4 mb-2">Custom Classes</h2>
      <div className="flex flex-wrap gap-4">
        <div className="card-container">Card Container</div>
        <div className="stat-card p-4">Stat Card</div>
        <div className="animate-slide-in">Slide In Animation</div>
        <div className="card-hover bg-white p-4">Hover Me (Card Hover)</div>
      </div>
      
      <h2 className="text-lg font-semibold mt-4 mb-2">Sidebar Colors</h2>
      <div className="flex flex-wrap gap-2">
        <div className="bg-sidebar-bg text-white p-2 rounded">Sidebar BG</div>
        <div className="bg-sidebar-accent text-white p-2 rounded">Sidebar Accent</div>
      </div>
    </div>
  );
};

export default StyleDebug;
