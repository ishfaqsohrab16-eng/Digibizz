import React, { useEffect, useState } from "react";
import { ChevronRight, ChevronLeft, BookOpen, FileText, Plus, Image as ImageIcon, Edit, Trash2, Check } from "lucide-react";
import { getCourseModules, deleteCourseModule, markTopicCompleted, getAllCourse, getCenter } from "../../services/api";
import { useBatch } from "../../context/BatchContext";
import SettingsHeader from "../Settings/SettingsHeader";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";

interface CourseModuleListProps {
    openForm: (formName: string, moduleData?: any) => void;
    refreshTrigger?: number; // Add this to trigger refresh from parent
}

export const CourseModuleList: React.FC<CourseModuleListProps> = ({ openForm, refreshTrigger }) => {
  const [modules, setModules] = useState<any[]>([]);
  const [selectedModule, setSelectedModule] = useState<any | null>(null);
  const { selectedBatchId, userType, user_id , center_id, course_id} = useBatch();
  const [ centerId, setCenterId ] = useState(center_id || 0);
  const [ courseId, setCourseId ] = useState(course_id || 0);
  const [courses, setCourses] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const [loading, setLoading] = useState(false);

  // Helper function to check if a module is completed for the current trainer
  const isModuleCompleted = (module: any) => {
    if (!module.courseTopics || module.courseTopics.length === 0) return false;
    
    if (userType === "trainer") {
      // For trainers, check their specific reports
      return module.courseTopics.every((topic: any) => {
        return topic.trainerReports && topic.trainerReports.some((report: any) => 
          report.trainer_id === user_id && report.mark_done === true
        );
      });
    } else {
      // For other user types, check if any trainer has completed all topics
      return module.courseTopics.every((topic: any) => {
        return topic.trainerReports && topic.trainerReports.some((report: any) => 
          report.mark_done === true
        );
      });
    }
  };

  // Helper function to check if a module is unlocked (previous module completed)
  const isModuleUnlocked = (moduleIndex: number) => {
    if (moduleIndex === 0) return true; // First module is always unlocked
    const previousModule = modules[moduleIndex - 1];
    return isModuleCompleted(previousModule);
  };

  // Helper function to get module completion percentage
  const getModuleCompletionPercentage = (module: any) => {
    if (!module.courseTopics || module.courseTopics.length === 0) return 0;
    
    let completedTopics;
    if (userType === "trainer") {
      // For trainers, check their specific reports
      completedTopics = module.courseTopics.filter((topic: any) => {
        return topic.trainerReports && topic.trainerReports.some((report: any) => 
          report.trainer_id === user_id && report.mark_done === true
        );
      });
    } else {
      // For other user types, check if any trainer has completed the topic
      completedTopics = module.courseTopics.filter((topic: any) => {
        return topic.trainerReports && topic.trainerReports.some((report: any) => 
          report.mark_done === true
        );
      });
    }
    
    return Math.round((completedTopics.length / module.courseTopics.length) * 100);
  };

  // Fetch courses and centers based on user type
  useEffect(() => {
    const fetchDropdownData = async () => {
      console.log("Fetching dropdown data...", selectedBatchId, center_id, course_id);
      setLoading(true);
      try {
        // For SuperAdmin and ContentAdmin: fetch both courses and centers
        if (userType === "SuperAdmin" || userType === "ContentAdmin") {
          const [coursesData, centersData] = await Promise.all([
            getAllCourse(),
            getCenter()
          ]);
          setCourses(coursesData || []);
          setCenters(centersData || []);
        }
        // For MasterTrainer: only fetch centers (they have course_id but no center_id)
        else if (userType === "MasterTrainer" && !center_id) {
          const centersData = await getCenter();
          setCenters(centersData || []);
        }
        // For Trainer and Student: they already have both values, load modules automatically
        else if (userType === "trainer" || userType === "student") {
          refreshModules();
        }
      } catch (error) {
        console.error("Error fetching dropdown data:", error);
        toast.error("Failed to load dropdown data");
      } finally {
        setLoading(false);
      }
    };

    fetchDropdownData();
  }, [userType, center_id, course_id]);

  const handleAddModule = () => {
    localStorage.removeItem("courseModules");
    localStorage.removeItem("mode");
    openForm("CourseModuleForm");
  };

  const handleViewTopics = (module: any) => {
    setSelectedModule(module);
  };

  const handleBackToModules = () => {
    setSelectedModule(null);
  };

  const refreshModules = async () => {
    try {
      setLoading(true);
      // Use selectedBatchId if it's greater than 0, otherwise default to 8 for trainers and students
      const batchId = selectedBatchId >= 0 ? selectedBatchId : 8;
      
      if (batchId > 0) {
        let data;
        
        if (courseId && centerId) {
          data = await getCourseModules(batchId, courseId, centerId);
          // Handle the response structure - the API returns { modules: [...], trainerTopicReport: [...] }
          const modulesList = data.modules || [];
          setModules(modulesList);
          toast.success("Modules loaded successfully!");
        } else {
          // If no center/course selected, return empty modules
          setModules([]);
          toast.error("Please select both course and center");
        }
      }
    } catch (error) {
      console.error("Error fetching modules:", error);
      toast.error("Failed to load modules");
    } finally {
      setLoading(false);
    }
  };

  // New function to handle manual fetch
  const handleFetchModules = () => {
    const batchId = selectedBatchId >= 0 ? selectedBatchId : 8;
    if (!batchId) {
      toast.error("Please select a batch first");
      return;
    }
    refreshModules();
  };

  const handleEditModule = (e: React.MouseEvent, module: any) => {
    e.stopPropagation();
    console.log("handleEditModule called with module:", module);
    localStorage.setItem("courseModules", JSON.stringify(module));
    localStorage.setItem("mode", "edit");
    openForm("CourseModuleForm", module);
  };

  const handleDeleteModule = async (e: React.MouseEvent, moduleId: number) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this module?")) {
      try {
        await deleteCourseModule(moduleId);
        await refreshModules(); // Refresh the list after deletion
        console.log("Module deleted successfully");
      } catch (error) {
        console.error("Error deleting module:", error);
        alert("Failed to delete module");
      }
    }
  };

  // If a module is selected, show the topics view
  if (selectedModule) {
    return <ModuleTopicsView 
      module={selectedModule} 
      onBack={handleBackToModules} 
      userType={userType}
      selectedCenterId={centerId || center_id}
      selectedCourseId={courseId || course_id}
    />;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
       <SettingsHeader
        SettingsHeader="Course Modules"
        SettingDescription="Manage and organize your course modules. View topics, edit module details, or create new modules for your training programs."
      />
      
      {/* Course Modules Header with Icon */}
      {userType !== "trainer" && userType !== "student" &&(
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'hsl(var(--foreground))' }}>
          <BookOpen style={{ color: 'hsl(var(--primary))' }} /> Course Modules
        </h2>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors shadow-md"
          style={{ 
            backgroundColor: 'hsl(var(--primary))', 
            color: 'hsl(var(--primary-foreground))',
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--accent))'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--primary))'}
          onClick={handleAddModule}
        >
          <Plus size={20} /> Add Module
        </button>
      </div>
      )}
     {userType !== "trainer" && userType !== "student" && (
        <>
          <div className="flex gap-4 mx-10 mb-4">
            {userType !== "MasterTrainer" && (
              <div className="flex flex-col flex-1">
                <label className="mb-1 text-sm font-medium">Course</label>
                <select
                  className="flex-1 px-4 py-2 border rounded-md shadow-sm focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))]"
                  style={{
                    background: "hsl(var(--background))",
                    color: "hsl(var(--foreground))",
                    borderColor: "hsl(var(--border))",
                  }}
                  value={courseId}
                  onChange={(e) => setCourseId(Number(e.target.value))}
                >
                  <option value="">All Courses</option>
                  {courses.map((course) => (
                    <option key={course.course_id} value={course.course_id}>
                      {course.course_full_name || course.course_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col flex-1">
              <label className="mb-1 text-sm font-medium">Center</label>
              <select
                className="flex-1 px-4 py-2 border rounded-md shadow-sm focus:ring-[hsl(var(--primary))] focus:border-[hsl(var(--primary))]"
                style={{
                  background: "hsl(var(--background))",
                  color: "hsl(var(--foreground))",
                  borderColor: "hsl(var(--border))",
                }}
                value={centerId

                }
                onChange={(e) => setCenterId(Number(e.target.value))}
              >
                <option value="">All Centers</option>
                {centers.map((center) => (
                  <option key={center.center_id} value={center.center_id}>
                    {center.center_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <Button
                className="h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md shadow-sm"
                onClick={handleFetchModules}
                disabled={loading || !courseId || !centerId}
              >
                {loading ? "Fetching..." : "Fetch"}
              </Button>
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Show modules when we have both center and course IDs */}
        {((centerId > 0 || center_id > 0) && (courseId > 0 || course_id > 0)) ? (
          modules.length > 0 ? (
            modules.map((module, moduleIndex) => {
            const isCompleted = isModuleCompleted(module);
            const isUnlocked = userType === "trainer" ? true : true; // Only apply unlocking logic for trainers
            const completionPercentage = getModuleCompletionPercentage(module);
            
            return (
          <div 
            key={module.id} 
            className={`rounded-xl shadow-lg overflow-hidden transition-all duration-300 ${
              userType === "trainer" && !isUnlocked ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            style={{ 
              backgroundColor: isCompleted ? 'hsl(var(--teal-light))' : 'hsl(var(--card))', 
              border: `2px solid ${isCompleted ? 'hsl(var(--teal))' : 'hsl(var(--border))'}`,
              transform: isCompleted ? 'scale(1.02)' : 'scale(1)'
            }}
            onMouseOver={(e) => {
              if (isUnlocked) {
                e.currentTarget.style.boxShadow = '0 25px 50px -12px rgba(0, 0, 0, 0.25)';
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
            }}
          >
            {/* Image Section */}
            <div 
              className="relative h-48"
              style={{ 
                background: isCompleted 
                  ? 'linear-gradient(135deg, hsl(var(--teal)), hsl(var(--accent)))' 
                  : 'linear-gradient(135deg, hsl(var(--teal-light)), hsl(var(--pink-light)))' 
              }}
            >
              {module.module_image ? (
                <img
                  src={`${BACKEND_URL}${module.module_image}`}
                  alt={module.title}
                  className={`w-full h-full object-cover ${!isUnlocked ? 'filter grayscale' : ''}`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon size={48} style={{ color: 'hsl(var(--muted-foreground))' }} />
                </div>
              )}
              
              {/* Completion Status Overlay */}
              {userType === "trainer" && (
                <div className="absolute top-2 left-2">
                  {isCompleted ? (
                    <div 
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
                      style={{ backgroundColor: 'hsl(var(--teal))', color: 'white' }}
                    >
                      <Check size={12} />
                      Completed
                    </div>
                  ) : !isUnlocked ? (
                    <div 
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
                      style={{ backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}
                    >
                      🔒 Locked
                    </div>
                  ) : completionPercentage > 0 ? (
                    <div 
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
                      style={{ backgroundColor: 'hsl(var(--accent))', color: 'white' }}
                    >
                      {completionPercentage}% Done
                    </div>
                  ) : null}
                </div>
              )}
              
              {/* Action buttons overlay */}
              {userType !== "student" && userType !== "trainer" && (
                <div className="absolute top-2 right-2 flex gap-2">
                  <button
                    onClick={(e) => handleEditModule(e, module)}
                    className="p-1.5 rounded-full shadow-md transition-colors"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)'}
                  title="Edit Module"
                 >
                  <Edit size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
                </button>
                <button
                  onClick={(e) => handleDeleteModule(e, module.id)}
                  className="p-1.5 rounded-full shadow-md transition-colors"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.8)'}
                  title="Delete Module"
                >
                  <Trash2 size={14} style={{ color: 'hsl(var(--pink))' }} />
                </button>
              </div>
               )}
            </div>
             

            {/* Content Section */}
            <div className="p-4">
              <h3 className="text-lg font-semibold mb-2 line-clamp-2" style={{ color: 'hsl(var(--foreground))' }}>
                {module.title}
                {isCompleted && (
                  <span className="ml-2 text-sm" style={{ color: 'hsl(var(--teal))' }}>
                    ✓
                  </span>
                )}
              </h3>
               <h3 className="text-lg font-semibold mb-2 line-clamp-2" style={{ color: 'hsl(var(--foreground))' }}>
                {module.courseModules.course_full_name}
              </h3>
              
              {/* Progress bar for all users */}
              { module.courseTopics?.length > 0 && (
                <div className="mb-3">
                  <div 
                    className="w-full rounded-full h-1.5 mb-1"
                    style={{ backgroundColor: 'hsl(var(--muted))' }}
                  >
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${completionPercentage}%`,
                        backgroundColor: isCompleted ? 'hsl(var(--teal))' : 'hsl(var(--accent))'
                      }}
                    ></div>
                  </div>
                  <div className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    {completionPercentage}% completed
                    {userType !== "trainer" && " (by trainers)"}
                  </div>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {module.courseTopics?.length || 0} topics
                </span>
                <button
                  onClick={() => isUnlocked ? handleViewTopics(module) : null}
                  disabled={!isUnlocked}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg transition-colors text-sm font-medium"
                  style={{ 
                    backgroundColor: isUnlocked ? 'hsl(var(--muted))' : 'hsl(var(--muted))', 
                    color: isUnlocked ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                    cursor: isUnlocked ? 'pointer' : 'not-allowed'
                  }}
                  onMouseOver={(e) => {
                    if (isUnlocked) {
                      e.currentTarget.style.backgroundColor = 'hsl(var(--border))';
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'hsl(var(--muted))';
                  }}
                  type="button"
                >
                  {!isUnlocked ? '🔒 ' : ''}View Topics
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
          );
            })
          ) : (
            // Show message when modules array is empty but selections are made
            <div className="col-span-full text-center py-12">
              <BookOpen size={64} className="mx-auto mb-4" style={{ color: 'hsl(var(--muted-foreground))' }} />
              <h3 className="text-lg font-medium mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
                No modules found for the selected course and center
              </h3>
              <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Try clicking "Fetch Modules" button above or check if the batch has modules assigned.
              </p>
            </div>
          )
        ) : (
          // Show message when course or center is not selected
          <div className="col-span-full text-center py-12">
            <BookOpen size={64} className="mx-auto mb-4" style={{ color: 'hsl(var(--muted-foreground))' }} />
            <h3 className="text-lg font-medium mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {(userType === "SuperAdmin" || userType === "ContentAdmin") 
                ? "Please select a course and center, then click 'Fetch Modules' to view modules"
                : userType === "MasterTrainer" && !center_id
                ? "Please select a center, then click 'Fetch Modules' to view modules" 
                : "No course or center selected"}
            </h3>
          </div>
        )}
      </div>
    </div>
  );
};

// New component for displaying module topics
const ModuleTopicsView: React.FC<{ 
  module: any; 
  onBack: () => void; 
  userType: string;
  selectedCenterId: number;
  selectedCourseId: number;
}> = ({ module, onBack, userType, selectedCenterId, selectedCourseId }) => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const { selectedBatchId, user_id } = useBatch();
  const [completedTopics, setCompletedTopics] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);

  // Get completed topics from the module data (trainerReports)
  useEffect(() => {
    if (user_id && module.courseTopics) {
      const completedTopicIds = new Set<number>();
      
      module.courseTopics.forEach((topic: any) => {
        if (userType === "trainer") {
          // For trainers, check their specific reports
          if (topic.trainerReports && topic.trainerReports.some((report: any) => 
            report.trainer_id === user_id && report.mark_done === true
          )) {
            completedTopicIds.add(topic.id);
          }
        } else {
          // For other user types, check if any trainer has completed the topic
          if (topic.trainerReports && topic.trainerReports.some((report: any) => 
            report.mark_done === true
          )) {
            completedTopicIds.add(topic.id);
          }
        }
      });
      
      setCompletedTopics(completedTopicIds);
    }
  }, [userType, user_id, module.courseTopics]);

  // Calculate completion percentage
  const totalTopics = module.courseTopics?.length || 0;
  const completedCount = completedTopics.size;
  const completionPercentage = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;

  const handleMarkCompleted = async (topicId: number) => {
    if (loading) return;
    
    setLoading(true);
    try {
      // Use selectedBatchId if it's greater than 0, otherwise default to 8
      const batchId = selectedBatchId >= 0 ? selectedBatchId : 8;
      
      const data = {
        trainer_id: user_id, 
        tb_id: batchId, 
        course_id: selectedCourseId, 
        center_id: selectedCenterId, 
        module_id: module.id,
        topic_id: topicId,
        remarks: `Topic marked as completed by trainer on ${new Date().toLocaleDateString()}`
      };

      await markTopicCompleted(data);
      
      // Update local state to show the topic as completed
      setCompletedTopics(prev => new Set([...prev, topicId]));
      
      toast.success("Topic marked as completed successfully!");
      
      // Check if all topics are now completed and show celebration
      const newCompletedCount = completedCount + 1;
      if (newCompletedCount === totalTopics) {
        setTimeout(() => {
          toast.success("🎉 Module completed! You can now access the next module!", {
            duration: 4000,
          });
        }, 500);
      }
      
    } catch (error) {
      console.error("Error marking topic as completed:", error);
      toast.error("Failed to mark topic as completed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors mb-4"
          style={{ 
            backgroundColor: 'hsl(var(--muted))', 
            color: 'hsl(var(--foreground))' 
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--border))'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--muted))'}
        >
          <ChevronLeft size={20} />
          Back to Modules
        </button>
        
        <div className="rounded-xl shadow-lg p-6" style={{ backgroundColor: 'hsl(var(--card))' }}>
          <div className="flex items-start gap-4 mb-6">
            {module.module_image && (
              <img
                src={`${BACKEND_URL}${module.module_image}`}
                alt={module.title}
                className="w-20 h-20 object-cover rounded-lg"
              />
            )}
            <div>
              <h1 className="text-2xl font-bold mb-2" style={{ color: 'hsl(var(--foreground))' }}>{module.title}</h1>
              <p style={{ color: 'hsl(var(--muted-foreground))' }}>{module.courseTopics?.length || 0} topics</p>
              
              {/* Progress Bar - show for all user types */}
              { totalTopics > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                      Progress: {completedCount}/{totalTopics} topics completed 
                      {userType !== "trainer" && " (by trainers)"}
                    </span>
                    <span className="text-sm font-bold pl-2" style={{ color: 'hsl(var(--teal))' }}>
                      {completionPercentage}%
                    </span>
                  </div>
                  <div 
                    className="w-full rounded-full h-2"
                    style={{ backgroundColor: 'hsl(var(--muted))' }}
                  >
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${completionPercentage}%`,
                        backgroundColor: 'hsl(var(--teal))'
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'hsl(var(--foreground))' }}>
              <FileText style={{ color: 'hsl(var(--primary))' }} size={24} />
              Topics
            </h2>
            
            {module.courseTopics && module.courseTopics.length > 0 ? (
              <div className="grid gap-4">
                {module.courseTopics.map((topic: any, index: number) => {
                  const isCompleted = completedTopics.has(topic.id);
                  
                  return (
                  <div 
                    key={topic.id} 
                    className="rounded-lg p-4"
                    style={{ 
                      backgroundColor: isCompleted ? 'hsl(var(--teal-light))' : 'hsl(var(--muted))', 
                      border: `1px solid ${isCompleted ? 'hsl(var(--teal))' : 'hsl(var(--border))'}` 
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span 
                        className="px-3 py-1 rounded-full font-semibold text-sm flex items-center gap-1"
                        style={{ 
                          backgroundColor: isCompleted ? 'hsl(var(--teal))' : 'hsl(var(--teal-light))', 
                          color: isCompleted ? 'white' : 'hsl(var(--teal))' 
                        }}
                      >
                        {isCompleted && <Check size={12} />}
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2" style={{ color: 'hsl(var(--foreground))' }}>
                          {topic.title}
                          {isCompleted && (
                            <span className="ml-2 text-sm font-normal" style={{ color: 'hsl(var(--teal))' }}>
                              ✓ Completed
                            </span>
                          )}
                        </h3>
                        {topic.description && (
                          <p className="mb-3" style={{ color: 'hsl(var(--muted-foreground))' }}>
                            {topic.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                            Created: {new Date(topic.created_at).toLocaleDateString()}
                          </div>
                          {userType === "trainer" && !isCompleted && (
                            <button
                              onClick={() => handleMarkCompleted(topic.id)}
                              disabled={loading}
                              className="px-3 py-1 rounded-lg text-sm font-medium transition-colors"
                              style={{ 
                                backgroundColor: loading ? 'hsl(var(--muted))' : 'hsl(var(--teal-light))', 
                                color: loading ? 'hsl(var(--muted-foreground))' : 'hsl(var(--teal))',
                                cursor: loading ? 'not-allowed' : 'pointer'
                              }}
                              onMouseOver={(e) => {
                                if (!loading) {
                                  e.currentTarget.style.backgroundColor = 'hsl(var(--teal))';
                                  e.currentTarget.style.color = 'white';
                                }
                              }}
                              onMouseOut={(e) => {
                                if (!loading) {
                                  e.currentTarget.style.backgroundColor = 'hsl(var(--teal-light))';
                                  e.currentTarget.style.color = 'hsl(var(--teal))';
                                }
                              }}
                            >
                              {loading ? 'Marking...' : 'Mark Completed'}
                            </button>
                          )}
                          {userType === "trainer" && isCompleted && (
                            <div 
                              className="flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium"
                              style={{ 
                                backgroundColor: 'hsl(var(--teal))', 
                                color: 'white'
                              }}
                            >
                              <Check size={14} />
                              Completed
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12" style={{ color: 'hsl(var(--muted-foreground))' }}>
                <FileText size={64} className="mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">No topics found</h3>
                <p>This module doesn't have any topics yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};