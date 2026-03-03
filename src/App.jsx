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
import RecordRevenue from "./pages/RecordRevenue";
import ExpenseLedger from "./pages/ExpenseLedger";
import RegisterMembers from "./pages/RegisterMembers";
import FilingsHistory from "./pages/FilingsHistory";
import DemoTools from "./pages/DemoTools";
import RegisterDirectors from "./pages/RegisterDirectors";
import ShareCertificateNew from "./pages/shareCertificateNew";
import ShareCertificateView from "./pages/shareCertificateView";

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
        <Route path="/edit-revenue/:companyId/:transactionId" element={<RecordRevenue />} />
        <Route path='/revenue-history' element={<RevenueHistory/>} />
        <Route path='/record-revenue' element={<RecordRevenue/>} />
        <Route path="/record-revenue/:companyId" element={<RecordRevenue />} />
        <Route path='/expense-history' element={<ExpenseLedger/>} />  
        <Route path='/registers/:companyId/members' element={<RegisterMembers/>} />  
        <Route path="/filings/:companyId/history" element={<FilingsHistory />} />  
        <Route path="demo-tools" element={<DemoTools />} />
        <Route path="/registers/:companyId/directors" element={<RegisterDirectors />} />
        <Route path="/companies/:companyId/certificates/new" element={<ShareCertificateNew />} />
        <Route path="/companies/:companyId/certificates/:certificateId" element={<ShareCertificateView />} />      
        
        {/* Fallback */}
        <Route path="dashboard" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
