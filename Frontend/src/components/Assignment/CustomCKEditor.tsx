import { useState, useEffect, useRef } from 'react';
// Import PrimeReact Editor and required styles
import { Editor } from 'primereact/editor';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

interface CustomCKEditorProps {
  value: string;
  onChange?: (content: string) => void;
  isViewOnly?: boolean;
}

const CustomCKEditor: React.FC<CustomCKEditorProps> = ({ value, onChange, isViewOnly = false }) => {
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [editorContent, setEditorContent] = useState<string>(value || '');

  // Check for screen size changes
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  // Define header template with toolbar options for desktop and mobile
  const headerTemplate = () => {
    const baseOptions = [
      { label: 'Heading', icon: 'pi pi-heading', className: 'ql-header', value: '1' },
      { label: 'Bold', icon: 'pi pi-bold', className: 'ql-bold' },
      { label: 'Italic', icon: 'pi pi-italic', className: 'ql-italic' },
      { label: 'Link', icon: 'pi pi-link', className: 'ql-link' },
      { label: 'Bullet List', icon: 'pi pi-list', className: 'ql-list', value: 'bullet' },
      { label: 'Number List', icon: 'pi pi-list-ol', className: 'ql-list', value: 'ordered' },
      { label: 'Quote', icon: 'pi pi-quote-right', className: 'ql-blockquote' }
    ];

    return (
      <div className={`p-editor-toolbar ${isMobile ? 'flex flex-wrap' : ''}`}>
        {baseOptions.map((item, idx) => (
          <button 
            key={idx}
            className={`p-button p-component p-button-text p-button-sm ${item.className}`}
            title={item.label}
            data-value={item.value || undefined}
          >
            <span className={item.icon}></span>
          </button>
        ))}
      </div>
    );
  };

  // Handle content change
  const handleContentChange = (e: any) => {
    const newContent = e.htmlValue || '';
    setEditorContent(newContent);
    
    if (onChange) {
      onChange(newContent);
    }
  };

  return (
    <div className="w-full">
      <div
        className={`border border-gray-300 rounded-lg overflow-hidden bg-[hsl(var(--background))] ${
          isMobile ? "min-h-[200px]" : "min-h-[300px]"
        }`}
        ref={editorContainerRef}
      >
        <div className={`${isMobile ? "max-h-[300px]" : "max-h-[500px]"} overflow-y-auto`}>
          <div className="p-4">
            <Editor
              value={editorContent}
              onTextChange={handleContentChange}
              placeholder="Type or paste your content here!"
              readOnly={isViewOnly}
              style={{ 
                height: isMobile ? '200px' : '300px'
              }}
              pt={{
                toolbar: { className: 'border border-gray-200 rounded-t-lg' },
                content: { className: 'border border-gray-200 rounded-b-lg' }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomCKEditor;