import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import { collection, query, orderBy, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import dayjs from "dayjs";
import { toast, ToastContainer } from "react-toastify";

const TransactionHistory = () => {
    const { companyId } = useParams();
    const navigate = useNavigate();
    const [ledger, setLedger] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!companyId) return;

        const qExpenses = query(collection(db, "companies", companyId, "transactions"), orderBy("date", "desc"));
        const qIncome = query(collection(db, "companies", companyId, "other_revenue"), orderBy("date", "desc"));

        const unsubExpenses = onSnapshot(qExpenses, (expSnap) => {
            const expenseData = expSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), entryType: 'EXPENSE' }));
            const unsubIncome = onSnapshot(qIncome, (incSnap) => {
                const incomeData = incSnap.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data(), 
                    entryType: 'INCOME',
                    payee: doc.data().source || doc.data().payee 
                }));

                const combined = [...expenseData, ...incomeData].sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix());
                setLedger(combined);
                setLoading(false);
            });
            return () => unsubIncome();
        });
        return () => unsubExpenses();
    }, [companyId]);

    const handleDelete = async (id, type) => {
        const collectionName = type === 'INCOME' ? "other_revenue" : "transactions";
        if (!window.confirm(`Permanently delete this ${type.toLowerCase()}?`)) return;
        try {
            await deleteDoc(doc(db, "companies", companyId, collectionName, id));
            toast.success("Entry deleted");
        } catch (error) { toast.error("Error deleting"); }
    };

    if (loading) return <div className="p-10 text-center dark:text-white font-black animate-pulse">SYNCING LEDGER...</div>;

    return (
        <div className="min-h-screen bg-[#FDFCF8] dark:bg-[#0A0D14] p-4 md:p-12 transition-colors duration-700">
            <div className="max-w-5xl mx-auto">
                
                <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">Ledger</h1>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-indigo-400/80 mt-2">Unified Transaction History</p>
                    </div>
                    
                    <div className="flex w-full md:w-auto gap-3">
                        <button onClick={() => navigate(`/record-revenue/${companyId}`)} className="flex-1 md:flex-none bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">+ Income</button>
                        <button onClick={() => navigate(`/record-expense/${companyId}`)} className="flex-1 md:flex-none bg-slate-900 dark:bg-white dark:text-slate-900 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">+ Expense</button>
                    </div>
                </header>

                <div className="bg-white dark:bg-[#121721] rounded-[2.5rem] shadow-2xl border border-slate-200/60 dark:border-slate-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date / Detail</th>
                                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell">Notes</th>
                                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Flow</th>
                                    <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {ledger.map((item) => {
                                    const isIncome = item.entryType === 'INCOME';
                                    return (
                                        /* ROW BACKGROUNDS: Red/Green tinted based on entry type */
                                        <tr key={item.id} className={`transition-colors ${
                                            isIncome 
                                            ? 'bg-emerald-50/40 dark:bg-emerald-500/5 hover:bg-emerald-100/60 dark:hover:bg-emerald-500/10' 
                                            : 'bg-rose-50/40 dark:bg-rose-500/5 hover:bg-rose-100/60 dark:hover:bg-rose-500/10'
                                        }`}>
                                            {/* Date & Payee */}
                                            <td className="p-4 md:p-6">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                                        {dayjs(item.date).format("DD MMM YYYY")}
                                                    </span>
                                                    <span className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-tight">
                                                        {item.payee || 'Unknown'}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">{item.category}</span>
                                                </div>
                                            </td>

                                            {/* Notes: Responsive hiding */}
                                            <td className="p-4 md:p-6 hidden md:table-cell">
                                                <p className="text-xs text-slate-500 dark:text-slate-400 italic max-w-xs truncate">
                                                    {item.notes || item.description || "—"}
                                                </p>
                                            </td>

                                            {/* Amount with Directional Color */}
                                            <td className="p-4 md:p-6 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={`font-black text-sm md:text-lg ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                        {isIncome ? "+" : "-"} £{Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="text-[8px] font-black uppercase opacity-60 dark:text-white">
                                                        {isIncome ? 'Revenue' : 'Expense'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Edit/Delete Buttons */}
                                            <td className="p-4 md:p-6 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button 
                                                        onClick={() => navigate(`/${isIncome ? 'edit-revenue' : 'edit-expense'}/${companyId}/${item.id}`)}
                                                        className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-slate-400 hover:text-indigo-500 transition-all border border-slate-200 dark:border-slate-700"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                        </svg>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(item.id, item.entryType)}
                                                        className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-slate-400 hover:text-rose-600 transition-all border border-slate-200 dark:border-slate-700"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {ledger.length === 0 && (
                        <div className="p-20 text-center">
                            <p className="text-slate-400 font-black uppercase tracking-widest text-xs">No transactions recorded for this period</p>
                        </div>
                    )}
                </div>
            </div>
            <ToastContainer theme="dark" position="bottom-center" />
        </div>
    );
};

export default TransactionHistory;