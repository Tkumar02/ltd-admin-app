import { useState, useEffect } from "react";
import { db } from "../firebase/firebaseConfig";
import { collection, query, where, getDocs, setDoc, doc } from "firebase/firestore";
import { useAuth } from "../firebase/firebaseAuth.jsx";
import { formatISO, addMonths, parseISO, isValid } from "date-fns"; // Needed for date formatting

export default function CompanySettings() {
    const { user } = useAuth(); // Get the logged-in user
    const [company, setCompany] = useState({
        name: "",
        number: "",
        address: "",
        incorporationDate: "",
        accountingStart: "",
        accountingEnd: "",
        autoAccountingDates: true,
        email: user?.email || "", // Capture email in the form
    });
    const [loading, setLoading] = useState(true);

    // Load company details based on email or userId (UID)
    useEffect(() => {
        const loadCompany = async () => {
            if (!user) return;

            // Query the companies collection using either email or user UID
            const q = query(
                collection(db, "companies"),
                where("userId", "==", user.uid) // Look for the userId field in company documents
            );

            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                querySnapshot.forEach((doc) => {
                    const companyData = doc.data();
                    setCompany(companyData);
                });
            }
            setLoading(false);
        };

        loadCompany();
    }, [user]);

    // Calculate accounting period deadlines based on accounting end date or incorporation date
    const calculateDeadlines = (accountingEnd, incorporationDate) => {
        let endDate = accountingEnd;

        // If accounting end date is invalid or in the future, use the incorporation date as fallback
        if (!isValid(parseISO(accountingEnd)) || new Date(accountingEnd) > new Date()) {
            endDate = incorporationDate; // Fallback to incorporation date if invalid or future accounting end date
        }

        // Calculate deadlines
        const chAccounts = formatISO(addMonths(new Date(incorporationDate), 21)); // 21 months after incorporation date for Companies House
        const ctPayment = formatISO(addMonths(new Date(endDate), 9)); // 9 months after accounting end date for CT payment
        const ctFiling = formatISO(addMonths(new Date(endDate), 12)); // 12 months after accounting end date for CT filing

        return {
            chAccounts,
            ctPayment,
            ctFiling,
        };
    };

    const handleIncorporationChange = (value) => {
        let updated = { ...company, incorporationDate: value };
        if (company.autoAccountingDates) {
            const { start, end } = calculateAccountingPeriod(value);
            updated.accountingStart = start;
            updated.accountingEnd = end;
        }
        setCompany(updated);
    };

    const handleSave = async () => {
        if (!user) {
            alert("You must be logged in to save company details!");
            return;
        }

        const companyRef = doc(db, "companies", company.number || user.uid); // Save to doc based on company number or user ID
        await setDoc(companyRef, {
            ...company,
            userId: user.uid,
        });

        alert("Company saved successfully!");
    };

    if (loading) return <p>Loading...</p>;

    return (
        <div className="p-6 max-w-xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Company Settings</h1>

            <div className="grid gap-4">
                {/* Company Name */}
                <div>
                    <label className="block mb-1">Company Name</label>
                    <input
                        type="text"
                        value={company.name}
                        onChange={(e) => setCompany({ ...company, name: e.target.value })}
                        className="w-full p-2 border rounded"
                    />
                </div>

                {/* Company Number */}
                <div>
                    <label className="block mb-1">Company Number</label>
                    <input
                        type="text"
                        value={company.number}
                        onChange={(e) => setCompany({ ...company, number: e.target.value })}
                        className="w-full p-2 border rounded"
                    />
                </div>

                {/* Registered Address */}
                <div>
                    <label className="block mb-1">Registered Address</label>
                    <textarea
                        value={company.address}
                        onChange={(e) => setCompany({ ...company, address: e.target.value })}
                        className="w-full p-2 border rounded"
                    ></textarea>
                </div>

                {/* Dates */}
                <div>
                    <label>Incorporation Date</label>
                    <input
                        type="date"
                        value={company.incorporationDate}
                        onChange={(e) => handleIncorporationChange(e.target.value)}
                        className="w-full p-2 border rounded"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={company.autoAccountingDates}
                        onChange={(e) =>
                            setCompany({ ...company, autoAccountingDates: e.target.checked })
                        }
                    />
                    <label>Automatically calculate accounting year</label>
                </div>

                <div>
                    <label>Accounting Start</label>
                    <input
                        type="date"
                        value={company.accountingStart}
                        onChange={(e) =>
                            setCompany({ ...company, accountingStart: e.target.value })
                        }
                        disabled={company.autoAccountingDates}
                        className="w-full p-2 border rounded disabled:bg-gray-200"
                    />
                </div>

                <div>
                    <label>Accounting End</label>
                    <input
                        type="date"
                        value={company.accountingEnd}
                        onChange={(e) =>
                            setCompany({ ...company, accountingEnd: e.target.value })
                        }
                        disabled={company.autoAccountingDates}
                        className="w-full p-2 border rounded disabled:bg-gray-200"
                    />
                </div>

                {/* Save button */}
                <button
                    onClick={handleSave}
                    className="bg-blue-600 text-white px-5 py-2 rounded mt-4"
                >
                    Save Company
                </button>

                {/* Display calculated deadlines */}
                <div className="mt-4">
                    <h2 className="font-semibold">Key Dates</h2>
                    <p><strong>CT Payment Deadline:</strong> {company.ctPayment}</p>
                    <p><strong>CT Filing Deadline:</strong> {company.ctFiling}</p>
                    <p><strong>CH Accounts Filing Deadline:</strong> {company.chAccounts}</p>
                </div>
            </div>
        </div>
    );
}
