import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendForgotPasswordEmail, resetPassword } from "../services/api";
import bgImage from "../images/login-db-bg.jpg";
import logo from "../assets/logo.png";
import { toast } from "sonner";

export default function ForgotPasswordForm() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "verify" | "reset">("email");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendEmail = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      await sendForgotPasswordEmail(email);
      toast.success("Verification code sent to your email.");
      setStep("verify");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    try {
      // Assume verification is successful
      toast.success("Verification code verified successfully.");
      setStep("reset");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Invalid verification code."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setLoading(true);
    try {
      await resetPassword(email, verificationCode, newPassword);
      toast.success("Password reset successfully. Redirecting to login...");
      setTimeout(() => navigate("/login"), 3000); // Redirect after 3 seconds
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to reset password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-cover bg-center bg-no-repeat bg-image-container">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center">
            <img src={logo} alt="Logo" />
          </div>
          <div className="w-full h-px bg-gray-300 my-4"></div>
        </div>

        {step === "email" && (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter your email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter your email"
            />
            <button
              onClick={handleSendEmail}
              disabled={loading}
              className="mt-4 w-full py-2 px-4 bg-emerald-600 text-white rounded-md"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  <span>Sending...</span>
                </div>
              ) : (
                "Send Verification Code"
              )}
            </button>
          </>
        )}
        {step === "verify" && (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter verification code
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter verification code"
            />
            <button
              onClick={handleVerifyCode}
              disabled={loading}
              className="mt-4 w-full py-2 px-4 bg-emerald-600 text-white rounded-md"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  <span>Verifying...</span>
                </div>
              ) : (
                "Verify Code"
              )}
            </button>
          </>
        )}
        {step === "reset" && (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter new password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Enter new password"
            />
            <button
              onClick={handleResetPassword}
              disabled={loading}
              className="mt-4 w-full py-2 px-4 bg-emerald-600 text-white rounded-md"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  <span>Resetting...</span>
                </div>
              ) : (
                "Reset Password"
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
