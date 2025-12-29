// utils/useCompanies.js
import { useState, useEffect } from "react";
import getCompaniesByEmail from "./getCompaniesByEmail";
import useCurrentUser from "./getCurrentUser";

export default function useCompanies() {
    const { user, loading: authLoading } = useCurrentUser();
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCompanies = async () => {
            if (!user) {
                setCompanies([]);
                setLoading(false);
                return;
            }

            try {
                const data = await getCompaniesByEmail(user.email);
                setCompanies(data);
            } catch (err) {
                console.error("Error fetching companies:", err);
                setCompanies([]);
            } finally {
                setLoading(false);
            }
        };

        if (!authLoading) fetchCompanies();
    }, [user, authLoading]);

    return { companies, loading };
}
