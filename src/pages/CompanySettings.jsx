import { useState, useEffect } from "react";
import { db } from "../firebase/firebaseConfig";
import { collection, addDoc, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { useAuth } from "../firebase/firebaseAuth.jsx";

export default function CompanySettings() {
    const { user } = useAuth();
    const [companies, setCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState(null);
    const [company, setCompany] = useState({
        name: "",
        incorporationDate: "",
        accountingStart: "",
        accountingEnd: "",
        autoAccountingDates: true,
        userId: user?.uid,
    });
    const [loading, setLoading] = useState(true);

    // Format date dd/mm/yyyy
    const formatDateDisplay = (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-GB");
    };

    // Days until
    const daysUntil = (dateStr) => {
        const now = new Date();
        const d = new Date(dateStr);
        return Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    };

    const colorForDeadline = (days) => {
        if (days <= 30) return "text-red-600 font-bold";
        if (days <= 90) return "text-orange-500 font-bold";
        return "text-green-600 font-semibold";
    };

    const getDeadlines = (accountingEndStr) => {
        if (!accountingEndStr) return null;

        const accountingEnd = new Date(accountingEndStr);

        const addMonths = (date, months) => {
            const d = new Date(date);
            d.setMonth(d.getMonth() + months);
            return d;
        };
        const ctFilingDate = addMonths(accountingEnd, 9)

        const formatISO = (d) => d.toISOString().slice(0, 10);

        return {
            chAccounts: formatISO(addMonths(company.incorporationDate, 21)),
            ctPayment: formatISO(ctFilingDate),
            ctFiling: formatISO(addMonths(ctFilingDate, 12)),
            corporationStatement: formatISO(addMonths(company.incorporationDate, 12)),
        };
    };

    const deadlines = getDeadlines(company.accountingEnd);

    useEffect(() => {
        const fetchCompanies = async () => {
            const q = query(collection(db, "companies"), where("userId", "==", user.uid));
            const snapshot = await getDocs(q);
            const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

            setCompanies(list);

            if (list.length === 1) {
                setSelectedCompanyId(list[0].id);
                setCompany(list[0]);
            }

            setLoading(false);
        };
        fetchCompanies();
    }, [user.uid]);

    const handleCompanySelect = (id) => {
        setSelectedCompanyId(id);
        const found = companies.find((c) => c.id === id);
        if (found) setCompany(found);
    };

    const saveCompany = async () => {
        if (selectedCompanyId) {
            const ref = doc(db, "companies", selectedCompanyId);
            await updateDoc(ref, company);
        } else {
            const docRef = await addDoc(collection(db, "companies"), company);
            setSelectedCompanyId(docRef.id);
        }
    };

    const updateField = (field, value) => {
        setCompany({ ...company, [field]: value });
    };

    if (loading) return <p>Loading...</p>;

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Company Settings</h1>

            {companies.length > 1 && (
                <div className="mb-4">
                    <label className="block mb-1 font-semibold">Select Company</label>
                    <select
                        value={selectedCompanyId || ""}
                        onChange={(e) => handleCompanySelect(e.target.value)}
                        className="p-2 border rounded w-full"
                    >
                        <option value="">Choose...</option>
                        {companies.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Company Form */}
            <div className="space-y-4">
                <div>
                    <label>Company Name</label>
                    <input
                        className="w-full p-2 border rounded"
                        value={company.name}
                        onChange={(e) => updateField("name", e.target.value)}
                    />
                </div>

                <div>
                    <label>Incorporation Date</label>
                    <input
                        type="date"
                        className="w-full p-2 border rounded"
                        value={company.incorporationDate}
                        onChange={(e) => updateField("incorporationDate", e.target.value)}
                    />
                    <p className="text-sm text-gray-600 mt-1">{formatDateDisplay(company.incorporationDate)}</p>
                </div>

                <div>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={company.autoAccountingDates}
                            onChange={(e) => updateField("autoAccountingDates", e.target.checked)}
                        />
                        Auto set accounting dates (1 year from incorporation)
                    </label>
                </div>

                <div>
                    <label>Accounting Start</label>
                    <input
                        type="date"
                        disabled={company.autoAccountingDates}
                        className="w-full p-2 border rounded disabled:bg-gray-200"
                        value={company.accountingStart}
                        onChange={(e) => updateField("accountingStart", e.target.value)}
                    />
                    <p className="text-sm text-gray-600 mt-1">{formatDateDisplay(company.accountingStart)}</p>
                </div>

                <div>
                    <label>Accounting End</label>
                    <input
                        type="date"
                        disabled={company.autoAccountingDates}
                        className="w-full p-2 border rounded disabled:bg-gray-200"
                        value={company.accountingEnd}
                        onChange={(e) => updateField("accountingEnd", e.target.value)}
                    />
                    <p className="text-sm text-gray-600 mt-1">{formatDateDisplay(company.accountingEnd)}</p>
                </div>
            </div>

            {/* DEADLINES */}
            {deadlines && (
                <div className="mt-6 p-4 bg-gray-100 rounded">
                    <h2 className="font-bold mb-2">Deadlines</h2>

                    {Object.entries(deadlines).map(([key, date]) => {
                        const days = daysUntil(date);
                        const label = {
                            corporationStatement: "Corporation Statement Due",
                            chAccounts: "Companies House Accounts Deadline",
                            ctPayment: "Corporation Tax Payment Deadline",
                            ctFiling: "Corporation Tax Filing Deadline",
                        }[key];

                        return (
                            <p key={key} className={colorForDeadline(days)}>
                                {label}: {formatDateDisplay(date)} ({days} days left)
                            </p>
                        );
                    })}
                </div>
            )}

            <button
                onClick={saveCompany}
                className="mt-6 px-4 py-2 bg-blue-600 text-white rounded"
            >
                Save
            </button>
        </div>
    );
}