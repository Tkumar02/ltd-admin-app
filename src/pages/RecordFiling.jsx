import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import dayjs from "dayjs";
import { toast, ToastContainer } from "react-toastify";

const RecordFiling = () => {
    // filingType will be "Annual Accounts", "Confirmation Statement", etc.
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [filingDate, setFilingDate] = useState(dayjs().format("YYYY-MM-DD"));

    const { companyId } = useParams(); // May be undefined if coming from Sidebar
    const [selectedCompanyId, setSelectedCompanyId] = useState(companyId || "");
    const [companies, setCompanies] = useState([]);

    // Fetch companies if no ID is provided in URL
    useEffect(() => {
        if (!companyId) {
            const fetchCompanies = async () => {
                const data = await getCompaniesByEmail(user.email);
                setCompanies(data);
            };
            fetchCompanies();
        }
    }, [companyId]);

    // Dynamic Form States
    const [formData, setFormData] = useState({
        directors: "", shareCapital: "",      // Confirmation Statement
        turnover: "", profit: "", taxPaid: "", // Accounts / Tax Return
        utrNumber: "", transactionRef: "",    // HMRC Payment
    });

    const updateField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // 1. Log the full history entry
            await addDoc(collection(db, "companies", companyId, "filingHistory"), {
                filingType,
                dateFiled: filingDate,
                submissionDetails: formData,
                createdAt: new Date()
            });

            // 2. Intelligence: Update company "Anchors" based on what was filed
            const companyRef = doc(db, "companies", companyId);
            
            if (filingType.includes("Accounts")) {
                // If accounts are filed, move the 9-month cycle forward
                await updateDoc(companyRef, { lastAccountsDate: filingDate, isFirstYear: false });
            }

            toast.success(`${filingType} recorded successfully!`);
            setTimeout(() => navigate("/dashboard"), 1500);
        } catch (error) {
            toast.error("Error saving record.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 text-gray-900 dark:text-white transition-colors">
            <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800">
                <header className="mb-8">
                    <h1 className="text-3xl font-black tracking-tighter uppercase italic">{filingType}</h1>
                    <p className="text-gray-500 text-sm mt-1">Archive submission data for your minutes book.</p>
                </header>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <section>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Submission Date</label>
                        <input type="date" className="w-full mt-2 p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 font-bold" value={filingDate} onChange={(e) => setFilingDate(e.target.value)} required />
                    </section>

                    <hr className="opacity-10" />

                    {/* DYNAMIC FIELDS BASED ON FILING TYPE */}
                    
                    {filingType.includes("Confirmation") && (
                        <div className="space-y-4">
                            <label className="block text-[10px] font-black uppercase text-blue-500">Companies House Data</label>
                            <textarea placeholder="List of current Directors" className="w-full p-4 rounded-2xl bg-gray-100 dark:bg-gray-800" onChange={e => updateField('directors', e.target.value)} required />
                            <input placeholder="Share Capital (e.g. 100 Ordinary £1)" className="w-full p-4 rounded-2xl bg-gray-100 dark:bg-gray-800" onChange={e => updateField('shareCapital', e.target.value)} required />
                        </div>
                    )}

                    {(filingType.includes("Accounts") || filingType.includes("Tax Return")) && (
                        <div className="space-y-4">
                            <label className="block text-[10px] font-black uppercase text-green-500">Financial Performance</label>
                            <div className="grid grid-cols-2 gap-4">
                                <input type="number" placeholder="Turnover (£)" className="p-4 rounded-2xl bg-gray-100 dark:bg-gray-800" onChange={e => updateField('turnover', e.target.value)} required />
                                <input type="number" placeholder="Net Profit (£)" className="p-4 rounded-2xl bg-gray-100 dark:bg-gray-800" onChange={e => updateField('profit', e.target.value)} required />
                            </div>
                        </div>
                    )}

                    {filingType.includes("Payment") && (
                        <div className="space-y-4">
                            <label className="block text-[10px] font-black uppercase text-orange-500">HMRC Payment Proof</label>
                            <input type="number" placeholder="Amount Paid (£)" className="w-full p-4 rounded-2xl bg-gray-100 dark:bg-gray-800" onChange={e => updateField('taxPaid', e.target.value)} required />
                            <input placeholder="HMRC Transaction Reference" className="w-full p-4 rounded-2xl bg-gray-100 dark:bg-gray-800" onChange={e => updateField('transactionRef', e.target.value)} required />
                        </div>
                    )}

                    <button disabled={loading} className="w-full py-5 bg-black dark:bg-white text-white dark:text-black rounded-3xl font-black uppercase tracking-widest hover:opacity-90 transition shadow-xl">
                        {loading ? "ARCHIVING..." : "LOG SUBMISSION"}
                    </button>
                </form>
            </div>
            <ToastContainer theme="dark" />
        </div>
    );
};

export default RecordFiling;