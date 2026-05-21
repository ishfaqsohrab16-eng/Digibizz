import { useEffect, useState } from "react";

interface DeadlineTimerProps {
  deadline: string;
  setIsdeadlineExpired: (isExpired: boolean) => void;
}

const DeadlineTimer = ({
  deadline,
  setIsdeadlineExpired,
}: DeadlineTimerProps) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {

    const getValidDate = (dateString: string) => {
      try {
        

        if (typeof dateString === 'string' && !dateString.includes('T')) {
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + 7); 
          return futureDate;
        }
        

        if (typeof dateString === 'string' && dateString.includes('T') && dateString.length === 16) {
          const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
          
          if (match) {
            const [_, yearStr, monthStr, dayStr, hourStr, minuteStr] = match;
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10) - 1; 
            const day = parseInt(dayStr, 10);
            const hour = parseInt(hourStr, 10);
            const minute = parseInt(minuteStr, 10);
            
            const date = new Date(year, month, day, hour, minute);            
            if (!isNaN(date.getTime())) {
              return date;
            }
          }
        }
        
        // Fallback to standard date parsing
        return new Date(dateString);
      } catch (error) {
        console.error("Error parsing date:", error);
        return new Date(); // Return current date on error (will show as expired)
      }
    };

    // Check if deadline is valid
    if (!deadline) {
      setTimeLeft({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true,
      });
      setIsdeadlineExpired(true);
      return;
    }
    
    const deadlineDate = getValidDate(deadline);
    if (isNaN(deadlineDate.getTime())) {

      setTimeLeft({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true,
      });
      setIsdeadlineExpired(true);
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const deadlineTime = getValidDate(deadline).getTime();
      const difference = deadlineTime - now;

      if (difference <= 0) {
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
        });
        setIsdeadlineExpired(true);
        return true; // Expired
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor(
          (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        const minutes = Math.floor(
          (difference % (1000 * 60 * 60)) / (1000 * 60)
        );
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
        setIsdeadlineExpired(false);
        return false; // Not expired
      }
    };

    // Calculate once immediately
    const isExpired = calculateTimeLeft();
    
    // Only set interval if not expired
    let timer: number | undefined;
    if (!isExpired) {
      timer = window.setInterval(calculateTimeLeft, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [deadline, setIsdeadlineExpired]);

  if (timeLeft.isExpired) {
    return (
      <div className="bg-red-600 text-white p-4 rounded-lg text-center">
        <p className="text-xl font-bold">Assignment Deadline is Over</p>
      </div>
    );
  }

  return (
    <div className="bg-red-600 text-white p-4 rounded-lg grid grid-cols-4 gap-4">
      <div className="text-center">
        <div className="text-4xl font-bold">{timeLeft.days}</div>
        <div className="text-sm">Days</div>
      </div>
      <div className="text-center">
        <div className="text-4xl font-bold">{timeLeft.hours}</div>
        <div className="text-sm">Hours</div>
      </div>
      <div className="text-center">
        <div className="text-4xl font-bold">{timeLeft.minutes}</div>
        <div className="text-sm">Minutes</div>
      </div>
      <div className="text-center">
        <div className="text-4xl font-bold">{timeLeft.seconds}</div>
        <div className="text-sm">Seconds</div>
      </div>
    </div>
  );
};

export default DeadlineTimer;
