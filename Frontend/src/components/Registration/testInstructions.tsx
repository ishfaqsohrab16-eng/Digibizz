import React from "react";
import logo from "../../assets/logo.png";
interface RegistrationDetailsProps {
  candName: string;
  handleNext: (test: number, name?: string) => void;
}
const TestInstructions: React.FC<RegistrationDetailsProps> = ({
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
              Batch-8 Admission Undertaking & Registration
            </h2>
          </div>
          <div className="flex flex-col bg-gray-100">
            <main className="container mx-auto p-4 border border-gray-300 rounded-md">
              <header className="bg-green-700 text-white text-center py-4">
                <h1 className="text-2xl font-bold">Hey, {candName}!</h1>
                <h2 className="text-xl">Test Instructions</h2>
              </header>
              <div className="bg-blue-100 p-4 rounded-md mb-4">
                <p className="text-red-600 font-bold">
                  Remaining Test Attempts: 3
                </p>
                <p className="font-bold">Maximum Time: 20 Minutes</p>
              </div>
              <div className="bg-white p-6 rounded-md shadow-md">
                <h3 className="text-xl font-semibold mb-4">
                  Please read the instructions carefully before you attempt the
                  online test.
                </h3>
                <ul className="list-decimal list-inside">
                  <li>Total duration of this test is 20 minutes.</li>
                  <li className="text-red-600">
                    Do not change your Test Tab/Window during test. Otherwise
                    test attempt will be wasted and your application may be
                    rejected.
                  </li>
                  <li className="text-red-600">
                    You can only attempt test 3 times to complete it. However,
                    once you complete the whole test you cannot attempt it
                    again.
                  </li>
                  <li>
                    Complete the test in given time, in case of delay your
                    application will be rejected.
                  </li>
                  <li>
                    Be careful about electricity/internet outage during online
                    test; it is preferable you make sure you have
                    electricity/internet backup.
                  </li>
                  <li>
                    You are advised to spend one minute for each question as the
                    total number of questions are 20.
                  </li>
                  <li>
                    Follow the instruction carefully before starting the test as
                    only one chance can be availed using your CNIC No. for
                    registration purposes.
                  </li>
                  <li>
                    After completing the test in the given time, the merit list
                    will be issued and selection will be on merit.
                  </li>
                </ul>
                <div className="text-center mt-6">
                  <button
                    className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                    onClick={() => handleNext(5, candName)}
                  >
                    Start Test
                  </button>
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestInstructions;
