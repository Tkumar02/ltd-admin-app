import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import { doc, getDoc, updateDoc, collection, addDoc } from "firebase/firestore";
import getCompaniesByEmail from "../utils/getCompaniesByEmail";
import useCurrentUser from "../utils/getCurrentUser";
import dayjs from "dayjs";
import { toast, ToastContainer } from "react-toastify";

const RecordExpense = () => {
    const { companyId, transactionId } = useParams();
    const isEditing = !!transactionId;
    const navigate = useNavigate();
    const user = useCurrentUser();

    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState(companyId || "");
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        date: dayjs().format("YYYY-MM-DD"),
        category: "Subsistence (Food/Drink)",
        amount: "",
        payee: "",
        notes: "",
    });

    const categories = [
        { label: "Consulting / Freelance Fees", taxDeductible: true },
        { label: "Software & Subscriptions", taxDeductible: true },
        { label: "Pension Contribution (Company)", taxDeductible: true },
        { label: "Travel & Transport", taxDeductible: true },
        { label: "Subsistence (Business Travel Food)", taxDeductible: true },
        { label: "Home Office Allowance", taxDeductible: true },
        { label: "Professional Fees (Accountancy/Legal)", taxDeductible: true },
        { label: "Marketing & Advertising", taxDeductible: true },
        { label: "Insurance (Public Liability/PI)", taxDeductible: true },
        { label: "Office Supplies & Postage", taxDeductible: true },
        { label: "Bank Charges", taxDeductible: true },
        { label: "Equipment / Tools of Trade (Games, Furniture)", taxDeductible: true },
        { label: "Dividend Payout", taxDeductible: false },
        { label: "Director's Loan Account (DLA)", taxDeductible: false },
        { label: "Business Entertaining (Client)", taxDeductible: false },
        { label: "Corporation Tax Payment", taxDeductible: false },
        { label: "Companies House Penalties", taxDeductible: false },
        { label: "Other / Misc", taxDeductible: true }
    ];

    // Fetch companies for the dropdown if no companyId is in URL
    useEffect(() => {
        const fetchCompanies = async () => {
            if (!user || companyId) return;
            const data = await getCompaniesByEmail(user.email);
            setCompanies(data);
        };
        fetchCompanies();
    }, [user, companyId]);

    // Pre-populate form if we are in Edit Mode
    useEffect(() => {
        if (isEditing && companyId && transactionId) {
            const fetchTransaction = async () => {
                try {
                    const txRef = doc(db, "companies", companyId, "transactions", transactionId);
                    const snap = await getDoc(txRef);
                    if (snap.exists()) {
                        const data = snap.data();
                        setFormData({
                            date: data.date,
                            category: data.category,
                            amount: data.amount,
                            payee: data.payee,
                            notes: data.notes
                        });
                        setSelectedCompanyId(companyId);
                    }
                } catch (error) {
                    toast.error("Error fetching transaction details.");
                }
            };
            fetchTransaction();
        }
    }, [isEditing, companyId, transactionId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedCompanyId) {
            toast.error("Please select a company first.");
            return;
        }

        setLoading(true);
        try {
            const submissionData = {
                ...formData,
                amount: parseFloat(formData.amount),
                updatedAt: new Date()
            };

            if (isEditing) {
                const txRef = doc(db, "companies", selectedCompanyId, "transactions", transactionId);
                await updateDoc(txRef, submissionData);
                toast.success("Transaction updated!");
            } else {
                const colRef = collection(db, "companies", selectedCompanyId, "transactions");
                await addDoc(colRef, {
                    ...submissionData,
                    createdAt: new Date()
                });
                toast.success("Expense logged!");
            }
            setTimeout(() => navigate(-1), 1200);
        } catch (error) {
            toast.error("Failed to save transaction.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 text-gray-900 dark:text-white transition-colors duration-300">
            <div className="max-w-xl mx-auto bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800">
                <header className="mb-8 border-b dark:border-gray-800 pb-4">
                    <h1 className="text-3xl font-black tracking-tighter uppercase italic">
                        {isEditing ? "Edit Transaction" : "Log Outgoing"}
                    </h1>
                    <p className="text-gray-500 text-sm">
                        {isEditing ? "Updating existing record" : "Capture transaction details for your portfolio"}.
                    </p>
                </header>

                <form onSubmit={handleSubmit} className="space-y-5">
                    
                    {!companyId && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                            <label className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Target Company</label>
                            <select 
                                className="w-full mt-2 p-3 rounded-xl bg-white dark:bg-gray-800 font-bold outline-none border-2 border-transparent focus:border-blue-500"
                                value={selectedCompanyId}
                                onChange={(e) => setSelectedCompanyId(e.target.value)}
                                required
                            >
                                <option value="">-- Choose Company --</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Expense Category</label>
                        <select 
                            className="w-full mt-2 p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 font-bold outline-none border-2 border-transparent focus:border-blue-500"
                            value={formData.category}
                            onChange={e => setFormData({...formData, category: e.target.value})}
                        >
                            {categories.map(cat => (
                                <option key={cat.label} value={cat.label}>
                                    {cat.taxDeductible ? "✅" : "❌"} {cat.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Date</label>
                            <input type="date" className="w-full mt-2 p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 font-bold" 
                                value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Amount (£)</label>
                            <input type="number" step="0.01" placeholder="0.00" className="w-full mt-2 p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 font-bold" 
                                value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Payee / Recipient</label>
                        <input type="text" placeholder="e.g. Starbucks or Director Name" className="w-full mt-2 p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 font-bold" 
                            value={formData.payee} onChange={e => setFormData({...formData, payee: e.target.value})} required />
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Notes / Business Justification</label>
                        <textarea 
                            placeholder="e.g. Purchased 5 copies of Catan for cafe stock"
                            className="w-full mt-2 p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 min-h-[100px] text-sm"
                            value={formData.notes}
                            onChange={e => setFormData({...formData, notes: e.target.value})}
                        />
                    </div>

                    <button 
                        disabled={loading} 
                        className="w-full py-5 bg-black dark:bg-white text-white dark:text-black rounded-3xl font-black uppercase tracking-widest hover:opacity-90 transition shadow-xl disabled:opacity-50"
                    >
                        {loading ? "SAVING..." : (isEditing ? "UPDATE TRANSACTION" : "LOG TRANSACTION")}
                    </button>
                </form>
            </div>
            <ToastContainer theme="dark" />
        </div>
    );
};

export default RecordExpense;