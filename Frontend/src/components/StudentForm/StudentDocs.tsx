import React, { useState, useEffect } from "react";
import { FileCheck, FileX, Upload, AlertCircle } from "lucide-react";
import { FreelancingProfile } from "./FreelancingProfile";
import { useBatch } from "../../context/BatchContext";
import { getStudentDocuments, StudentDocument } from "../../services/api";

import "react-toastify/dist/ReactToastify.css"; // Import toast styles
import { toast } from "sonner";

interface StudentDoc {
  doc_id: number;
  std_cnic: string;
  doc_type: string;
  doc_file: string;
  doc_status: number;
  doc_date: string;
}
export interface StudentDocumentFormData {
  std_user_id: number;
  tb_id: number;
  doc_type: string;
  doc_file: string;
  doc_status: number;
  doc_date: string;
}

const DOCUMENT_TYPES = {
  passport_photo: {
    label: "Passport Size Photo",
    value: "passport_photo",
  },
  cnic_front: {
    label: "CNIC Front",
    value: "cnic_front",
  },
  cnic_back: {
    label: "CNIC Back",
    value: "cnic_back",
  },
  domicile: {
    label: "Balochistan or Local Domicile",
    value: "domicile",
  },
  degree: {
    label: "Latest Degree",
    value: "degree",
  },
} as const;

const DOC_STATUS = {
  NOT_UPLOADED: -1,
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
} as const;

const DOC_STATUS_LABELS = {
  [-1]: { text: "Not Uploaded", icon: FileX, color: "red" },
  [0]: { text: "Pending", icon: AlertCircle, color: "yellow" },
  [1]: { text: "Approved", icon: FileCheck, color: "green" },
  [2]: { text: "Rejected", icon: FileX, color: "red" },
} as const;

export function StudentDocs() {
  const [formData, setFormData] = useState<StudentDocumentFormData>({
    std_user_id: 0,
    tb_id: 0,
    doc_type: "",
    doc_file: "",
    doc_status: 0,
    doc_date: "",
  });
  const [docs, setDocs] = useState<StudentDoc[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { selectedBatchId, user_id, stdCNIC } = useBatch();

  const fetchStudentDocuments = async () => {
    try {
      const response = await getStudentDocuments(user_id);
      setDocs(response);
    } catch (error) {
      console.error("Error fetching student documents:", error);
    }
  };

  useEffect(() => {
    fetchStudentDocuments();
  }, []);

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    docType: keyof typeof DOCUMENT_TYPES
  ) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadingFor(docType);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadingFor) return;

    try {
      setIsLoading(true);
      setError(null);

      const newFormData = {
        std_cnic: stdCNIC,
        std_user_id: user_id,
        tb_id: selectedBatchId,
        doc_type: uploadingFor,
        doc_file: selectedFile.name,
        doc_status: DOC_STATUS.PENDING,
        doc_date: new Date().toISOString(),
      };

      const response = await StudentDocument(
        newFormData,
        selectedFile,
        user_id
      );

      if (response) {
        if (Array.isArray(response)) {
          // If the response is an array, replace the entire docs state
          setDocs(response);
        } else {
          // If the response is a single document, update the specific document
          const newDoc = {
            doc_id: response.doc_id,
            std_cnic: response.std_cnic,
            doc_type: response.doc_type,
            doc_file: response.doc_file,
            doc_status: response.doc_status,
            doc_date: response.doc_date,
          };

          setDocs((prevDocs) => [
            ...prevDocs.filter((doc) => doc.doc_type !== uploadingFor),
            newDoc,
          ]);
        }

        toast.success("Document uploaded successfully!"); // Show success toast
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to upload document";
      setError(errorMessage);
      toast.error(errorMessage); // Show error toast
    } finally {
      setIsLoading(false);
      setUploadingFor(null);
      setSelectedFile(null);
    }
  };

  const getDocStatus = (docType: keyof typeof DOCUMENT_TYPES) => {
    const doc = docs.find((d) => d.doc_type === DOCUMENT_TYPES[docType].value);
    return doc ? doc.doc_status : DOC_STATUS.NOT_UPLOADED;
  };

  const getLastUpdate = (docType: keyof typeof DOCUMENT_TYPES) => {
    const doc = docs.find((d) => d.doc_type === DOCUMENT_TYPES[docType].value);
    if (!doc) return "Never";

    const date = new Date(doc.doc_date);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const documentExists = (docType: keyof typeof DOCUMENT_TYPES) => {
    const doc = docs.find(
      (doc) => doc.doc_type === DOCUMENT_TYPES[docType].value
    );
    return (
      doc?.doc_status === DOC_STATUS.PENDING ||
      doc?.doc_status === DOC_STATUS.APPROVED
    );
  };

  const renderActionButtons = (key: keyof typeof DOCUMENT_TYPES) => {
    const status = getDocStatus(key);
    const isDocumentUploaded = documentExists(key);

    if (isDocumentUploaded) {
      return <span className="text-sm text-gray-500">Already submitted</span>;
    }

    return (
      <div className="flex items-center space-x-3">
        <input
          type="file"
          id={`file-${key}`}
          className="hidden"
          onChange={(e) => handleFileSelect(e, key)}
          accept=".pdf,.jpg,.jpeg,.png"
          disabled={isLoading}
        />
        <label
          htmlFor={`file-${key}`}
          className={`
            inline-flex items-center px-3 py-2 text-sm font-medium rounded-md
            ${
              isLoading && uploadingFor === key
                ? "bg-blue-100 text-blue-800 cursor-wait"
                : "bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer"
            }
            transition-colors duration-200
          `}
        >
          <Upload className="w-4 h-4 mr-2" />
          {isLoading && uploadingFor === key
            ? "Uploading..."
            : status === DOC_STATUS.REJECTED
            ? "Re-upload"
            : "Upload"}
        </label>
        {selectedFile && uploadingFor === key && (
          <button
            onClick={handleUpload}
            disabled={isLoading}
            className={`
              px-3 py-2 text-sm font-medium text-white rounded-md
              ${
                isLoading
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }
              transition-colors duration-200
            `}
          >
            {isLoading ? "Sending..." : "Send"}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-8xl mx-auto">
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 header-gradient border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-100">
            Student Documents
          </h2>
          <div className="mt-2 flex items-center text-sm text-amber-200">
            <AlertCircle className="w-4 h-4 mr-2" />
            Documents must be Original Scanned and clearly visible.
          </div>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">
                    Document Type
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">
                    Last Update
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(DOCUMENT_TYPES).map(([key, doc]) => (
                  <tr
                    key={key}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="py-4 px-4">
                      <span className="font-medium text-gray-900">
                        {doc.label}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-sm text-gray-500">
                        {getLastUpdate(key as keyof typeof DOCUMENT_TYPES)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center">
                        {(() => {
                          const status = getDocStatus(
                            key as keyof typeof DOCUMENT_TYPES
                          );
                          const statusInfo =
                            DOC_STATUS_LABELS[
                              status as keyof typeof DOC_STATUS_LABELS
                            ] || DOC_STATUS_LABELS[-1];
                          const Icon = statusInfo.icon;

                          return (
                            <>
                              <Icon
                                className={`w-5 h-5 text-${statusInfo.color}-500 mr-2`}
                              />
                              <span
                                className={`text-sm text-${statusInfo.color}-600`}
                              >
                                {statusInfo.text}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {renderActionButtons(key as keyof typeof DOCUMENT_TYPES)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <FreelancingProfile />
    </div>
  );
}
