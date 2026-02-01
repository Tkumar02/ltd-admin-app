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
import CompanyManager from "./pages/UsefulInformation";
import RecordFiling from "./pages/RecordFiling";
import RecordExpense from "./pages/RecordExpense";
import TransactionHistory from "./pages/TransactionHistory";
import RevenueHistory from "./pages/RevenueHistory";

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
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* Pages */}
        <Route path="company-settings" element={<CompanyScreen />} />
        <Route path="dashboard" element={<DashboardScreen />} />
        <Route path="/company/:companyNumber" element={<CompanyDetails />} />
        <Route path="/confirmation-statement/:companyId" element={<ConfirmationStatement />} />
        <Route path="/info" element={<CompanyManager />} />
        <Route path="/filings/:companyId?" element={<Filings />} />
        <Route path="/record-filing/:companyId/:filingType" element={<RecordFiling />} />
        <Route path="/record-expense/:companyId" element={<RecordExpense />} />
        <Route path="/record-expense" element={<RecordExpense />} />
        <Route path="/transactions/:companyId" element={<TransactionHistory />} />
        <Route path="/edit-expense/:companyId/:transactionId" element={<RecordExpense />} />
        <Route path='/revenue-history' element={<RevenueHistory/>} />

        {/* Fallback */}
        <Route path="dashboard" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
