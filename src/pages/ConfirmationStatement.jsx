// pages/ConfirmationStatement.jsx
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
    collection,
    addDoc,
    doc,
    getDoc,
    query,
    where,
    orderBy,
    limit,
    getDocs
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

const ConfirmationStatement = () => {
    const { companyId } = useParams();
    const [company, setCompany] = useState(null);
    const [formData, setFormData] = useState({
        directorNames: "",
        secretaryNames: "",
        registeredAddress: "",
        shareholderInfo: "",
        otherChanges: "",
        accountingPeriodStart: ""
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCompanyAndCS = async () => {
            setLoading(true);

            try {
                // 1️⃣ Fetch company document
                const companySnap = await getDoc(doc(db, "companies", companyId));
                if (!companySnap.exists()) {
                    setLoading(false);
                    return;
                }
                const companyData = companySnap.data();
                setCompany(companyData);

                // Prefill registered address immediately
                setFormData(prev => ({
                    ...prev,
                    registeredAddress: companyData.registeredAddress || ""
                }));

                // 2️⃣ Try to fetch latest previous Confirmation Statement
                const filingsRef = collection(db, "companies", companyId, "filings");
                const csQuery = query(
                    filingsRef,
                    where("type", "==", "Confirmation Statement"),
                    orderBy("createdAt", "desc"),
                    limit(1)
                );
                const csSnap = await getDocs(csQuery);
                if (!csSnap.empty) {
                    const lastCS = csSnap.docs[0].data();
                    setFormData(prev => ({
                        ...prev,
                        directorNames: lastCS.directorNames || "",
                        secretaryNames: lastCS.secretaryNames || "",
                        shareholderInfo: lastCS.shareholderInfo || "",
                        otherChanges: lastCS.otherChanges || "",
                        accountingPeriodStart: lastCS.accountingPeriodStart || ""
                    }));
                }
                // If no previous CS exists, fields remain blank
            } catch (err) {
                console.error("Error fetching company or previous CS:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchCompanyAndCS();
    }, [companyId]);

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const filingsRef = collection(db, "companies", companyId, "filings");
            await addDoc(filingsRef, {
                type: "Confirmation Statement",
                ...formData,
                createdAt: new Date(),
                hasFiled: false
            });
            alert("Confirmation Statement saved successfully!");
        } catch (err) {
            console.error("Error saving confirmation statement:", err);
            alert("Failed to save confirmation statement");
        }
    };

    if (loading) return <p>Loading company info...</p>;
    if (!company) return <p>Company not found.</p>;

    return (
        <div
            style={{
                maxWidth: "600px",
                margin: "2rem auto",
                fontFamily: "sans-serif",
                padding: "0 1rem"
            }}
        >
            <h1>Add Confirmation Statement for {company.name}</h1>
            <form
                onSubmit={handleSubmit}
                style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
            >
                <div>
                    <label>Accounting Period Start Date:</label>
                    <input
                        type="date"
                        name="accountingPeriodStart"
                        value={formData.accountingPeriodStart}
                        onChange={handleChange}
                        style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "4px",
                            border: "1px solid #ccc"
                        }}
                    />
                </div>

                <div>
                    <label>Director Names:</label>
                    <input
                        type="text"
                        name="directorNames"
                        value={formData.directorNames}
                        onChange={handleChange}
                        style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "4px",
                            border: "1px solid #ccc"
                        }}
                    />
                </div>

                <div>
                    <label>Secretary Names:</label>
                    <input
                        type="text"
                        name="secretaryNames"
                        value={formData.secretaryNames}
                        onChange={handleChange}
                        style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "4px",
                            border: "1px solid #ccc"
                        }}
                    />
                </div>

                <div>
                    <label>Registered Address:</label>
                    <input
                        type="text"
                        name="registeredAddress"
                        value={formData.registeredAddress}
                        onChange={handleChange}
                        style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "4px",
                            border: "1px solid #ccc"
                        }}
                        required
                    />
                </div>

                <div>
                    <label>Shareholder Info:</label>
                    <textarea
                        name="shareholderInfo"
                        value={formData.shareholderInfo}
                        onChange={handleChange}
                        style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "4px",
                            border: "1px solid #ccc"
                        }}
                    />
                </div>

                <div>
                    <label>Other Changes / Notes:</label>
                    <textarea
                        name="otherChanges"
                        value={formData.otherChanges}
                        onChange={handleChange}
                        style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "4px",
                            border: "1px solid #ccc"
                        }}
                    />
                </div>

                <button
                    type="submit"
                    style={{
                        padding: "0.75rem",
                        background: "#007bff",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer"
                    }}
                >
                    Save Confirmation Statement
                </button>
            </form>
        </div>
    );
};

export default ConfirmationStatement;
