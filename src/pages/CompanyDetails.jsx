import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const CompanyDetails = () => {
  const { companyNumber } = useParams();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [accountingStart, setAccountingStart] = useState('');
  const [incorporationDate, setIncorporationDate] = useState('');

  const [docId, setDocId] = useState(null); // store Firestore doc ID for updates

  // Fetch the company
  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const companiesRef = collection(db, 'companies');
        const q = query(companiesRef, where('number', '==', companyNumber));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          const data = docSnap.data();
          setCompany(data);
          setDocId(docSnap.id);

          // Set form state
          setName(data.name);
          setNumber(data.number);
          setAccountingStart(data.accountingStart);
          setIncorporationDate(data.incorporationDate);
        }
      } catch (error) {
        console.error('Error fetching company:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();
  }, [companyNumber]);

  // Handle save
  const handleSave = async () => {
    if (!docId) return;

    try {
      await updateDoc(doc(db, 'companies', docId), {
        name,
        number,
        accountingStart,
        incorporationDate,
      });

      toast.success('Company updated successfully!');
      setCompany({ name, number, accountingStart, incorporationDate });
      setEditMode(false);
    } catch (error) {
      console.error('Error updating company:', error);
      toast.error('Failed to update company. Please try again.');
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!company) return <p>Company not found.</p>;

  return (
    <div className="p-8 max-w-2xl mx-auto bg-white shadow-md rounded space-y-4">
      <h2 className="text-2xl font-semibold mb-4">{company.name}</h2>

      {/* Fields */}
      <div className="space-y-3">
        <div>
          <label className="font-medium">Company Name:</label>
          {editMode ? (
            <input
              type="text"
              className="mt-1 block w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          ) : (
            <p>{company.name}</p>
          )}
        </div>

        <div>
          <label className="font-medium">Number:</label>
          {editMode ? (
            <input
              type="text"
              className="mt-1 block w-full border rounded px-3 py-2"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          ) : (
            <p>{company.number}</p>
          )}
        </div>

        <div>
          <label className="font-medium">Accounting Start:</label>
          {editMode ? (
            <input
              type="date"
              className="mt-1 block w-full border rounded px-3 py-2"
              value={accountingStart}
              onChange={(e) => setAccountingStart(e.target.value)}
            />
          ) : (
            <p>{company.accountingStart}</p>
          )}
        </div>

        <div>
          <label className="font-medium">Incorporation Date:</label>
          {editMode ? (
            <input
              type="date"
              className="mt-1 block w-full border rounded px-3 py-2"
              value={incorporationDate}
              onChange={(e) => setIncorporationDate(e.target.value)}
            />
          ) : (
            <p>{company.incorporationDate}</p>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 mt-4">
        {editMode ? (
          <>
            <button
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition"
              onClick={handleSave}
            >
              Save
            </button>
            <button
              className="px-4 py-2 bg-gray-300 text-black rounded hover:bg-gray-400 transition"
              onClick={() => setEditMode(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            onClick={() => setEditMode(true)}
          >
            Edit
          </button>
        )}
      </div>

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default CompanyDetails;
