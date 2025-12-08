import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../firebase/firebaseAuth.jsx";

export default function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return <div className="p-4">Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
}
