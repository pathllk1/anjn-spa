import { api } from './api.js';

export async function fetchBankAccounts(activeOnly = false) {
  const query = activeOnly ? '?activeOnly=true' : '';
  const response = await api.get(`/api/ledger/bank-accounts${query}`);
  return response?.data || [];
}

export function getBankAccountOptionLabel(account) {
  if (!account) return 'Bank Account';
  
  // STRICT CANONICAL FORMAT: Bank Name - Account Number
  // This must match the server-side resolution logic in ledger helpers
  const bank = account.bank_name || 'Bank';
  const acct = account.account_number || '0000';
  
  return `${bank} - ${acct}`;
}

export function populateBankAccountSelect(selectEl, accounts, selectedId = '') {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">Select Bank Account</option>' +
    accounts.map((account) => `
      <option value="${account._id}" ${String(account._id) === String(selectedId) ? 'selected' : ''}>
        ${getBankAccountOptionLabel(account)}${account.is_default ? ' (Default)' : ''}
      </option>
    `).join('');
}
