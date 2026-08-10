import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Suspense, lazy } from "react";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { BatchProvider } from "./context/BatchContext";
import Loader from "./components/Loader";
import { SessionProvider } from "./context/SessionContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a client
const queryClient = new QueryClient();

// Lazy load components for better performance
const LoginForm = lazy(() => import("./components/LoginForm"));
const Dashboard = lazy(() => import("./components/layout/ResponsiveLayout"));
const SignupForm = lazy(() => import("./components/Signup"));
const ForgotPasswordForm = lazy(
  () => import("./components/ForgotPasswordForm")
);
const Registration = lazy(
  () => import("./components/Registration/Registration")
);

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, initialLoading } = useAuth();

  if (initialLoading) {
    return <Loader message="Initializing application..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function AppContent() {
  return (
    <>
      <Toaster position="top-right" richColors />
      <Suspense fallback={<Loader message="Loading..." />}>
        <Routes>
          <Route path="/login" element={<LoginForm />} />
          <Route path="/signup" element={<SignupForm />} />
          <Route path="/forgot-password" element={<ForgotPasswordForm />} />
          <Route path="/registration" element={<Registration />} />
          {/* Dedicated per-center apply link, e.g. /registration/gcc */}
          <Route path="/registration/:centerSlug" element={<Registration />} />
          <Route path="/itti-registration" element={<Registration />} />
          <Route
            path="/dashboard/:activeForm?"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <SessionProvider>
            <BatchProvider>
              <QueryClientProvider client={queryClient}>
                <AppContent />
              </QueryClientProvider>
            </BatchProvider>
          </SessionProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
