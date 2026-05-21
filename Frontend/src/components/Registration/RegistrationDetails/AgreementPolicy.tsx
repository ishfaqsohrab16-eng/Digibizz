import React from "react";

interface AgreementPolicyProps {
  errors: { [key: string]: string };
}

const AgreementPolicy: React.FC<AgreementPolicyProps> = ({ errors }) => {
  return (
    <div className="p-2 rounded-md">
      <h3 className="font-semibold mb-2 text-lg text-[#18636f]">
        Agreement & Policy
      </h3>
      <div className="bg-[#cff4fc] p-4 rounded-md mb-4">
        <ul className="list-disc list-inside text-sm text-[#18636f]">
          <h1 className="list-disc list-inside text-md text-[#18636f]">
            Important:
          </h1>
          <li>
            You must enter a valid and active Mobile No. and Email address at
            time of registration.
          </li>
          <li>
            All communication regarding registration process, shortlisting
            process and class orientation details will be done through email.
          </li>
          <li>
            Please check your spam or junk e-mail folder just in case email got
            delivered there instead of your Inbox.
          </li>
          <li>
            If so, select the confirmation message and mark it Not Spam, which
            should allow future messages to get through.
          </li>
        </ul>
      </div>
      <div className="flex items-center mb-4">
        <label htmlFor="agreeToTerms" className="text-sm">
          I agree to the{" "}
          <a href="https://digibizz.gob.pk/terms" className="underline">
            Terms & Conditions
          </a>{" "}
          and{" "}
          <a href="https://digibizz.gob.pk/policy" className="underline">
            Program Policy
          </a>
        </label>
      </div>
      {errors.agreeToTerms && (
        <p className="text-red-500 text-xs mt-1">{errors.agreeToTerms}</p>
      )}
    </div>
  );
};

export default AgreementPolicy;
