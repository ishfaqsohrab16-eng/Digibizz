import React from 'react';

type LoaderProps = {
  fullScreen?: boolean;
  small?: boolean;
  message?: string;
};

const Loader: React.FC<LoaderProps> = ({ 
  fullScreen = true, 
  small = false,
  message = 'Loading...'
}) => {
  const getContainerClasses = () => {
    if (fullScreen) {
      return "fixed top-0 left-0 w-full h-full flex flex-col items-center justify-center z-[999999] bg-background bg-opacity-90 backdrop-blur-sm theme-transition";
    }
    return "flex flex-col items-center justify-center p-4 theme-transition";
  };
  
  const getLoaderSize = () => {
    return small ? "h-[30px] w-[30px]" : "h-[50px] w-[50px]";
  };

  return (
    <div className={getContainerClasses()}>
      <div className={`${getLoaderSize()} relative`}>
        <div className="h-full w-full">
          <div className="h-full w-full rounded-full p-[10px] border-[3px] border-transparent border-l-primary border-r-primary animate-[spin_1.5s_ease-in-out_infinite]">
            <div className="h-full w-full rounded-full border-[3px] border-transparent border-t-accent border-b-accent animate-[spin_3s_linear_infinite]" />
          </div>
        </div>
      </div>
      {message && (
        <div className="mt-4 text-foreground font-medium animate-pulse">
          {message}
        </div>
      )}
    </div>
  );
};

export default Loader;
