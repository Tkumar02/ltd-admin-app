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
    const [showAllHistory, setShowAllHistory] = useState(false);
    // FIX 1: Store periods in state so the UI can access periods[0]
    const [periods, setPeriods] = useState([]);
    const [companyName, setCompanyName] = useState("");

    // Accounting Period Logic
    const getPeriods = (company) => {
        if (!company) return [];
        let ard = company.nextAccountsDate ? dayjs(company.nextAccountsDate) : dayjs(company.incorporationDate).add(1, 'year');
        while (dayjs().isAfter(ard)) { ard = ard.add(1, 'year'); }
        const periodsArr = [];
        let i = 0;
        let keepGoing = true;
        const incDate = dayjs(company.incorporationDate);
        while (keepGoing) {
            const end = ard.subtract(i, 'year');
            let start = end.subtract(1, 'year').add(1, 'day');
            if (start.isBefore(incDate)) { start = incDate; keepGoing = false; }
            if (end.diff(start, 'day') < 2) break;
            if (end.isBefore(incDate)) break;
            periodsArr.push({
                label: `${start.format('YYYY')}-${end.format('YY')}`,
                start, end,
                display: `${start.format('D MMM YYYY')} - ${end.format('D MMM YYYY')}`
            });
            i++;
            if (i > 50) break;
        }
        return periodsArr;
    };

    useEffect(() => {
        if (!companyId) return;
        const companyRef = doc(db, "companies", companyId);
        
        const unsubAll = onSnapshot(companyRef, (companySnap) => {
            if (!companySnap.exists()) return;
            const companyData = companySnap.data();
            const companyName = companyData.name;
            setCompanyName(companyData.name);

            const calculatedPeriods = getPeriods(companyData);
            setPeriods(calculatedPeriods); // Save to state
            
            const currentPeriodStart = calculatedPeriods.length > 0 ? calculatedPeriods[0].start : dayjs().startOf('year');

            const qExpenses = query(collection(db, "companies", companyId, "transactions"), orderBy("date", "desc"));
            const qOtherRev = query(collection(db, "companies", companyId, "other_revenue"), orderBy("date", "desc"));
            const qInvoices = query(collection(db, "invoices"), orderBy("date", "desc"));

            const unsubExp = onSnapshot(qExpenses, (expSnap) => {
                const expenseData = expSnap.docs.map(doc => ({ 
                    id: doc.id, ...doc.data(), entryType: 'EXPENSE',
                    displaySubtype: doc.data().category || 'Expense' 
                }));

                const unsubOther = onSnapshot(qOtherRev, (revSnap) => {
                    const otherRevData = revSnap.docs.map(doc => ({ 
                        id: doc.id, ...doc.data(), entryType: 'INCOME',
                        payee: doc.data().source || doc.data().payee,
                        displaySubtype: doc.data().category || 'Other Revenue'
                    }));

                    const unsubInv = onSnapshot(qInvoices, (invSnap) => {
                        const invoiceData = invSnap.docs
                            .map(doc => ({ id: doc.id, ...doc.data() }))
                            .filter(inv => inv.businessName === companyName && inv.paid === true)
                            .map(inv => ({
                                id: inv.id, ...inv, entryType: 'INCOME',
                                payee: inv.clientName, amount: inv.total, displaySubtype: 'Invoice'
                            }));

                        let combined = [...expenseData, ...otherRevData, ...invoiceData];

                        if (!showAllHistory) {
                            combined = combined.filter(item => {
                                const itemDate = dayjs(item.date);
                                return itemDate.isSame(currentPeriodStart, 'day') || itemDate.isAfter(currentPeriodStart, 'day');
                            });
                        }

                        setLedger(combined.sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix()));
                        setLoading(false);
                    });
                    return () => unsubInv();
                });
                return () => unsubOther();
            });
            return () => unsubExp();
        });
        return () => unsubAll();
    }, [companyId, showAllHistory]);

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
                        <p>{companyName}</p>
                        <div className="flex items-center gap-4 mt-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-indigo-400/80">Unified History</p>
                            {/* NEW: Toggle UI Buttons */}
                            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-lg">
                                <button 
                                    onClick={() => setShowAllHistory(false)}
                                    className={`px-3 py-1 text-[9px] font-black uppercase rounded ${!showAllHistory ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow' : 'text-slate-500'}`}
                                >
                                    Current
                                </button>
                                <button 
                                    onClick={() => setShowAllHistory(true)}
                                    className={`px-3 py-1 text-[9px] font-black uppercase rounded ${showAllHistory ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow' : 'text-slate-500'}`}
                                >
                                    All Time
                                </button>
                            </div>
                        </div>
                        {!showAllHistory && periods[0] && (
                            <p className="text-[9px] font-bold text-emerald-500 dark:text-emerald-400 mt-2">
                                Period: {periods[0].display}
                            </p>
                        )}
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
                                        <tr key={item.id} className={`transition-colors ${
                                            isIncome 
                                            ? 'bg-emerald-50/40 dark:bg-emerald-500/5 hover:bg-emerald-100/60 dark:hover:bg-emerald-500/10' 
                                            : 'bg-rose-50/40 dark:bg-rose-500/5 hover:bg-rose-100/60 dark:hover:bg-rose-500/10'
                                        }`}>
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
                                            <td className="p-4 md:p-6 hidden md:table-cell">
                                                <p className="text-xs text-slate-500 dark:text-slate-400 italic max-w-xs truncate">
                                                    {item.notes || item.description || "—"}
                                                </p>
                                            </td>
                                            <td className="p-4 md:p-6 text-right">
                                                <div className="flex flex-col items-end">
                                                    <span className={`font-black text-sm md:text-lg ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                        {isIncome ? "+" : "-"} £{Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="text-[8px] font-black uppercase tracking-widest opacity-60 dark:text-white px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 mt-1">
                                                        {item.displaySubtype}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 md:p-6 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => navigate(`/${isIncome ? 'edit-revenue' : 'edit-expense'}/${companyId}/${item.id}`)} className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:text-indigo-500">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                    </button>
                                                    <button onClick={() => handleDelete(item.id, item.entryType)} className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:text-rose-600">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <ToastContainer theme="dark" position="bottom-center" />
        </div>
    );
};

export default TransactionHistory;