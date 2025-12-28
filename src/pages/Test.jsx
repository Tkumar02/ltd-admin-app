import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import useCompanies from "../utils/useCompanies";

export default function FilingsPage() {
    const { companies, loading } = useCompanies();

    const addFiling = async (companyId) => {
        const filingsRef = collection(db, "companies", companyId, "filings");
        await addDoc(filingsRef, {
            type: "Confirmation Statement",
            hasFiled: false,
            createdAt: new Date(),
        });
        alert("Filing added!");
    };

    if (loading) return <p>Loading companies...</p>;
    if (!companies.length) return <p>No companies found for your account.</p>;

    return (
        <div className="p-8 max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Filings Page</h1>
            {companies.map((company) => (
                <div key={company.id} className="mb-4 p-4 border rounded">
                    <h2 className="font-semibold">{company.name}</h2>
                    <p><strong>Number:</strong> {company.number}</p>
                    <p><strong>Incorporation Date:</strong> {company.incorporationDate}</p>
                    <p><strong>Accounting Start:</strong> {company.accountingStart}</p>
                    <button
                        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        onClick={() => addFiling(company.id)}
                    >
                        Add Confirmation Statement Filing
                    </button>
                </div>
            ))}
        </div>
    );
}
