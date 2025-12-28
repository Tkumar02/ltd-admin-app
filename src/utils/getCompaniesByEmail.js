import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

/**
 * Fetch companies associated with a user's email
 */
const getCompaniesByEmail = async (email) => {
    if (!email) return [];

    const companiesRef = collection(db, "companies");
    const q = query(companiesRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,   // Firestore document ID
        ...docSnap.data()
    }));
};

export default getCompaniesByEmail;
