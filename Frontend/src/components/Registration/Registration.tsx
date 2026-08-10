import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import logo from "../../assets/logo.png";
import RegistrationDetails from "./RegistrationDetails/RegistrationDetails";
import {
  getCandidateProfileByCnic,
  getPublicAdmissionControl,
  getTrainingBatches,
} from "../../services/api";

function Registration() {
  const [currentBatchId, setCurrentBatchId] = useState<number>(0);
  const [currentBatchName, setCurrentBatchName] = useState<string>("");
  const [admissionOpen, setAdmissionOpen] = useState(true);

  const [cnic, setCnic] = useState({
    cnicNo: "",
    confirmCnicNo: "",
  });
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [, setCandName] = useState("");
  const [candidateAlreadyExists, setCandidateAlreadyExists] = useState(false);
  const [studentData, setStudentData] = useState<string>("");
  const { centerId: centerIdParam } = useParams<{ centerId?: string }>();
  const routeCenterId = Number(centerIdParam || 0);
  const isCenterRegistration = routeCenterId > 0;

  const registrationHeader = isCenterRegistration
    ? "Center-Specific Admission & Registration"
    : "Batch 10 Admission Undertaking & Registration";

  const formatCnic = (value: string) => {
    const cleanedValue = value.replace(/\D/g, "");
    // Limit to 13 digits maximum
    const limitedValue = cleanedValue.substring(0, 13);
    const match = limitedValue.match(/^(\d{0,5})(\d{0,7})(\d{0,1})$/);
    if (!match) return "";
    return [match[1], match[2], match[3]].filter(Boolean).join("-");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    const formattedValue = formatCnic(value);
    setCnic((prev) => ({ ...prev, [id]: formattedValue }));
  };

  useEffect(() => {
    const loadAdmissionState = async () => {
      try {
        const batchResponse = await getTrainingBatches();
        const sortedBatches = (batchResponse?.data || []).sort(
          (a: { tb_id: number }, b: { tb_id: number }) => b.tb_id - a.tb_id
        );

        if (sortedBatches.length > 0) {
          const latestBatch = sortedBatches[0];
          const latestBatchId = latestBatch.tb_id;
          setCurrentBatchId(latestBatchId);
          setCurrentBatchName(latestBatch.tb_name || `Batch-${latestBatchId}`);
          const admissionState = await getPublicAdmissionControl(latestBatchId);
          setAdmissionOpen((admissionState?.totalOpen || 0) > 0);
        } else {
          setCurrentBatchId(0);
          setCurrentBatchName("");
          setAdmissionOpen(false);
        }
      } catch (error) {
        console.error("Failed to fetch admission state:", error);
        setCurrentBatchId(0);
        setCurrentBatchName("");
        setAdmissionOpen(false);
      }
    };

    loadAdmissionState();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (cnic.cnicNo !== cnic.confirmCnicNo) {
      setError("CNIC numbers do not match");
      setLoading(false);
      return;
    }

    // Check if CNIC has exactly 13 digits (excluding dashes)
    const cleanedCnic = cnic.cnicNo.replace(/\D/g, "");
    if (cleanedCnic.length !== 13) {
      setError("CNIC must be exactly 13 digits long");
      setLoading(false);
      return;
    }

    if (!currentBatchId) {
      setError("No active training batch found for admissions");
      setLoading(false);
      return;
    }

    try {
      const response = await getCandidateProfileByCnic(cnic.cnicNo, currentBatchId);
      if (response.success) {
        // Candidate already exists - show warning and BLOCK registration
        setCandName(response.name);
        setCandidateAlreadyExists(true);
        if (response.message && response.message !== "Candidate found") {
          setStudentData(response.message);
        }
        // Stay on current step - do NOT proceed
        return;
      } else if (response.admissions_open === false || !admissionOpen) {
        setError("Admissions are currently closed for this batch");
        return;
      } else {
        // New candidate - proceed to registration
        setCandidateAlreadyExists(false); // Reset in case user tries different CNIC
        setStudentData(""); // Reset student data
        handleNext(2, "John Doe");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setCandidateAlreadyExists(false); // Reset on error
    } finally {
      setLoading(false);
    }
  };
  const handleNext = (stepNumber: number, name?: string) => {
    setStep(stepNumber);
  };
  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="bg-white">
            <div className="bg-green-700 text-white text-center py-2">
              For Admissions Help:{" "}
              <a href="mailto:support@digibizz.gob.pk" className="underline">
                support@digibizz.gob.pk
              </a>
            </div>
            <div className="flex justify-center mt-4">
              <img
                src={logo}
                alt="Digibizz Balochistan Logo"
                className="h-24"
              />
            </div>

            <div className="flex justify-center items-center flex-grow">
              <div className="bg-white border border-gray-300 rounded-md shadow-md w-full max-w-6xl p-6">
                <div className="bg-green-700 text-white text-center py-3 rounded-t-md">
                  <h2 className="text-xl font-semibold">
                    {registrationHeader}
                  </h2>
                </div>
                <div className="p-4">
                  <div className="bg-blue-100 p-4 rounded-md mb-4">
                    <h3 className="font-semibold mb-2 text-lg">Important:</h3>
                    <ul className="list-disc list-inside text-base">
                      <li>
                        All communication regarding registration process,
                        shortlisting process and class orientation details will
                        be done through email so please make sure you provide
                        the correct email address at time of registration.
                      </li>
                      <li>
                        Please check your spam or junk e-mail folder just in
                        case email got delivered there instead of your Inbox.
                      </li>
                    </ul>
                  </div>
                  {candidateAlreadyExists && !studentData && (
                    <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded-md mb-4">
                      <strong>Uh ho!</strong> You have already applied.{" "}
                      {/* <button
                        className="text-white bg-blue-500 px-4 py-2 rounded-md hover:bg-blue-600 focus:outline-none"
                        onClick={() => handleNext(4)}
                      >
                        Check your Admission Status
                      </button> */}
                    </div>
                  )}
                  {candidateAlreadyExists && studentData && (
                    <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 p-4 rounded-md mb-4">
                      <strong>Notice: </strong>
                      <span className="font-semibold">{studentData}</span>
                      <span className="block mt-2">
                        If you want to update your information, please contact
                        support. <strong>support@digibizz.gob.pk</strong>
                      </span>
                    </div>
                  )}
                  <form onSubmit={handleSubmit}>
                    {!admissionOpen && (
                      <div className="bg-red-100 border border-red-400 text-red-700 p-4 rounded-md mb-4">
                        Admissions are currently closed. Please check back later.
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <div className="">
                        <label
                          htmlFor="cnicNo"
                          className="block text-gray-700 text-sm font-bold mb-2"
                        >
                          CNIC No.
                        </label>
                        <input
                          type="text"
                          id="cnicNo"
                          placeholder="00000-0000000-0"
                          maxLength={15}
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                          value={cnic.cnicNo}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="">
                        <label
                          htmlFor="confirmCnicNo"
                          className="block text-gray-700 text-sm font-bold mb-2"
                        >
                          Confirm CNIC No.
                        </label>
                        <input
                          type="text"
                          id="confirmCnicNo"
                          placeholder="00000-0000000-0"
                          maxLength={15}
                          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                          value={cnic.confirmCnicNo}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                    {error && (
                      <p className="text-red-500 text-sm mb-4">{error}</p>
                    )}
                    <div className="bg-yellow-100 p-4 rounded-md mb-4">
                      <p className="text-sm text-base">
                        <span className="font-semibold">Note:</span> If you're
                        under 18, please use B-Form Number in CNIC fields. Your
                        Admission request will be cancelled if you entered CNIC
                        of someone else.
                      </p>
                    </div>
                    <div className="mb-4">
                      <h3 className="font-semibold mb-2 text-lg">
                        Undertaking
                      </h3>
                      <ul className="list-disc list-inside text-base">
                        <li>
                          I fully authorize Government of Balochistan to verify
                          the authenticity of any or all of the information
                          submitted by me according to their official
                          requirements.
                        </li>
                        <li>
                          If any forgery / discrepancy with respect to any of
                          the information if found otherwise at any stage shall
                          result in cancellation of the application, management
                          may reserve right to the initiation of legal
                          proceedings as per rules.
                        </li>
                      </ul>
                    </div>
                    <div className="flex gap-4">
                      <button
                        type="submit"
                        disabled={loading || candidateAlreadyExists || !admissionOpen || !currentBatchId}
                        className={`font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
                          candidateAlreadyExists
                            ? "bg-gray-400 cursor-not-allowed"
                            : "bg-orange-500 hover:bg-orange-700 text-white"
                        }`}
                      >
                        {loading ? "Checking..." : "Next >>"}
                      </button>
                      {candidateAlreadyExists && (
                        <button
                          type="button"
                          onClick={() => {
                            setCandidateAlreadyExists(false);
                            setStudentData("");
                            setCnic({ cnicNo: "", confirmCnicNo: "" });
                            setError("");
                          }}
                          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        >
                          Try Different CNIC
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <RegistrationDetails
            cnicNo={cnic.cnicNo}
            handleNext={handleNext}
            isIttiRegistration={false}
            batchId={currentBatchId}
            batchName={currentBatchName}
            fixedCenterId={routeCenterId}
            routeLabel={registrationHeader}
          />
        );
      // case 3:
      //   return <ThankYou candName={candName} handleNext={handleNext} />;
      // case 4:
      //   return <TestInstructions candName={candName} handleNext={handleNext} />;
      // case 5:
      //   return (
      //     <QuizInterface
      //       candName={candName}
      //       handleNext={handleNext}
      //       cnicNo={cnic.cnicNo}
      //     />
      //   );
      default:
        return null;
    }
  };
  return <>{renderStep()}</>;
}

export default Registration;
