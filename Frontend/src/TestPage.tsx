import React from 'react';
import { useTheme } from './context/ThemeContext';
import ThemeSelector from './components/ThemeSelector';

export default function TestPage() {
  const { theme } = useTheme();
  
  return (
    <div className="space-y-8 theme-transition">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Theme Testing</h1>
          <p className="text-muted-foreground">
            Currently using <span className="font-medium">{theme}</span> theme
          </p>
        </div>
        <ThemeSelector />
      </div>
      
      {/* Color Swatches */}
      <div className="card-container">
        <h2 className="text-xl font-semibold mb-4">Color Palette</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ColorSwatch name="Background" colorClass="bg-background border border-border" />
          <ColorSwatch name="Card" colorClass="bg-card border border-border" />
          <ColorSwatch name="Primary" colorClass="bg-primary text-primary-foreground" />
          <ColorSwatch name="Accent" colorClass="bg-accent text-accent-foreground" />
          <ColorSwatch name="Border" colorClass="bg-border" />
          <ColorSwatch name="Foreground" colorClass="bg-foreground text-white" />
          <ColorSwatch name="Muted" colorClass="bg-muted text-muted-foreground" />
        </div>
      </div>
      
      {/* UI Components */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-container">
          <h2 className="text-xl font-semibold mb-4">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
              Primary Button
            </button>
            <button className="px-4 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90">
              Secondary Button
            </button>
            <button className="px-4 py-2 border border-border bg-card hover:bg-accent/50 rounded-md">
              Outline Button
            </button>
          </div>
        </div>
        
        <div className="card-container">
          <h2 className="text-xl font-semibold mb-4">Cards</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-card border border-border rounded-md">
              <p className="font-medium">Default Card</p>
              <p className="text-sm text-muted-foreground">Card description text</p>
            </div>
            <div className="p-3 bg-accent border border-border rounded-md">
              <p className="font-medium">Accent Card</p>
              <p className="text-sm text-muted-foreground">Card description text</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Text Sample */}
      <div className="card-container">
        <h2 className="text-xl font-semibold mb-2">Typography</h2>
        <h1 className="text-2xl font-bold mb-2">Heading 1 (text-2xl)</h1>
        <h2 className="text-xl font-semibold mb-2">Heading 2 (text-xl)</h2>
        <h3 className="text-lg font-medium mb-2">Heading 3 (text-lg)</h3>
        <p className="mb-2">This is a paragraph with <a href="#" className="text-primary hover:underline">a link</a> and 
          <span className="text-muted-foreground"> some muted text</span>.
        </p>
        <p className="text-sm text-muted-foreground">This is smaller, muted text (text-sm text-muted-foreground)</p>
      </div>
    </div>
  );
}

// Helper component for showing color swatches
const ColorSwatch: React.FC<{ name: string; colorClass: string }> = ({ name, colorClass }) => (
  <div className="flex flex-col">
    <div className={`h-16 rounded-md ${colorClass} flex items-end p-2`}>
      <span className="text-xs font-mono">{name}</span>
    </div>
  </div>
);
