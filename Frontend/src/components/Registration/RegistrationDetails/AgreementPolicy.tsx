import React from "react";

interface AgreementPolicyProps {
  errors: { [key: string]: string };
  agreeToTerms: boolean;
  onAgreeChange: (checked: boolean) => void;
}

const AgreementPolicy: React.FC<AgreementPolicyProps> = ({
  errors,
  agreeToTerms,
  onAgreeChange,
}) => {
  return (
    <div>
      <div className="rounded-md border border-sky-100 bg-sky-50 p-4">
        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-sky-900">
          Important
        </h4>
        <ul className="list-inside list-disc space-y-1 text-sm text-sky-900">
          <li>
            You must enter a valid and active Mobile No. and Email address at time of
            registration.
          </li>
          <li>
            All communication regarding registration process, shortlisting process and class
            orientation details will be done through email.
          </li>
          <li>
            Please check your spam or junk e-mail folder just in case email got delivered
            there instead of your Inbox.
          </li>
          <li>
            If so, select the confirmation message and mark it Not Spam, which should allow
            future messages to get through.
          </li>
        </ul>
      </div>

      <label
        htmlFor="agreeToTerms"
        className={`mt-5 flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3.5 transition-colors ${
          errors.agreeToTerms ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"
        }`}
      >
        <input
          type="checkbox"
          id="agreeToTerms"
          name="agreeToTerms"
          checked={agreeToTerms}
          onChange={(e) => onAgreeChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#006537]"
        />
        <span className="text-sm text-gray-700">
          I agree to the{" "}
          <a
            href="https://digibizz.gob.pk/terms"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-[#006537] underline"
          >
            Terms &amp; Conditions
          </a>{" "}
          and{" "}
          <a
            href="https://digibizz.gob.pk/policy"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-[#006537] underline"
          >
            Program Policy
          </a>
          .
        </span>
      </label>
      {errors.agreeToTerms && (
        <p className="mt-1.5 text-xs text-red-600">{errors.agreeToTerms}</p>
      )}
    </div>
  );
};

export default AgreementPolicy;
