import React from "react";
import logo from "../../assets/logo.png";
interface RegistrationDetailsProps {
  candName: string;
  handleNext: (test: number, name?: string) => void;
}
const ThankYou: React.FC<RegistrationDetailsProps> = ({
  candName,
  handleNext,
}) => {
  return (
    <div className="bg-white">
      <div className="bg-green-700 text-white text-center py-2">
        For Admissions Help:{" "}
        <a href="mailto:support@digibizz.gob.pk" className="underline">
          support@digibizz.gob.pk
        </a>
      </div>
      <div className="flex justify-center mt-4">
        <img src={logo} alt="Digibizz Balochistan Logo" className="h-24" />
      </div>

      <div className="flex justify-center items-center flex-grow">
        <div className="bg-white border border-gray-300 rounded-md shadow-md w-full max-w-6xl p-6">
          <div className="bg-green-700 text-white text-center py-3 rounded-t-md">
            <h2 className="text-xl font-semibold">
              Admission Undertaking & Registration
            </h2>
          </div>
          <div className="flex justify-center min-h-screen mt-10 bg-white">
            <div className="max-w-4xl bg-white border border-gray-300 rounded-lg shadow-md overflow-hidden">
              <div className="bg-green-700 text-white p-5 text-center">
                <h1 className="text-2xl font-semibold">Hey, {candName}!</h1>
                <p>Thank you for your Registration in DigiBizz</p>
              </div>
              <div className="bg-blue-50 p-5">
                <div className="text-center mb-5 border-b border-gray-300 pb-2">
                  <h2 className="text-xl font-semibold">
                    Registration Status:{" "}
                    <span className="text-red-500 font-bold">Test Pending</span>
                  </h2>
                </div>
                <p className="mb-5">
                  In order to complete the the registration process for DIGIBIZZ
                  program. Kindly complete the online test within next 72 hrs.
                  In case of delay your application will be rejected.
                </p>
                <div className="mb-5">
                  <p className="font-semibold">Important:</p>
                  <ul className="list-disc pl-5">
                    <li>Your test link have been also emailed to you.</li>
                    <li>
                      Click on the button provided below to take online test.
                    </li>
                    <li>
                      Make sure you read test instructions carefully before
                      starting the test.
                    </li>
                  </ul>
                </div>
                <div className="text-center">
                  <button
                    className="bg-green-700 text-white py-2 px-4 rounded hover:bg-green-800"
                    onClick={() => handleNext(4, candName)}
                  >
                    Take Online Test
                  </button>
                </div>
              </div>
              <div className="text-center p-3 text-gray-500 text-sm">
                <p>Copyright © 2025 - DigiBizz Balochistan</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThankYou;
