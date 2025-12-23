// App.jsx
import { Routes, Route, Navigate } from "react-router-dom";

import MainLayout from "./layout/MainLayout";
import CompanyScreen from "./pages/CompanySettings";
import CompanyDetails from "./pages/CompanyDetails";
import DashboardScreen from "./pages/Dashboard";
import AuthForm from "./components/AuthForm";
import ProtectedRoute from "./components/ProtectedRoute";

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

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/company-settings" replace />} />
      </Route>
    </Routes>
  );
}
