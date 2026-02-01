import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import dayjs from "dayjs";
import { toast, ToastContainer } from "react-toastify";

const TransactionHistory = () => {
    const { companyId } = useParams();
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!companyId) return;

        // Listen for real-time updates from the transactions sub-collection
        const q = query(
            collection(db, "companies", companyId, "transactions"),
            orderBy("date", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const txData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTransactions(txData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [companyId]);

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this transaction?")) return;
        
        try {
            await deleteDoc(doc(db, "companies", companyId, "transactions", id));
            toast.success("Transaction deleted");
        } catch (error) {
            toast.error("Failed to delete");
        }
    };

    // Helper to check if a category is usually tax deductible (matching your previous list)
    const isDeductible = (category) => {
        const nonDeductible = ["Dividend Payout", "Director's Loan Account (DLA)", "Business Entertaining (Client)", "Corporation Tax Payment"];
        return !nonDeductible.includes(category);
    };

    if (loading) return <div className="p-10 text-center dark:text-white">Loading Transactions...</div>;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 transition-colors duration-300">
            <div className="max-w-5xl mx-auto">
                <header className="mb-10 flex justify-between items-center">
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter">LEDGER</h1>
                        <p className="text-gray-500 dark:text-gray-400 font-medium italic">Outgoing History & Expense Tracking</p>
                    </div>
                    <button 
                        onClick={() => navigate(`/record-expense/${companyId}`)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold transition shadow-lg shadow-blue-500/20"
                    >
                        + Add Expense
                    </button>
                </header>

                <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Category & Note</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</th>
                                <th className="p-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                            {transactions.length === 0 && (
                                <tr><td colSpan="4" className="p-10 text-center text-gray-400 italic">No transactions found.</td></tr>
                            )}
                            {transactions.map((tx) => (
                                <tr key={tx.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                                    <td className="p-6 align-top">
                                        <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                            {dayjs(tx.date).format("DD MMM YYYY")}
                                        </span>
                                    </td>
                                    <td className="p-6 align-top">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${isDeductible(tx.category) ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                                                {isDeductible(tx.category) ? "Tax Deductible" : "Non-Deductible"}
                                            </span>
                                            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{tx.category}</span>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-md">{tx.notes}</p>
                                        <p className="text-[10px] mt-2 text-gray-400 font-medium">Payee: {tx.payee}</p>
                                    </td>
                                    <td className="p-6 align-top font-black text-lg text-gray-900 dark:text-white">
                                        £{Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-6 align-top text-right">
                                        <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {/* EDIT BUTTON */}
    <button 
        onClick={() => navigate(`/edit-expense/${companyId}/${tx.id}`)}
        className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
    >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
    </button>
                                            <button 
                                                onClick={() => handleDelete(tx.id)}
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <ToastContainer theme="dark" />
        </div>
    );
};

export default TransactionHistory;