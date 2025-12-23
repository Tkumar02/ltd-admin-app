import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/firebaseConfig';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


const CompanyScreen = () => {
    const [loading, setLoading] = useState(false);
    const [companies, setCompanies] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showManage, setShowManage] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [number, setNumber] = useState('');
    const [accountingStart, setAccountingStart] = useState('');
    const [incorporationDate, setIncorporationDate] = useState('');

    const getCompanies = async () => {
        try {
            setLoading(true);
            const user = auth.currentUser;
            if (!user) return;

            const companiesRef = collection(db, "companies");
            const q = query(companiesRef, where("email", "==", user.email));
            const querySnapshot = await getDocs(q);

            const companiesList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));

            setCompanies(companiesList);
        } catch (error) {
            console.error("Error fetching companies:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        getCompanies();
    }, []);

    const handleAddCompany = async (e) => {
        e.preventDefault();
        try {
            const user = auth.currentUser;
            if (!user) return;

            await addDoc(collection(db, "companies"), {
                name,
                number,
                accountingStart,
                incorporationDate,
                email: user.email,
            });
            toast.success('Company saved successfully!');

            setName('');
            setNumber('');
            setAccountingStart('');
            setIncorporationDate('');

            setShowAddForm(false);
            getCompanies(); // Refresh the list
        } catch (error) {
            console.error("Error adding company:", error);
        }
    };

    const handleDeleteCompany = async (companyNumber, companyName) => {
        const confirmDelete = window.confirm(
            `Are you sure you want to delete the company "${companyName}"? This action cannot be undone.`
        );
        if (!confirmDelete) return;

        try {
            const companiesRef = collection(db, "companies");
            const q = query(companiesRef, where("number", "==", companyNumber));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const docId = querySnapshot.docs[0].id; // Firestore document ID
                await deleteDoc(doc(db, "companies", docId));

                // Remove from state
                toast.success(`Company "${companyName}" deleted successfully!`);
                setCompanies(prev => prev.filter(c => c.number !== companyNumber));
            }
        } catch (error) {
            console.error("Error deleting company:", error);
        }
    };


    return (
        <div className="p-8 max-w-3xl mx-auto">
            {/* Buttons */}
            <div className="flex gap-4 mb-6">
                <button
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                    onClick={() => {
                        setShowAddForm(true);
                        setShowManage(false);
                    }}
                >
                    Add New Company
                </button>

                {companies.length > 0 && (
                    <button
                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
                        onClick={() => {
                            setShowManage(true);
                            setShowAddForm(false);
                        }}
                    >
                        Manage Companies
                    </button>
                )}
            </div>

            {/* Add Company Form */}
            {showAddForm && (
                <form
                    className="bg-white shadow-md rounded p-6 space-y-4"
                    onSubmit={handleAddCompany}
                >
                    <h3 className="text-lg font-semibold">Add New Company</h3>

                    <div>
                        <label className="block text-sm font-medium">Company Name</label>
                        <input
                            className="mt-1 block w-full border rounded px-3 py-2"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Number</label>
                        <input
                            className="mt-1 block w-full border rounded px-3 py-2"
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Accounting Start</label>
                        <input
                            type="date"
                            className="mt-1 block w-full border rounded px-3 py-2"
                            value={accountingStart}
                            onChange={(e) => setAccountingStart(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Incorporation Date</label>
                        <input
                            type="date"
                            className="mt-1 block w-full border rounded px-3 py-2"
                            value={incorporationDate}
                            onChange={(e) => setIncorporationDate(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                    >
                        Submit
                    </button>
                </form>
            )}

            {/* Manage Companies List */}
            {showManage && (
                <div>
                    {loading ? (
                        <p>Loading companies...</p>
                    ) : (
                        <ul className="space-y-4">
                            {companies.map(company => (
                                <li
                                    key={company.id}
                                    className="p-4 bg-gray-50 rounded shadow hover:shadow-md transition flex justify-between items-start"
                                >
                                    <div>
                                        <h4 className="font-semibold text-lg">{company.name}</h4>
                                        <p><strong>Number:</strong> {company.number}</p>
                                        <p><strong>Accounting Start:</strong> {company.accountingStart}</p>
                                        <p><strong>Incorporation Date:</strong> {company.incorporationDate}</p>
                                    </div>
                                    <button
                                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition ml-4"
                                        onClick={() => handleDeleteCompany(company.number, company.name)}
                                    >
                                        Delete
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
            
            <ToastContainer position="top-right" autoClose={3000} />

        </div>
    );
};

export default CompanyScreen;
