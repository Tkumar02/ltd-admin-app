import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/firebaseConfig';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { ToastContainer, toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import 'react-toastify/dist/ReactToastify.css';

const CompanyScreen = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [companies, setCompanies] = useState([]);
    const [view, setView] = useState('list'); 
    
    // Form State
    const [selectedId, setSelectedId] = useState(null);
    const [name, setName] = useState('');
    const [number, setNumber] = useState('');
    const [accountingStart, setAccountingStart] = useState('');
    const [incorporationDate, setIncorporationDate] = useState('');
    const [address, setAddress] = useState('');
    const [lastAccountsDate, setLastAccountsDate] = useState('');

    const isOldCompany = incorporationDate && dayjs().diff(dayjs(incorporationDate), 'month') > 18;

    const fetchCompanies = async () => {
        setLoading(true);
        const user = auth.currentUser;
        if (!user) return;
        const q = query(collection(db, "companies"), where("email", "==", user.email));
        const snap = await getDocs(q);
        setCompanies(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
    };

    useEffect(() => { fetchCompanies(); }, []);

    const resetForm = () => {
        setSelectedId(null); setName(''); setNumber(''); setAddress('');
        setIncorporationDate(''); setAccountingStart(''); setLastAccountsDate('');
        setView('list');
    };

    const handleEditClick = (company) => {
        setSelectedId(company.id);
        setName(company.name);
        setNumber(company.number);
        setAddress(company.address);
        setIncorporationDate(company.incorporationDate);
        setAccountingStart(company.accountingStart || '');
        setLastAccountsDate(company.lastAccountsDate || '');
        setView('edit');
    };

    const handleDelete = async (id, companyName) => {
        if (window.confirm(`Are you sure you want to delete ${companyName}? This cannot be undone.`)) {
            try {
                await deleteDoc(doc(db, "companies", id));
                toast.success(`${companyName} removed.`);
                fetchCompanies();
            } catch (error) {
                toast.error("Delete failed.");
            }
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            const companyData = {
                name, number, address, incorporationDate,
                accountingStart: accountingStart || null,
                lastAccountsDate: isOldCompany ? lastAccountsDate : null,
                isFirstYear: !isOldCompany,
                email: auth.currentUser.email
            };

            if (view === 'edit') {
                await updateDoc(doc(db, "companies", selectedId), companyData);
                toast.success('Company updated!');
            } else {
                await addDoc(collection(db, "companies"), companyData);
                toast.success('Company added!');
            }
            resetForm();
            fetchCompanies();
        } catch (error) {
            toast.error("Error saving company.");
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto text-gray-900 dark:text-white">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-black italic tracking-tighter uppercase">Portfolio Manager</h1>
                    <p className="text-sm text-gray-500">{companies.length} Companies Registered</p>
                </div>
                {view === 'list' && (
                    <button onClick={() => setView('add')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold shadow-lg transition shadow-blue-500/20">
                        + Add Company
                    </button>
                )}
            </header>

            {view === 'list' ? (
                <div className="grid gap-4">
                    {loading ? <div className="p-10 text-center opacity-50 italic">Syncing with database...</div> : 
                     companies.map(c => (
                        <div key={c.id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 flex justify-between items-center shadow-sm hover:shadow-md transition">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-lg leading-none">{c.name}</h3>
                                    {c.accountingStart && (
                                        <span className="text-[9px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Trading</span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-400 font-medium tracking-tight">#{c.number} • {c.isFirstYear ? 'Year 1' : 'Established'}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <button onClick={() => handleEditClick(c)} className="text-sm font-bold text-blue-600 hover:underline">Edit</button>
<button onClick={() => navigate(`/filings/${c.id}`)}>View Filings</button>                                <button onClick={() => handleDelete(c.id, c.name)} className="p-2 text-gray-300 hover:text-red-500 transition">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Form code remains same as previous version */
                <form onSubmit={handleSave} className="bg-white dark:bg-gray-800 p-8 rounded-2xl border shadow-xl space-y-6">
                    <div className="flex justify-between items-center border-b pb-4">
                        <h2 className="text-xl font-bold">{view === 'edit' ? 'Edit Company Details' : 'Register New Company'}</h2>
                        <button type="button" onClick={resetForm} className="text-gray-400 hover:text-gray-600 font-bold text-sm uppercase">Cancel</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-400">Company Name</label>
                            <input className="w-full mt-1 p-3 border rounded-lg dark:bg-gray-900 border-gray-200" value={name} onChange={e => setName(e.target.value)} required />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-gray-400">Company Number</label>
                            <input className="w-full mt-1 p-3 border rounded-lg dark:bg-gray-900 border-gray-200" value={number} onChange={e => setNumber(e.target.value)} required />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase text-gray-400">Incorporation Date</label>
                        <input type="date" className="w-full mt-1 p-3 border rounded-lg dark:bg-gray-900 border-gray-200" value={incorporationDate} onChange={e => setIncorporationDate(e.target.value)} required />
                    </div>

                    {isOldCompany && (
                        <div className="p-5 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-r-xl">
                            <label className="text-sm font-bold text-amber-800 dark:text-amber-400">Last Accounts "Made Up To" Date</label>
                            <input type="date" className="w-full mt-1 p-3 border rounded-lg dark:bg-gray-800 border-gray-200" value={lastAccountsDate} onChange={e => setLastAccountsDate(e.target.value)} required />
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-bold uppercase text-gray-400">Trading Start Date (HMRC)</label>
                        <input type="date" className="w-full mt-1 p-3 border rounded-lg dark:bg-gray-900 border-gray-200" value={accountingStart} onChange={e => setAccountingStart(e.target.value)} />
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase text-gray-400">Registered Office Address</label>
                        <textarea className="w-full mt-1 p-3 border rounded-lg dark:bg-gray-900 border-gray-200" rows="2" value={address} onChange={e => setAddress(e.target.value)} required />
                    </div>

                    <button type="submit" className="w-full py-4 bg-black text-white dark:bg-white dark:text-black rounded-xl font-black uppercase tracking-widest hover:opacity-90 transition shadow-lg">
                        {view === 'edit' ? 'Update Records' : 'Save Company'}
                    </button>
                </form>
            )}
            <ToastContainer />
        </div>
    );
};

export default CompanyScreen;