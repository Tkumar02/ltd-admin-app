import dayjs from 'dayjs';

export const calculateInitialDeadlines = (incDateString) => {
    const incDate = dayjs(incDateString); // e.g., '2025-12-01'

    // 1. Confirmation Statement: 1 year + 14 days
    const confirmationStatement = incDate.add(1, 'year').add(14, 'days');

    // 2. Annual Accounts: 21 months from incorporation (First Year Rule)
    const annualAccounts = incDate.add(21, 'months');

    // 3. Corporation Tax Payment: 9 months + 1 day after year-end
    // Assuming year-end is 30th Nov 2026 (12 months after inc)
    const yearEnd = incDate.add(1, 'year').subtract(1, 'day');
    const taxPayment = yearEnd.add(9, 'months').add(1, 'day');

    // 4. Corporation Tax Return: 12 months after year-end
    const taxReturn = yearEnd.add(12, 'months');

    return {
        confirmationStatement: confirmationStatement.format('DD MMMM YYYY'),
        annualAccounts: annualAccounts.format('DD MMMM YYYY'),
        taxPayment: taxPayment.format('DD MMMM YYYY'),
        taxReturn: taxReturn.format('DD MMMM YYYY'),
    };
};