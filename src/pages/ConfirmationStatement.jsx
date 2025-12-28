// pages/ConfirmationStatement.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

const ConfirmationStatement = () => {
    const { companyId } = useParams();
    const [company, setCompany] = useState(null);
    const [formData, setFormData] = useState({
        directorNames: '',
        secretaryNames: '',
        registeredAddress: '',
        shareholderInfo: '',
        otherChanges: ''
    });
    const [loading, setLoading] = useState(true);

    // Fetch the company info
    useEffect(() => {
        const fetchCompany = async () => {
            const docRef = doc(db, 'companies', companyId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setCompany(docSnap.data());
            }
            setLoading(false);
        };
        fetchCompany();
    }, [companyId]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const filingsRef = collection(db, 'companies', companyId, 'filings');
            await addDoc(filingsRef, {
                type: 'Confirmation Statement',
                ...formData,
                createdAt: new Date(),
                hasFiled: false
            });
            alert('Confirmation Statement saved successfully!');
        } catch (err) {
            console.error('Error saving confirmation statement:', err);
            alert('Failed to save confirmation statement');
        }
    };

    if (loading) return <p>Loading company info...</p>;
    if (!company) return <p>Company not found.</p>;

    return (
        <div style={{ maxWidth: '600px', margin: '2rem auto', fontFamily: 'sans-serif', padding: '0 1rem' }}>
            <h1>Add Confirmation Statement for {company.name}</h1>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                    <label>Director Names:</label>
                    <input type="text" name="directorNames" value={formData.directorNames} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} required />
                </div>

                <div>
                    <label>Secretary Names:</label>
                    <input type="text" name="secretaryNames" value={formData.secretaryNames} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>

                <div>
                    <label>Registered Address:</label>
                    <input type="text" name="registeredAddress" value={formData.registeredAddress} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} required />
                </div>

                <div>
                    <label>Shareholder Info:</label>
                    <textarea name="shareholderInfo" value={formData.shareholderInfo} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>

                <div>
                    <label>Other Changes / Notes:</label>
                    <textarea name="otherChanges" value={formData.otherChanges} onChange={handleChange} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
                </div>

                <button type="submit" style={{ padding: '0.75rem', background: '#007bff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    Save Confirmation Statement
                </button>
            </form>
        </div>
    );
};

export default ConfirmationStatement;
