// App.jsx
import { Routes, Route, Navigate } from "react-router-dom";

import MainLayout from "./layout/MainLayout";
import CompanyScreen from "./pages/CompanySettings";
import CompanyDetails from "./pages/CompanyDetails";
import DashboardScreen from "./pages/Dashboard";
import Filings from "./pages/Filings";
import ConfirmationStatement from "./pages/ConfirmationStatement";
import AuthForm from "./components/AuthForm";
import ProtectedRoute from "./components/ProtectedRoute";
import FilingsPage from "./pages/Test";

export default function App() {
  return (
    <Routes>
      {/* Public login route */}
      <Route path="/login" element={<AuthForm />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        {/* Default redirect */}
        <Route index element={<Navigate to="/company-settings" replace />} />

        {/* Pages */}
        <Route path="company-settings" element={<CompanyScreen />} />
        <Route path="dashboard" element={<DashboardScreen />} />
        <Route path="/company/:companyNumber" element={<CompanyDetails />} />
        <Route path="filings" element={<Filings />} />
        <Route path="Test" element={<FilingsPage />} />
        <Route path="/confirmation-statement/:companyId" element={<ConfirmationStatement />} />

        {/* Fallback */}
        <Route path="dashboard" element={<Navigate to="/company-settings" replace />} />
      </Route>
    </Routes>
  );
}
