import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, CreditCard, Eye, EyeOff } from "lucide-react";
import bgImage from "../images/login-db-bg.jpg";
import logo from "../assets/logo.png";
import { changeStudentPassword, getStudentsByCNIC } from "../services/api";
import { toast } from "sonner";

interface SignupFormData {
  user_id: number;
  password: string;
  confirmPassword: string;
  currentPassword?: string;
}

export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [cnic, setCnic] = useState<string>("");
  const [formData, setFormData] = useState<SignupFormData>({
    user_id: 0,
    password: "",
    confirmPassword: "",
    currentPassword: "",
  });

  const handleCnicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (cnic?.length !== 15) {
      setError("Please enter a valid 13-digit CNIC number");
      toast.error("Please enter a valid 13-digit CNIC number");
      return;
    }

    setLoading(true);
    try {
      const response = await getStudentsByCNIC(cnic);

      if (response.success) {
        if(response.message === "Student profile is Already available") {
          setError("Student profile already exists");
          toast.error(`Student profile already exists ${response.data.user_email}`);
          
          setTimeout(() => {
            navigate("/login");
          }, 2000);
        }
        if (response.data.user_id) {
          setFormData((prev) => ({
            ...prev,
            user_id: response.data.user_id,
          }));
          setStep(2);
          toast.success("CNIC verified successfully");
        } else {
          setError("User ID not found in response");
          toast.error("User ID not found in response");
        }
      } else {
        // Check if the error message is related to student suspension
        if (response.message && response.message.startsWith("Student is suspended:")) {
          setError(response.message);
          toast.error(response.message);
        } else {
          setError(response.message || "CNIC verification failed");
          toast.error(response.message || "CNIC verification failed");
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "CNIC verification failed";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await changeStudentPassword({
        currentPassword: formData.currentPassword || "",
        newPassword: formData.password,
        user_id: formData.user_id,
      });

      if (response.success) {
        toast.success("Password changed successfully! Redirecting to login...");
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        setError(response.message || "Password change failed");
        toast.error(response.message || "Password change failed");
        setLoading(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Signup failed";
      setError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  const formatCNIC = (input: string) => {
    const numbersOnly = input.replace(/\D/g, "");
    const cnicWithDashes = numbersOnly.replace(
      /(\d{5})(\d{7})(\d{1})/,
      "$1-$2-$3"
    );
    return cnicWithDashes;
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

        {error && (
          <div className="mb-4 p-4 text-sm text-red-700 bg-red-100 rounded-lg">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleCnicSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="cnic"
                className="block text-sm font-medium text-gray-700"
              >
                CNIC Number
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CreditCard className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="cnic"
                  type="text"
                  required
                  maxLength={15} // Updated to account for dashes
                  value={cnic}
                  onChange={(e) => {
                    const input = e.target.value;
                    const numbersOnly = input.replace(/\D/g, "");
                    if (numbersOnly.length <= 13) {
                      setCnic(formatCNIC(input));
                    }
                  }}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  placeholder="00000-0000000-0"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || cnic?.length !== 15}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                "Continue"
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-6">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700"
              >
                New Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockKeyhole className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onMouseDown={() => setShowPassword(true)}
                  onMouseUp={() => setShowPassword(false)}
                  onMouseLeave={() => setShowPassword(false)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700"
              >
                Confirm Password
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockKeyhole className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                  className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onMouseDown={() => setShowConfirmPassword(true)}
                  onMouseUp={() => setShowConfirmPassword(false)}
                  onMouseLeave={() => setShowConfirmPassword(false)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  "Sign Up"
                )}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                Already have an account?
              </span>
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full flex justify-center py-2 px-4 border-2 border-emerald-600 rounded-md shadow-sm text-sm font-medium text-emerald-600 bg-white hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors duration-200"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
