import React from 'react';
import { useTheme } from '../context/ThemeContext';

const ThemeDemo: React.FC = () => {
  const { theme } = useTheme();
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold mb-2">Current Theme: {theme}</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Theme Color Samples */}
        <div className="bg-card p-4 rounded-lg border border-border">
          <h2 className="font-semibold mb-2">Background</h2>
          <div className="h-20 bg-background rounded-md border border-border"></div>
        </div>
        
        <div className="bg-card p-4 rounded-lg border border-border">
          <h2 className="font-semibold mb-2">Primary</h2>
          <div className="h-20 bg-primary rounded-md text-primary-foreground flex items-center justify-center">
            Primary
          </div>
        </div>
        
        <div className="bg-card p-4 rounded-lg border border-border">
          <h2 className="font-semibold mb-2">Secondary</h2>
          <div className="h-20 bg-secondary rounded-md text-secondary-foreground flex items-center justify-center">
            Secondary
          </div>
        </div>
        
        <div className="bg-card p-4 rounded-lg border border-border">
          <h2 className="font-semibold mb-2">Accent</h2>
          <div className="h-20 bg-accent rounded-md text-accent-foreground flex items-center justify-center">
            Accent
          </div>
        </div>
      </div>
      
      <div className="bg-card p-4 rounded-lg border border-border">
        <h2 className="font-semibold mb-4">Sample UI Elements</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Buttons</h3>
            <div className="flex flex-wrap gap-2">
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md">Primary</button>
              <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md">Secondary</button>
              <button className="px-4 py-2 bg-accent text-accent-foreground rounded-md">Accent</button>
              <button className="px-4 py-2 border border-border rounded-md">Outline</button>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium mb-2">Typography</h3>
            <p className="mb-2">This is a paragraph with some <a href="#" className="text-primary hover:underline">linked text</a> and <span className="text-muted-foreground">muted text</span>.</p>
            <p className="text-sm text-muted-foreground">This is a smaller muted paragraph for secondary information.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeDemo;
