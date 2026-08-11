import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowRight, CheckCircle2, MapPin } from "lucide-react";
import logo from "../../assets/logo.png";
import RegistrationDetails from "./RegistrationDetails/RegistrationDetails";
import {
  getCandidateProfileByCnic,
  getCenter,
  getPublicAdmissionControl,
  getTrainingBatches,
} from "../../services/api";
import { findCenterBySlug } from "../../utils/centerSlug";

interface CenterOption {
  center_id: number;
  center_name: string;
}

type AdmissionRule = {
  center_id: number;
  course_id: number;
  allowed_gender: "all" | "male" | "female";
};

const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gray-100">
    <div className="bg-[#006537] px-4 py-2 text-center text-sm text-white">
      For admissions help:{" "}
      <a href="mailto:support@digibizz.gob.pk" className="underline">
        support@digibizz.gob.pk
      </a>
    </div>
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <div className="mb-6 flex justify-center">
        <img src={logo} alt="DigiBizz Balochistan" className="h-16 sm:h-20" />
      </div>
      {children}
    </div>
  </div>
);

/**
 * TEMPORARY: the name shown to applicants on the registration form.
 *
 * Intake is for Batch 10, but no Batch 10 row exists in training_batches yet,
 * so the batch resolved from the database still reads "Batch-9". Only the
 * label is overridden here - currentBatchId keeps resolving from the database,
 * because candidates.tb_id is a foreign key to training_batches and admissions
 * can only be opened for a batch that actually exists.
 *
 * To remove this: create Batch-10 under Settings -> Training Batches, open its
 * centers/courses under Admissions -> Admission Control, then delete this
 * constant and the line that applies it in loadAdmissionState().
 */
const ADMISSION_BATCH_LABEL = "Batch 10";

function Registration() {
  const { centerSlug } = useParams<{ centerSlug?: string }>();

  const [currentBatchId, setCurrentBatchId] = useState<number>(0);
  const [currentBatchName, setCurrentBatchName] = useState<string>("");
  const [admissionOpen, setAdmissionOpen] = useState(true);
  const [rules, setRules] = useState<AdmissionRule[]>([]);
  const [centers, setCenters] = useState<CenterOption[]>([]);
  const [bootstrapping, setBootstrapping] = useState(true);

  const [cnic, setCnic] = useState({ cnicNo: "", confirmCnicNo: "" });
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [candName, setCandName] = useState<string>("");
  const [candidateAlreadyExists, setCandidateAlreadyExists] = useState(false);
  const [studentData, setStudentData] = useState<string>("");

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
        const [batchResponse, centersData, admissionState] = await Promise.all([
          getTrainingBatches(),
          getCenter().catch(() => []),
          // Deliberately unfiltered: we need every open rule so we can work out
          // which batch admissions are actually running for, before we know
          // which batch to show.
          getPublicAdmissionControl().catch(() => null),
        ]);

        setCenters(Array.isArray(centersData) ? centersData : []);

        const sortedBatches = (batchResponse?.data || []).sort(
          (a: { tb_id: number }, b: { tb_id: number }) => b.tb_id - a.tb_id
        );

        if (sortedBatches.length === 0) {
          setAdmissionOpen(false);
          return;
        }

        const openRules = admissionState?.rules || [];

        // Applications belong to whichever batch the Admission Control panel has
        // centers/courses open on - that is the batch the candidate row is
        // written against. Picking the newest batch instead (the old behaviour)
        // advertises the batch currently in training as soon as a later batch
        // row exists but has not been opened yet, and then reports admissions
        // closed because the open rules sit on a different batch.
        const openBatchId = openRules.reduce(
          (highest, rule) => Math.max(highest, Number(rule.tb_id)),
          0
        );

        const admissionBatch =
          sortedBatches.find(
            (batch: { tb_id: number }) => Number(batch.tb_id) === openBatchId
          ) || sortedBatches[0];

        setCurrentBatchId(admissionBatch.tb_id);
        // Label only - see ADMISSION_BATCH_LABEL. The id above stays real.
        setCurrentBatchName(ADMISSION_BATCH_LABEL);

        const rulesForBatch = openRules.filter(
          (rule) => Number(rule.tb_id) === Number(admissionBatch.tb_id)
        );
        setRules(rulesForBatch);
        setAdmissionOpen(rulesForBatch.length > 0);
      } catch (error) {
        console.error("Failed to fetch admission state:", error);
        setAdmissionOpen(false);
      } finally {
        setBootstrapping(false);
      }
    };

    loadAdmissionState();
  }, []);

  /** The center this dedicated link points at (undefined on the unified form). */
  const lockedCenter = useMemo(() => {
    if (!centerSlug) return null;
    return findCenterBySlug(centers, centerSlug) || null;
  }, [centers, centerSlug]);

  const linkIsInvalid = Boolean(centerSlug) && !bootstrapping && !lockedCenter;

  const lockedCenterOpen = useMemo(() => {
    if (!lockedCenter) return false;
    return rules.some((rule) => Number(rule.center_id) === Number(lockedCenter.center_id));
  }, [lockedCenter, rules]);

  const canApply = centerSlug ? lockedCenterOpen : admissionOpen;

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
      } else if (response.admissions_open === false || !canApply) {
        setError("Admissions are currently closed for this batch");
        return;
      } else {
        // New candidate - proceed to registration
        setCandidateAlreadyExists(false); // Reset in case user tries different CNIC
        setStudentData(""); // Reset student data
        handleNext(2);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setCandidateAlreadyExists(false); // Reset on error
    } finally {
      setLoading(false);
    }
  };

  const handleNext = (stepNumber: number, name?: string) => {
    if (name) setCandName(name);
    setStep(stepNumber);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderStartScreen = () => {
    if (linkIsInvalid) {
      return (
        <PageShell>
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <AlertTriangle className="mx-auto text-orange-500" size={36} />
            <h1 className="mt-4 text-xl font-bold text-gray-900">
              This apply link is not valid
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
              We could not find a DigiBizz center for{" "}
              <span className="font-semibold">/registration/{centerSlug}</span>. The link may
              have changed.
            </p>
            <Link
              to="/registration"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#006537] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#00522c]"
            >
              Go to the main admission form
              <ArrowRight size={16} />
            </Link>
          </div>
        </PageShell>
      );
    }

    return (
      <PageShell>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="bg-[#006537] px-6 py-4 text-center text-white">
            <h1 className="text-lg font-semibold sm:text-xl">
              {currentBatchName || "Admission"} — Undertaking &amp; Registration
            </h1>
            {lockedCenter && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                <MapPin size={13} />
                Applying to {lockedCenter.center_name}
              </p>
            )}
          </div>

          <div className="p-6 sm:p-8">
            <div className="rounded-md border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider">
                Important
              </h2>
              <ul className="list-inside list-disc space-y-1">
                <li>
                  All communication regarding registration process, shortlisting process and
                  class orientation details will be done through email so please make sure you
                  provide the correct email address at time of registration.
                </li>
                <li>
                  Please check your spam or junk e-mail folder just in case email got delivered
                  there instead of your Inbox.
                </li>
              </ul>
            </div>

            {candidateAlreadyExists && !studentData && (
              <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <strong>Uh oh!</strong> You have already applied.
              </div>
            )}

            {candidateAlreadyExists && studentData && (
              <div className="mt-5 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800">
                <strong>Notice: </strong>
                <span className="font-semibold">{studentData}</span>
                <span className="mt-2 block">
                  If you want to update your information, please contact support at{" "}
                  <strong>support@digibizz.gob.pk</strong>
                </span>
              </div>
            )}

            {!bootstrapping && !canApply && (
              <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {lockedCenter
                  ? `Admissions for ${lockedCenter.center_name} are currently closed. Please check back later.`
                  : "Admissions are currently closed. Please check back later."}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="cnicNo"
                    className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-600"
                  >
                    CNIC no. <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="cnicNo"
                    placeholder="00000-0000000-0"
                    maxLength={15}
                    className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#006537] focus:outline-none focus:ring-2 focus:ring-[#006537]/15"
                    value={cnic.cnicNo}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label
                    htmlFor="confirmCnicNo"
                    className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-gray-600"
                  >
                    Confirm CNIC no. <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="confirmCnicNo"
                    placeholder="00000-0000000-0"
                    maxLength={15}
                    className="w-full rounded-md border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#006537] focus:outline-none focus:ring-2 focus:ring-[#006537]/15"
                    value={cnic.confirmCnicNo}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              <div className="mt-5 border-l-[3px] border-orange-400 bg-orange-50/60 px-4 py-3.5 text-sm text-gray-700">
                <span className="font-semibold">Note:</span> If you&apos;re under 18, please
                use B-Form Number in CNIC fields. Your admission request will be cancelled if
                you entered CNIC of someone else.
              </div>

              <div className="mt-6">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                  Undertaking
                </h3>
                <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
                  <li>
                    I fully authorize Government of Balochistan to verify the authenticity of
                    any or all of the information submitted by me according to their official
                    requirements.
                  </li>
                  <li>
                    If any forgery / discrepancy with respect to any of the information if
                    found otherwise at any stage shall result in cancellation of the
                    application, management may reserve right to the initiation of legal
                    proceedings as per rules.
                  </li>
                </ul>
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={loading || candidateAlreadyExists || !canApply || bootstrapping}
                  className="inline-flex items-center gap-2 rounded-md bg-[#006537] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#00522c] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Checking..." : "Start application"}
                  {!loading && <ArrowRight size={16} />}
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
                    className="rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Try different CNIC
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </PageShell>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return renderStartScreen();
      case 2:
        return (
          <RegistrationDetails
            cnicNo={cnic.cnicNo}
            handleNext={handleNext}
            isIttiRegistration={false}
            batchId={currentBatchId}
            batchName={currentBatchName}
            lockedCenter={lockedCenter}
          />
        );
      case 3:
        return (
          <PageShell>
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
              <CheckCircle2 className="mx-auto text-[#006537]" size={40} />
              <h1 className="mt-4 text-xl font-bold text-gray-900">
                Application submitted
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
                Thank you{candName ? `, ${candName}` : ""}. Your registration for{" "}
                {currentBatchName || "this batch"} has been received. Shortlisting and
                orientation details will be emailed to the address you provided — please check
                your spam folder too.
              </p>
              <p className="mt-6 text-xs text-gray-500">
                Questions? Email{" "}
                <a
                  href="mailto:support@digibizz.gob.pk"
                  className="font-medium text-[#006537] underline"
                >
                  support@digibizz.gob.pk
                </a>
              </p>
            </div>
          </PageShell>
        );
      default:
        return null;
    }
  };

  return <>{renderStep()}</>;
}

export default Registration;
