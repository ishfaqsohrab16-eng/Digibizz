import React, { createContext, useContext, useState, useEffect } from "react";

interface BatchContextType {
  selectedBatchId: number;
  setSelectedBatchId: (id: number) => void;
  selectedBatchName: string;
  setSelectedBatchName: (name: string) => void;
  latestSelectedBatch: number;
  setlatestSelectedBatch: (name: number) => void;
  user_profile_photo: string;
  setUserProfilePhoto: (photo: string) => void;
  userType: string;
  setUserType: (type: string) => void;
  center_id: number;
  setCenterId: (id: number) => void;
  course_id: number;
  setCourseId: (id: number) => void;
  user_id: number;
  setUserId: (id: number) => void;
  earningStatus: number;
  setEarningStatus: (status: number) => void;
  studentStatus: number;
  setStudentStatus: (status: number) => void;
  stdCNIC: string;
  setStdCNIC: (photo: string) => void;
  submittedCount?:number;
  setSubmittedCount?: (count: number) => void;
  notSubmittedCount?:number;
  setNotSubmittedCount?: (count: number) => void;
  totalStudents?:number;
  setTotalStudents?: (count: number) => void;
  currentPage?: number;
  setCurrentPage?: (page: number) => void;
}

const BatchContext = createContext<BatchContextType | undefined>(undefined);

export const BatchProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [selectedBatchId, setSelectedBatchId] = useState<number>(-1);
  const [selectedBatchName, setSelectedBatchName] = useState<string>("");
  const [user_profile_photo, setUserProfilePhoto] = useState<string>("");
  const [userType, setUserType] = useState<string>("");
  const [center_id, setCenterId] = useState<number>(0);
  const [course_id, setCourseId] = useState<number>(0);
  const [user_id, setUserId] = useState<number>(0);
  const [earningStatus, setEarningStatus] = useState<number>(0);
  const [latestSelectedBatch, setlatestSelectedBatch] = useState<number>(-1);
  const [studentStatus, setStudentStatus] = useState<number>(5);
  const [stdCNIC, setStdCNIC] = useState<string>("");
  const [submittedCount, setSubmittedCount] = useState<number>(0);
  const [notSubmittedCount, setNotSubmittedCount] = useState<number>(0);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Check if this is a sub-user session when component mounts
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const subUserId = urlParams.get("subuser");

    if (subUserId) {
      // If we're in a sub-user session, set this user as current for this context only
      setUserId(Number(subUserId));

      // Get the admin data for this subuser
      const adminData = localStorage.getItem(`admin${subUserId}`);
      if (adminData) {
        const parsedAdmin = JSON.parse(adminData);
        if (parsedAdmin) {
          // Set all the relevant context values
          setCenterId(parsedAdmin.center_id || 0);
          setCourseId(parsedAdmin.course_id || 0);
          setUserType(parsedAdmin.type || "");
        }
      }
    } else {
      // In main session, get from regular localStorage
      const currentAdmin = localStorage.getItem("currentAdmin");
      if (currentAdmin) {
        setUserId(Number(currentAdmin));

        const adminData = localStorage.getItem(`admin${currentAdmin}`);
        if (adminData) {
          const parsedAdmin = JSON.parse(adminData);
          if (parsedAdmin) {
            setCenterId(parsedAdmin.center_id || 0);
            setCourseId(parsedAdmin.course_id || 0);
            setUserType(parsedAdmin.type || "");
          }
        }
      }
    }
  }, []);

  return (
    <BatchContext.Provider
      value={{
        selectedBatchId,
        setSelectedBatchId,
        user_profile_photo,
        setUserProfilePhoto,
        selectedBatchName,
        setSelectedBatchName,
        userType,
        setUserType,
        center_id,
        setCenterId,
        course_id,
        setCourseId,
        user_id,
        setUserId,
        earningStatus,
        setEarningStatus,
        setlatestSelectedBatch,
        latestSelectedBatch,
        studentStatus,
        setStudentStatus,
        stdCNIC,
        setStdCNIC,
        submittedCount,
        setSubmittedCount,
        notSubmittedCount,
        setNotSubmittedCount,
        totalStudents,
        setTotalStudents,
        currentPage,
        setCurrentPage,
      }}
    >
      {children}
    </BatchContext.Provider>
  );
};

export const useBatch = () => {
  const context = useContext(BatchContext);
  if (context === undefined) {
    throw new Error("useBatch must be used within a BatchProvider");
  }
  return context;
};
