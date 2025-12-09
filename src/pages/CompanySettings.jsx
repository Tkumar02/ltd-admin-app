import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/firebaseConfig';
import { collection, query, where, getDocs, setDoc, doc } from "firebase/firestore";

const CompanyScreen = () => {
    const [loading, setLoading] = useState(true); // For loading state
    const [companies, setCompanies] = useState([]); // State to store the companies



    // Fetch companies from Firestore
    const getCompanies = async () => {
        try {
            // Get the current user
            const user = auth.currentUser;

            if (!user) {
                console.log("User is not logged in");
                return;
            }

            console.log("Fetching companies for UID:", user.uid);

            // Create a reference to the "companies" collection
            const companiesRef = collection(db, "companies");

            // Query to fetch companies for the current user
            const q = query(companiesRef, where("email", "==", user.email));

            // Get the query snapshot
            const querySnapshot = await getDocs(q);

            // Map the documents to an array of company data
            const companiesList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));

            // Log the companies to the console
            console.log("Fetched companies:", companiesList);
            setCompanies(companiesList); // Set the state to display companies
            console.log(companies, 'hhoo')
            setLoading(false); // Set loading to false once data is fetched
        } catch (error) {
            console.error("Error fetching companies:", error);
            setLoading(false); // Set loading to false in case of an error
        }
        console.log('LOOK HERE', companies)
    };

    useEffect(() => {
        getCompanies(); // Call the function when the component mounts
    }, []);

    return (
        <div>
            {loading ? (
                <p>Loading...</p> // Show loading message while fetching data
            ) : (
                <div>
                    <h2>Companies</h2>
                    <ul>
                        {companies.length > 0 ? (
                            companies.map((company) => (
                                <li key={company.id}>
                                    {company.companyName} {/* Assuming your Firestore doc has a 'companyName' field */}
                                </li>
                            ))
                        ) : (
                            <p>No companies found.</p> // Message if no companies are returned
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default CompanyScreen;

