import React, { useState, useEffect } from "react";
import { DashboardNav } from "./navigation/DashboardNav";
import { ClassroomNav } from "./navigation/ClassroomNav";
import { CenterNav } from "./navigation/CenterNav";
import { AssessmentNav } from "./navigation/AssessmentNav";
import { useBatch } from "../../context/BatchContext";
import {
  getTrainingBatches,
  getTrainingBatchesForTrainer,
} from "../../services/api";
import { UserData } from "../../types/admin";
import mobileImage from "../../assets/icon.png";
import { Superscript } from "lucide-react";
import { AdminNav } from "./navigation/AdminNav";
interface SidebarProps {
  openForm: (formName: string) => void;
  isOpen?: boolean;
  isMobile?: boolean;
  onClose?: () => void;
  onItemClick?: () => void;
}

// Create a context to pass the styles to child components
export const SidebarContext = React.createContext<{
  isExpanded: boolean;
  isMobile: boolean;
}>({
  isExpanded: false,
  isMobile: false,
});

export const Sidebar: React.FC<SidebarProps> = ({
  openForm,
  isOpen,
  isMobile: propIsMobile,
  onClose,
  onItemClick,
}) => {
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<string>("Switch to Batch");
  const { setUserId, user_id } = useBatch();
  const { setCenterId } = useBatch();
  const { setCourseId, setStdCNIC } = useBatch();
  const { userType, setUserType } = useBatch();
  // latestSelectedBatch is no longer read here: the trainer dropdown used it to
  // pick batches by array position, which is what surfaced unassigned batches.
  // The setter stays - other screens still read the value.
  const { setSelectedBatchId, setSelectedBatchName, setlatestSelectedBatch, selectedBatchId } =
    useBatch();
  const [trainingBatches, setTrainingBatches] = useState<
    Array<{ tb_id: number; tb_name: string }>
  >([]);

  useEffect(() => {
    // If isMobile is provided as a prop, use it
    if (propIsMobile !== undefined) {
      setIsMobile(propIsMobile);
    } else {
      // Otherwise determine from window size
      const checkIfMobile = () => {
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile);
        // Only auto-expand on desktop, not on mobile
        if (!mobile) {
          setIsExpanded(false);
        }
      };

      checkIfMobile();
      window.addEventListener("resize", checkIfMobile);

      return () => {
        window.removeEventListener("resize", checkIfMobile);
      };
    }
  }, [propIsMobile]);

  // Update isExpanded when isOpen prop changes (for mobile)
  useEffect(() => {
    if (isMobile && isOpen !== undefined) {
      setIsExpanded(isOpen);
    }
  }, [isOpen, isMobile]);

  const handleSubmenuClick = (menuName: string) => {
    setActiveSubmenu((prev) => (prev === menuName ? null : menuName));
    if (onItemClick) onItemClick();
  };

  // Apply conditional classes for the sidebar based on expanded state
  let sidebarClasses;
  if (isMobile) {
    // For mobile: respect the isOpen prop strictly
    sidebarClasses = `fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] sidebar sidebar-transition
      ${isOpen ? "w-64" : "w-0"} overflow-y-auto border-r border-border`;
  } else {
    // For desktop: allow hover expansion
    sidebarClasses = `fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] sidebar sidebar-transition
      ${isExpanded ? "w-64" : "w-16"} overflow-y-auto border-r border-border`;
  }

  // For mobile, handle mouse events only if not mobile
  const mouseHandlers = isMobile
    ? {}
    : {
        onMouseEnter: () => setIsExpanded(true),
        onMouseLeave: () => setIsExpanded(false),
      };

  // Updated function to get current session's user ID
  const getCurrentSessionUserId = (): string | null => {
    // First check URL for sub-user parameter
    const urlParams = new URLSearchParams(window.location.search);
    const subUserId = urlParams.get("subuser");

    // If in a sub-user session, return that ID
    if (subUserId) {
      return subUserId;
    }

    // Otherwise return the main admin ID
    return localStorage.getItem("currentAdmin");
  };

  const getUserType = (): string => {
    try {
      // Determine which user ID to use based on context
      const userId = getCurrentSessionUserId();

      if (!userId) {
        return "UserAdmin";
      }

      const admin = localStorage.getItem(`admin${userId}`);
      if (!admin) {
        return "UserAdmin";
      }

      const parsedAdmin: UserData = JSON.parse(admin);

      if (parsedAdmin?.type) {
        // Set user ID and other context values
        setUserId(Number(userId));
        setCenterId(parsedAdmin.center_id);
        setCourseId(parsedAdmin.course_id);
        setStdCNIC(parsedAdmin.std_cnic || "");
        console.log("Parsed Admin Data:", parsedAdmin.course_id);
        return parsedAdmin.type;
      }

      return "UserAdmin";
    } catch (error) {
      console.error("Error parsing admin data:", error);
      return "UserAdmin";
    }
  };

  // Function to check if we're in a sub-user session
  const isSubUserSession = (): boolean => {
    return !!new URLSearchParams(window.location.search).get("subuser");
  };

  const BATCH_EXPIRY_HOURS = 12;

  const isStoredBatchExpired = (timestamp: number): boolean => {
    const now = new Date().getTime();
    const expiryTime = BATCH_EXPIRY_HOURS * 60 * 60 * 1000; // 12 hours in milliseconds
    return now - timestamp > expiryTime;
  };

  const fetchTrainingBatches = async () => {
    try {
      const userType = getUserType();
      setUserType(userType);

      // Trainers get only the batches they actually teach in. Everyone else
      // still sees every batch. Falls back to the full list if the scoped call
      // fails, so a backend hiccup degrades to the old behaviour instead of an
      // empty sidebar.
      let data;
      if (userType === "trainer" && user_id) {
        try {
          data = await getTrainingBatchesForTrainer(user_id);
        } catch (scopedError) {
          console.error("Falling back to all batches:", scopedError);
          data = await getTrainingBatches();
        }
      } else {
        data = await getTrainingBatches();
      }

      const sortedBatches = (data?.data || []).sort(
        (a: { created_at: string }, b: { created_at: string }) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTrainingBatches(sortedBatches);

      // Get stored batch ID from localStorage
      const storedBatchData = localStorage.getItem(`lastSelectedBatch_${user_id}`);
      
      if (storedBatchData) {
        const { batchId, timestamp } = JSON.parse(storedBatchData);
        
        if (!isStoredBatchExpired(timestamp)) {
          const selectedBatchObj = sortedBatches.find(
            (batch: { tb_id: number }) => batch.tb_id === parseInt(batchId)
          );
          if (selectedBatchObj) {
            setlatestSelectedBatch(selectedBatchObj.tb_id);
            setSelectedBatchId(selectedBatchObj.tb_id);
            setSelectedBatchName(selectedBatchObj.tb_name);
            setSelectedBatch(selectedBatchObj.tb_name);
            return;
          }
        } else {
          // Remove expired batch selection
          localStorage.removeItem(`lastSelectedBatch_${user_id}`);
        }
      }

      // Fallback to previous logic if no stored batch or stored batch not found
      const userId = getCurrentSessionUserId();
      const admin = userId ? localStorage.getItem(`admin${userId}`) : null;
      const parsedAdmin = admin ? JSON.parse(admin) : null;

      if (parsedAdmin?.tb_id) {
        // If tb_id exists in admin data, set it as the selected batch
        const selectedBatchObj = sortedBatches.find(
          (batch: { tb_id: number; tb_name: string }) =>
            batch.tb_id === parsedAdmin.tb_id
        );
        if (selectedBatchObj) {
          setlatestSelectedBatch(selectedBatchObj.tb_id);
          setSelectedBatchId(selectedBatchObj.tb_id);
          setSelectedBatchName(selectedBatchObj.tb_name);
          setSelectedBatch(selectedBatchObj.tb_name);
        }
      } else if (sortedBatches.length > 0) {
        // Otherwise, default to the latest batch
        const latestBatch = sortedBatches[sortedBatches.length - 1];
        setlatestSelectedBatch(latestBatch.tb_id);
        setSelectedBatchId(latestBatch.tb_id);
        setSelectedBatchName(latestBatch.tb_name);
        setSelectedBatch(latestBatch.tb_name);
      }
    } catch (error) {
      console.error("Error fetching training batches:", error);
    }
  };

  useEffect(() => {
    fetchTrainingBatches();

    // Set user type based on current session context
    setUserType(getUserType());
  }, []);

  // Function to handle form navigation that preserves query parameters
  const handleOpenForm = (formName: string) => {
    // Call the parent component's openForm function
    openForm(formName);

    // If there's an onItemClick callback (for mobile), call it
    if (onItemClick) {
      onItemClick();
    }
  };

  // Helper function to create navigation URLs that preserve query params
  const createNavUrl = (path: string): string => {
    const urlParams = new URLSearchParams(window.location.search);
    return `${path}?${urlParams.toString()}`;
  };

  return (
    <SidebarContext.Provider
      value={{ isExpanded: isMobile ? !!isOpen : isExpanded, isMobile }}
    >
      {/* Overlay for mobile only */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={onClose}
        ></div>
      )}

      <div className={sidebarClasses} {...mouseHandlers}>
        {/* Only render content if sidebar has width (prevents interaction when closed) */}
        {(!isMobile || (isMobile && isOpen)) && (
          <>
            {/* Logo area */}
            <div className="flex items-center justify-center h-20 border-b border-border">
              {isExpanded || (isMobile && isOpen) ? (
                <div className="p-4 space-y-2 shrink-0">
                  {userType !== "trainer" && userType !== "student" ? (
                    <>
                      <select
                        className="w-full p-2 bg-card text-foreground rounded focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        value={selectedBatch}
                        onChange={(e) => {
                          const selectedBatchObj = trainingBatches.find(
                            (batch) => batch.tb_name === e.target.value
                          );
                          if (selectedBatchObj) {
                            setSelectedBatch(selectedBatchObj.tb_name);
                            setSelectedBatchId(selectedBatchObj.tb_id);
                            setSelectedBatchName(selectedBatchObj.tb_name);
                            // Store the batch ID with timestamp
                            localStorage.setItem(
                              `lastSelectedBatch_${user_id}`,
                              JSON.stringify({
                                batchId: selectedBatchObj.tb_id,
                                timestamp: new Date().getTime()
                              })
                            );
                          }
                        }}
                      >
                        <option value="">Switch Batch</option>
                        {trainingBatches.map((batch) => (
                          <option key={batch.tb_id} value={batch.tb_name}>
                            {batch.tb_name}
                          </option>
                        ))}
                      </select>
                      <div className="rounded">
                        <div className="text-xs uppercase sidebar-menu-item-muted">
                          Current Batch
                        </div>
                        <div className="font-medium text-xs sidebar-menu-item">
                          {selectedBatch}
                        </div>
                      </div>
                    </>
                  ) : userType === "trainer" ? (
                    <>
                      <select
                        className="w-full p-2 bg-card text-foreground rounded focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        value={selectedBatch}
                        onChange={(e) => {
                          // trainingBatches is already scoped to this trainer's
                          // allocations, so every entry is selectable. The old
                          // code re-derived a 2-item window by array position,
                          // which offered batches the trainer had no class in.
                          const selectedBatchObj = trainingBatches.find(
                            (batch) => batch.tb_name === e.target.value
                          );
                          if (selectedBatchObj) {
                            setSelectedBatch(selectedBatchObj.tb_name);
                            setSelectedBatchId(selectedBatchObj.tb_id);
                            setSelectedBatchName(selectedBatchObj.tb_name);
                            localStorage.setItem(
                              `lastSelectedBatch_${user_id}`,
                              JSON.stringify({
                                batchId: selectedBatchObj.tb_id,
                                timestamp: new Date().getTime()
                              })
                            );
                          }
                        }}
                      >
                        <option value="">Switch Batch</option>
                        {/*
                          Every batch this trainer is allocated to, straight from
                          the server. The previous version listed entries by
                          array index (latest, latest-1), which had nothing to do
                          with allocations: a newly created batch appeared for
                          every trainer, and nothing appeared at all when the
                          trainer's batch sat at index 0.
                        */}
                        {trainingBatches.map((batch) => (
                          <option key={batch.tb_id} value={batch.tb_name}>
                            {batch.tb_name}
                          </option>
                        ))}
                      </select>
                      <div className="rounded">
                        <div className="text-xs uppercase sidebar-menu-item-muted">
                          Current Batch
                        </div>
                        <div className="font-medium text-xs sidebar-menu-item">
                          {selectedBatch}
                        </div>

                      </div>
                    </>
                  ) : (
                    <div className="p-2 rounded">
                      <div className="text-xs uppercase sidebar-menu-item-muted mb-1">
                        Current Batch
                      </div>
                      <div className="font-medium text-lg sidebar-menu-item">
                        {selectedBatch}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-10 w-10 flex items-center justify-center">
                  <img
                    src={mobileImage}
                    alt="DigiLMS Icon"
                    className="h-full w-full object-contain"
                  />
                </div>
              )}
            </div>

            {/* Navigation menus */}
            <div className="py-4 px-2 space-y-2">
              <DashboardNav
                openForm={handleOpenForm}
                activeSubmenu={activeSubmenu}
                onSubmenuClick={handleSubmenuClick}
                createNavUrl={createNavUrl} // Pass down
              />
              {userType === "SuperAdmin" && (
                <AdminNav
                  openForm={handleOpenForm}
                />
              )}
              {userType !== "student" && (
                <>
                  {(userType === "SuperAdmin" ||
                    userType === "ContentAdmin" ||
                    userType === "CenterManager") && (
                    <CenterNav
                      openForm={handleOpenForm}
                      activeSubmenu={activeSubmenu}
                      onSubmenuClick={handleSubmenuClick}
                      createNavUrl={createNavUrl} // Pass down
                    />
                  )}
                  <AssessmentNav
                    openForm={handleOpenForm}
                    activeSubmenu={activeSubmenu}
                    onSubmenuClick={handleSubmenuClick}
                    createNavUrl={createNavUrl} // Pass down
                  />
                  <div className="text-sm sidebar-menu-item mt-6 mb-2">
                    Class Room
                  </div>
                  <ClassroomNav
                    openForm={handleOpenForm}
                    activeSubmenu={activeSubmenu}
                    onSubmenuClick={handleSubmenuClick}
                    createNavUrl={createNavUrl} // Pass down
                  />
                </>
              )}
            </div>
          </>
        )}
      </div>
    </SidebarContext.Provider>
  );
};

export default Sidebar;
