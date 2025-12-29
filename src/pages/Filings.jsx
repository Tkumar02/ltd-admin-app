import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import { useNavigate } from "react-router-dom";
import { collection } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import getCompaniesByEmail from "../utils/getCompaniesByEmail";
import useCurrentUser from "../utils/getCurrentUser";

const Filings = () => {
    const navigate = useNavigate();
    const user = useCurrentUser();

    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState("");
    const [startDate, setStartDate] = useState("");
    const [deadlines, setDeadlines] = useState([]);
    const [loadingCompanies, setLoadingCompanies] = useState(true);

    // Fetch companies
    useEffect(() => {
        const fetchCompanies = async () => {
            if (!user) return;
            setLoadingCompanies(true);
            const data = await getCompaniesByEmail(user.email);
            setCompanies(data);
            setLoadingCompanies(false);
        };
        fetchCompanies();
    }, [user]);

    // Set startDate when a company is selected
    useEffect(() => {
        const company = companies.find(c => c.id === selectedCompanyId);
        if (!company) return;

        setStartDate(company.accountingStart || "");
    }, [selectedCompanyId, companies]);

    // Calculate deadlines
    useEffect(() => {
        if (!startDate) return;

        const start = dayjs(startDate);
        const end = start.add(1, "year").subtract(1, "day");

        setDeadlines([
            { title: "Confirmation Statement", date: start.add(1, "year").add(14, "days"), desc: "Annual check of company details." },
            { title: "Annual Accounts", date: start.add(21, "months"), desc: "Statutory accounts for Companies House." },
            { title: "Corporation Tax Payment", date: end.add(9, "months").add(1, "day"), desc: "Payment due to HMRC." },
            { title: "Company Tax Return", date: end.add(12, "months"), desc: "Form CT600 submission to HMRC." }
        ]);
    }, [startDate]);

    const getStatusStyle = (dueDate) => {
        const today = dayjs();
        const monthsDiff = dueDate.diff(today, "month", true);
        if (monthsDiff < 0) return { color: "#dc3545", label: "OVERDUE" };
        if (monthsDiff <= 1) return { color: "#dc3545", label: "DUE SOON" };
        if (monthsDiff <= 3) return { color: "#ffbf00", label: "APPROACHING" };
        return { color: "#007bff", label: "" };
    };

    const handleAddClick = (title) => {
        if (!selectedCompanyId) return;

        if (title === "Confirmation Statement") {
            navigate(`/confirmation-statement/${selectedCompanyId}`);
        } else {
            alert(`Add button for "${title}" clicked. Page not set up yet.`);
        }
    };

    if (!user) return <p>Loading user...</p>;
    if (loadingCompanies) return <p>Loading companies...</p>;

    return (
        <div style={{ maxWidth: "600px", margin: "2rem auto", fontFamily: "sans-serif", padding: "0 1rem" }}>
            <h1>Company Filings</h1>

            <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem" }}>Select Company:</label>
                <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    style={{ padding: "0.75rem", width: "100%", borderRadius: "6px", border: "1px solid #ced4da", fontSize: "1rem" }}
                >
                    <option value="">-- Choose a company --</option>
                    {companies.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            <div style={{ marginBottom: "2rem", padding: "1.5rem", background: "#f8f9fa", borderRadius: "12px", border: "1px solid #e9ecef" }}>
                <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem" }}>Accounting Period Start Date:</label>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ padding: "0.75rem", width: "100%", borderRadius: "6px", border: "1px solid #ced4da", fontSize: "1rem" }}
                    disabled={companies.find(c => c.id === selectedCompanyId)?.accountingStart}
                />
                {startDate && (
                    <p style={{ fontSize: "0.85rem", color: "#6c757d", marginTop: "0.5rem" }}>
                        Standard year end will be: <strong>{dayjs(startDate).add(1, "year").subtract(1, "day").format("DD MMMM YYYY")}</strong>
                    </p>
                )}
            </div>

            <div style={{ display: "grid", gap: "1rem" }}>
                {deadlines.map((item, idx) => {
                    const status = getStatusStyle(item.date);
                    return (
                        <div key={idx} style={{ padding: "1.25rem", borderLeft: `6px solid ${status.color}`, background: "#fff", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", border: "1px solid #f0f0f0" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <h3 style={{ margin: "0", fontSize: "1.1rem" }}>{item.title}</h3>
                                <span style={{ fontSize: "0.7rem", fontWeight: "bold", color: status.color, textTransform: "uppercase", letterSpacing: "1px" }}>
                                    {status.label}
                                </span>
                            </div>
                            <p style={{ margin: "0.5rem 0", fontWeight: "bold", color: status.color, fontSize: "1.2rem" }}>
                                {item.date.format("DD MMMM YYYY")}
                            </p>
                            <p style={{ margin: "0", fontSize: "0.9rem", color: "#666" }}>{item.desc}</p>
                            <button
                                onClick={() => handleAddClick(item.title)}
                                style={{ marginTop: "1rem", padding: "0.5rem 1rem", background: "#28a745", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
                            >
                                Add
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Filings;
