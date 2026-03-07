import dayjs from "dayjs";

/**
 * Fetches company profile data from Companies House API via the local proxy.
 * @param {string} companyNumber 
 * @returns {Promise<Object|null>}
 */
export async function fetchCompaniesHouseProfile(companyNumber) {
  if (!companyNumber || companyNumber.length < 8) return null;

  try {
    // Note: The /api-ch prefix is handled by the Vite proxy in development.
    const apiKey = "a5c51b89-ed23-4bcd-aa7c-d4644d54dc0e";
    const encodedKey = btoa(apiKey + ":");
    
    const response = await fetch(`/api-ch/company/${companyNumber}`, {
      headers: {
        "Authorization": `Basic ${encodedKey}`
      }
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Error fetching CH profile:", error);
    return null;
  }
}

/**
 * Extracts relevant deadline markers from CH profile data.
 */
export function extractCHMarkers(data) {
  if (!data) return null;

  return {
    incorporationDate: data.date_of_creation || null,
    lastAccountsEnd: data.accounts?.last_accounts?.made_up_to || null,
    nextAccountsEnd: data.accounts?.next_accounts?.period_end_on || null,
    nextAccountsDue: data.accounts?.next_accounts?.due_on || null,
    lastConfirmationDate: data.confirmation_statement?.last_made_up_to || null,
    nextConfirmationDue: data.confirmation_statement?.next_due || null,
    companyName: data.company_name,
    status: data.company_status,
  };
}
