import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Edit, BookOpen, FileText, Loader2, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  createCourseModule,
  updateCourseModule,
  getAllCourse,
} from "../../services/api"; // You need to add these functions in api.ts
import { CourseModuleFormData, TopicData } from "../../types/courseModule";
import { useBatch } from "../../context/BatchContext";
import SettingsHeader from "../Settings/SettingsHeader";
import { set } from "date-fns";

interface CourseModuleFormProps {

  initialData?: Partial<CourseModuleFormData>;
  onSuccess?: () => void;
}

export const CourseModuleForm: React.FC<CourseModuleFormProps> = ({
  initialData,
  onSuccess,
}) => {
   const { userType, user_id, course_id } = useBatch();
   const [mode, setMode] = useState<string>("create");
   const [moduleId, setModuleId] = useState<number | null>(null);
   const [formData, setFormData] = useState<CourseModuleFormData>({
    course_id: initialData?.course_id || 0,
    title: initialData?.title || "",
    order_index: initialData?.order_index || 0,
    created_by: user_id,
    topics: initialData?.topics || [],
  });
   useEffect(() => {
     const modeLocal = localStorage.getItem("mode");
     if (modeLocal) {
       setMode(modeLocal);
       const courseModules = localStorage.getItem("courseModules");
       
       console.log("Mode from localStorage:", modeLocal);
       console.log("CourseModules from localStorage:", courseModules);
       
       if (courseModules && modeLocal === "edit") {
         try {
           const modules = JSON.parse(courseModules);
           console.log("Parsed course modules:", modules);
                   
           if (modules) {             
             const newFormData = {
               moduleId: modules.id,
               course_id: modules.course_id || 0,
               title: modules.title || "",
               order_index: modules.order_index || 0,
               created_by: modules.created_by || user_id,
               topics: modules.courseTopics?.map((topic: any) => ({
                 title: topic.title || "",
                 content_type: topic.content_type || "",
                 description: topic.description || "",
                 resource_link: topic.resource_link || "",
                 order_index: topic.order_index || 0,
               })) || []
             };
             console.log("Setting form data:", newFormData);
             setModuleId(newFormData.moduleId);
             setFormData(newFormData);
             
             // Set preview URL if module has an image
             if (modules.module_image) {
               setPreviewUrl(`${import.meta.env.VITE_BACKEND_URL}${modules.module_image}`);
               console.log("Setting preview URL:", `${import.meta.env.VITE_BACKEND_URL}${modules.module_image}`);
             }
           }
         } catch (error) {
           console.error("Error parsing course modules from localStorage:", error);
           console.error("Raw data that failed to parse:", courseModules);
           toast.error("Failed to load module data for editing");
         }
       }
     }
   }, [user_id]); // Removed modeLocal from dependencies since we're reading it fresh

  
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [courses, setCourses] = useState<{ course_id: number; course_name: string }[]>(
    []
  );

  useEffect(() => {
    if (userType === "SuperAdmin" || userType === "ContentAdmin") {
      getAllCourse().then((res) => {
        setCourses((res || []).filter((course: any) => course.course_status === 1));
      });
    }
  }, [userType]);

  // Add topic
  const handleAddTopic = () => {
    setFormData((prev) => ({
      ...prev,
      topics: [
        ...prev.topics,
        { 
          title: "", 
          content_type: "", 
          description: "", 
          resource_link: "",
          order_index: prev.topics.length 
        },
      ],
    }));
  };

  // Remove topic
  const handleRemoveTopic = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      topics: prev.topics.filter((_, i) => i !== idx),
    }));
  };

  // Update topic field
 const handleTopicChange = (
    idx: number,
    field: keyof TopicData,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      topics: prev.topics.map((topic, i) =>
        i === idx ? { ...topic, [field]: value } : topic
      ),
    }));
  };
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProfilePhoto(e.target.files[0]);
    }
  };
  // Handle main form field change
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      console.log("Submit called - Mode:", mode, "ModuleId:", moduleId);
      console.log("Form data:", formData);
      
      if (mode === "create") {
        formData.created_by = user_id; 
        if(userType === "MasterTrainer") {
          formData.course_id = course_id;
        }
        console.log("Creating module with data:", formData);
        await createCourseModule(formData, profilePhoto ?? undefined);
        toast.success("Module created successfully!");
      } else if (mode === "edit") {
        if (!moduleId) {
          throw new Error("Module ID is required for editing");
        }
        console.log("Updating module with ID:", moduleId, "and data:", formData);
        // Pass the profilePhoto (or undefined) as the third parameter for file upload
        await updateCourseModule(moduleId, formData, profilePhoto ?? undefined);
        toast.success("Module updated successfully!");
      } else {
        throw new Error(`Invalid mode: ${mode}`);
      }
      
      if (onSuccess) onSuccess();
      localStorage.removeItem("courseModules");
      localStorage.removeItem("mode");
    } catch (err: any) {
      console.error("Submit error:", err);
      const errorMessage = err?.response?.data?.error || err?.message || "Operation failed";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <SettingsHeader
        SettingsHeader={mode === "create" ? "Create Course Module" : "Edit Course Module"}
        SettingDescription={
          mode === "create"
            ? "Fill out the form below to create a new course module. Add topics and upload a module image if needed."
            : "Update the details of this course module. You can edit topics and change the module image."
        }
      />
      <motion.form
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.3 }}
        onSubmit={handleSubmit}
        className="max-w-8xl mx-auto p-6 rounded-lg shadow-md space-y-6"
        style={{ backgroundColor: 'hsl(var(--card))' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <BookOpen style={{ color: 'hsl(var(--primary))' }} size={28} />
          <h2 className="text-xl font-bold" style={{ color: 'hsl(var(--foreground))' }}>
            {mode === "create" ? "Create Module" : "Edit Module"}
          </h2>
        </div>
        {error && (
          <div 
            className="mb-4 p-2 text-sm rounded-lg"
            style={{ 
              color: 'hsl(var(--pink))', 
              backgroundColor: 'hsl(var(--pink-light))' 
            }}
          >
            {error}
          </div>
        )}
        <div className="space-y-4">
          {/* Only show Course ID input/select for non-MasterTrainer */}
          {userType !== "MasterTrainer" && (
            <>
              {(userType === "SuperAdmin" || userType === "ContentAdmin") ? (
                <div>
                  <label className="block font-medium mb-1" style={{ color: 'hsl(var(--foreground))' }}>Course</label>
                  <select
                    name="course_id"
                    value={formData.course_id}
                    onChange={handleChange}
                    required
                    className="w-full rounded p-2"
                    style={{ 
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--background))',
                      color: 'hsl(var(--foreground))'
                    }}
                  >
                    <option value="">Select a course</option>
                    {courses.map((course) => (
                      <option key={course.course_id} value={course.course_id}>
                        {course.course_name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-medium mb-1" style={{ color: 'hsl(var(--foreground))' }}>Course ID</label>
                  <input
                    type="number"
                    name="course_id"
                    value={formData.course_id}
                    onChange={handleChange}
                    required
                    className="w-full rounded p-2"
                    style={{ 
                      border: '1px solid hsl(var(--border))',
                      backgroundColor: 'hsl(var(--background))',
                      color: 'hsl(var(--foreground))'
                    }}
                  />
                </div>
              )}
            </>
          )}
          <div className="grid grid-cols-2 items-center gap-2">
            <div>
              <label className="block font-medium mb-1" style={{ color: 'hsl(var(--foreground))' }}>Title</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                className="w-full rounded p-2"
                style={{ 
                  border: '1px solid hsl(var(--border))',
                  backgroundColor: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))'
                }}
              />
            </div>
            <div className={profilePhoto || previewUrl ? "grid grid-cols-2 items-center gap-2" : ""}>
              <div className="flex flex-col">
                <label className="block font-medium mb-1" style={{ color: 'hsl(var(--foreground))' }}>Module Image</label>
                <label
                  htmlFor="profile-photo-upload"
                  className="flex items-center gap-2 cursor-pointer px-4 py-2 rounded transition w-fit"
                  style={{ 
                    backgroundColor: 'hsl(var(--teal-light))', 
                    border: '1px solid hsl(var(--teal))', 
                    color: 'hsl(var(--teal))' 
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--accent) / 0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--teal-light))'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"/>
                  </svg>
                  <span>
                    {profilePhoto || previewUrl ? "Change Image" : "Upload Image"}
                  </span>
                  <input
                    id="profile-photo-upload"
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*"
                  />
                </label>
              </div>
              {(profilePhoto || previewUrl) && (
                <div className="">
                  <img
                    src={profilePhoto ? URL.createObjectURL(profilePhoto) : previewUrl!}
                    alt="Module Preview"
                    className="h-24 w-24 object-cover items-end rounded"
                    style={{ border: '1px solid hsl(var(--border))' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText style={{ color: 'hsl(var(--teal))' }} size={22} />
            <span className="font-semibold" style={{ color: 'hsl(var(--foreground))' }}>Topics</span>
            <button
              type="button"
              onClick={handleAddTopic}
              className="ml-auto px-2 py-1 rounded transition"
              style={{ 
                backgroundColor: 'hsl(var(--teal-light))', 
                color: 'hsl(var(--teal))' 
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--accent) / 0.1)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'hsl(var(--teal-light))'}
            >
              <Plus size={16} /> Add Topic
            </button>
          </div>
          <AnimatePresence>
            {formData.topics.map((topic, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}
                className="mb-4 p-3 rounded-lg"
                style={{ 
                  border: '1px solid hsl(var(--border))', 
                  backgroundColor: 'hsl(var(--muted))' 
                }}
              >
                <div className="flex gap-2 items-center mb-2">
                  <textarea
                    placeholder="Topic Title"
                    value={topic.title}
                    onChange={(e) =>
                      handleTopicChange(idx, "title", e.target.value)
                    }
                    className="flex-1 rounded p-2"
                  style={{ 
                    border: '1px solid hsl(var(--border))',
                    backgroundColor: 'hsl(var(--background))',
                    color: 'hsl(var(--foreground))'
                  }}
                />
                  <button
                    type="button"
                    onClick={() => handleRemoveTopic(idx)}
                    style={{ color: 'hsl(var(--pink))' }}
                    onMouseOver={(e) => e.currentTarget.style.color = 'hsl(var(--pink) / 0.8)'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'hsl(var(--pink))'}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <textarea
                  placeholder="Description"
                  value={topic.description}
                  onChange={(e) =>
                    handleTopicChange(idx, "description", e.target.value)
                  }
                  className="w-full rounded p-2 mt-2"
                  style={{ 
                    border: '1px solid hsl(var(--border))',
                    backgroundColor: 'hsl(var(--background))',
                    color: 'hsl(var(--foreground))'
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 rounded font-semibold transition"
          style={{ 
            backgroundColor: loading ? 'hsl(var(--muted))' : 'hsl(var(--primary))', 
            color: loading ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary-foreground))' 
          }}
          onMouseOver={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = 'hsl(var(--accent))';
            }
          }}
          onMouseOut={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = 'hsl(var(--primary))';
            }
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <Loader2 className="animate-spin mr-2" /> Processing...
            </span>
          ) : mode === "create" ? (
            <>
              <Plus className="inline-block mr-2" /> Create Module
            </>
          ) : (
            <>
              <Edit className="inline-block mr-2" /> Update Module
            </>
          )}
        </button>
      </motion.form>
    </AnimatePresence>
  );
};
