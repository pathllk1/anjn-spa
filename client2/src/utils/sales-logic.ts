export interface Item {
  stockId?: string;
  item: string;
  hsn: string;
  qty: number;
  uom: string;
  rate: number;
  disc: number;
  grate: number;
  batch?: string;
  oem?: string;
  narration?: string;
  itemType?: 'GOODS' | 'SERVICE';
  showQty?: boolean;
  costRate?: number;
  returnQty?: number;
}

export interface OtherCharge {
  label: string;
  amount: number;
  gstRate: number;
}

export const formatCurrency = (num: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(num || 0);

export const isServiceItem = (item: Item) => (item?.itemType || 'GOODS') === 'SERVICE';

export const getItemEffectiveQty = (item: Item) => {
  const qty = Number(item?.qty);
  if (Number.isFinite(qty) && qty > 0) return qty;
  return isServiceItem(item) ? 1 : 0;
};

export const shouldShowItemQty = (item: Item) => {
  if (!isServiceItem(item)) return true;
  return item?.showQty !== false;
};

export const getItemDisplayQty = (item: Item) => {
  if (!shouldShowItemQty(item)) return '';
  const qty = Number(item?.qty);
  return Number.isFinite(qty) ? qty : '';
};

export const getItemLineTotal = (item: Item) => {
  const qty = getItemEffectiveQty(item);
  const rate = Number(item?.rate) || 0;
  const disc = Number(item?.disc) || 0;
  return qty * rate * (1 - disc / 100);
};

export const calculateBillTotals = ({
  cart = [] as Item[],
  otherCharges = [] as OtherCharge[],
  gstEnabled = true,
  billType = 'intra-state',
  reverseCharge = false,
  isReturnMode = false,
}) => {
  let itemTaxableTotal = 0;
  let totalTaxAmount = 0;
  let otherChargesTotal = 0;
  let otherChargesGstTotal = 0;

  const effectiveCart = isReturnMode
    ? cart.map(item => ({ ...item, qty: item.returnQty || 0 }))
    : cart;

  effectiveCart.forEach(item => {
    const lineValue = getItemLineTotal(item);
    itemTaxableTotal += lineValue;
    if (gstEnabled) totalTaxAmount += lineValue * ((Number(item?.grate) || 0) / 100);
  });

  otherCharges.forEach(charge => {
    const amt = Number(charge?.amount) || 0;
    otherChargesTotal += amt;
    if (gstEnabled) {
      otherChargesGstTotal += amt * ((Number(charge?.gstRate) || 0) / 100);
    }
  });

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (gstEnabled && billType === 'intra-state') {
    cgst = (totalTaxAmount / 2) + (otherChargesGstTotal / 2);
    sgst = (totalTaxAmount / 2) + (otherChargesGstTotal / 2);
  } else if (gstEnabled) {
    igst = totalTaxAmount + otherChargesGstTotal;
  }

  const grossBeforeRound = itemTaxableTotal
    + otherChargesTotal
    + (gstEnabled && !reverseCharge ? totalTaxAmount + otherChargesGstTotal : 0);

  const ntot = Math.round(grossBeforeRound);
  const rof = parseFloat((ntot - grossBeforeRound).toFixed(2));

  return {
    itemTaxableTotal: parseFloat(itemTaxableTotal.toFixed(2)),
    totalTaxAmount: parseFloat(totalTaxAmount.toFixed(2)),
    otherChargesTotal: parseFloat(otherChargesTotal.toFixed(2)),
    otherChargesGstTotal: parseFloat(otherChargesGstTotal.toFixed(2)),
    cgst: reverseCharge && gstEnabled ? 0 : parseFloat(cgst.toFixed(2)),
    sgst: reverseCharge && gstEnabled ? 0 : parseFloat(sgst.toFixed(2)),
    igst: reverseCharge && gstEnabled ? 0 : parseFloat(igst.toFixed(2)),
    grossBeforeRound,
    ntot,
    rof,
  };
};
