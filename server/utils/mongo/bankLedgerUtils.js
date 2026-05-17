/**
 * Bank Ledger Utils — Enterprise-grade bank consistency
 * 
 * Ensures that bank accounts are represented identically across:
 * - Ledger entries
 * - Chart of Accounts
 * - Vouchers
 * - Wages & Advances
 */

/**
 * Generates the canonical string for a bank account head.
 * FORMAT: BANK_NAME (A/c ...LAST_4)
 * @param {Object} bankAccount - BankAccount document/object
 * @returns {string} The standardized account head name
 */
export function getCanonicalBankName(bankAccount) {
  if (!bankAccount) return 'Unknown Bank';
  
  const bankName = (bankAccount.bank_name || 'Bank').trim().toUpperCase();
  const accNo = String(bankAccount.account_number || '').trim();
  const last4 = accNo.length > 4 ? accNo.slice(-4) : accNo;
  
  return `${bankName} (A/c ...${last4})`;
}

/**
 * Validates if a string looks like a system-generated bank head
 * @param {string} head 
 * @returns {boolean}
 */
export function isBankHead(head) {
  return /\(A\/c \.\.\.\d{4}\)$/.test(head);
}
