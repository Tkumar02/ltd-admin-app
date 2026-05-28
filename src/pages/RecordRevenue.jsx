import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import { collection, addDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import useCurrentUser from "../utils/getCurrentUser";
import dayjs from "dayjs";
import { toast, ToastContainer } from "react-toastify";

const RecordRevenue = () => {
    const { companyId, transactionId } = useParams();
    const isEditing = !!transactionId;
    const navigate = useNavigate();
    const user = useCurrentUser();

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        date: dayjs().format("YYYY-MM-DD"),
        category: "Bank Interest",
        amount: "",
        source: "", // e.g., "Starling Bank" or "Director Name"
        notes: "",
    });

    const categories = [
        { label: "Bank Interest", taxable: true },
        { label: "Director's Loan (In)", taxable: false },
        { label: "Government Grant", taxable: true },
        { label: "Asset Sale", taxable: true },
        { label: "Tax Refund (VAT/Corp Tax)", taxable: false },
        { label: "Other Misc Income", taxable: true },
        { label: "Services rendered (create invoice separately)", taxable: true}
    ];

    useEffect(() => {
        if (isEditing && companyId && transactionId) {
            const fetchTx = async () => {
                const snap = await getDoc(doc(db, "companies", companyId, "other_revenue", transactionId));
                if (snap.exists()) setFormData(snap.data());
            };
            fetchTx();
        }
    }, [isEditing, companyId, transactionId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = { ...formData, amount: parseFloat(formData.amount), updatedAt: new Date() };
            const colRef = collection(db, "companies", companyId, "other_revenue");
            
            if (isEditing) {
                await updateDoc(doc(db, "companies", companyId, "other_revenue", transactionId), data);
                toast.success("Revenue updated");
            } else {
                await addDoc(colRef, { ...data, createdAt: new Date() });
                toast.success("Revenue logged");
            }
            setTimeout(() => navigate(-1), 1200);
        } catch (error) {
            toast.error("Save failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen p-6 transition-colors duration-500">
            <div className="max-w-xl mx-auto bg-transparent p-8 rounded-[2.5rem] shadow-2xl border border-gray-100 dark:border-gray-800">
                <header className="mb-8">
                    <h1 className="text-3xl font-black uppercase italic tracking-tighter">Log Other Income</h1>
                    <p className="text-gray-500 text-sm">Record interest, loans, or non-invoice revenue.</p>
                </header>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="text-[10px] font-black uppercase text-gray-400">Income Type</label>
                        <select 
                            className="w-full mt-2 p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 font-bold outline-none border-2 border-transparent focus:border-blue-500"
                            value={formData.category}
                            onChange={e => setFormData({...formData, category: e.target.value})}
                        >
                            {categories.map(cat => <option key={cat.label} value={cat.label}>{cat.label}</option>)}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <input type="date" className="p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 font-bold" 
                            value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} required />
                        <input type="number" step="0.01" placeholder="Amount £" className="p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 font-bold" 
                            value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} required />
                    </div>

                    <input type="text" placeholder="Source (e.g. Lloyds Bank)" className="w-full p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 font-bold" 
                        value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} required />

                    <textarea placeholder="Notes..." className="w-full p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 min-h-[100px]"
                        value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />

                    <button disabled={loading} className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-widest hover:bg-blue-700 transition">
                        {loading ? "SAVING..." : "CONFIRM REVENUE"}
                    </button>
                </form>
            </div>
            <ToastContainer theme="dark" />
        </div>
    );
};

export default RecordRevenue;