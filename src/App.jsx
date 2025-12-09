// App.jsx
import { Routes, Route, Navigate } from "react-router-dom";

import MainLayout from "./layout/MainLayout";
import CompanySettings from "./pages/CompanySettings";
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
        <Route path="company-settings" element={<CompanySettings />} />
        <Route path="dashboard" element={<DashboardScreen />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/company-settings" replace />} />
      </Route>
    </Routes>
  );
}
