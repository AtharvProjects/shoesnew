/**
 * GST Utility Functions for Gajraj Kirana Billing Software
 * Handles per-item GST calculation, CGST/SGST/IGST split,
 * HSN-wise summary, and amount-in-words conversion.
 */

/* ---------- Amount in Words (Indian Numbering System) ---------- */
const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const tens = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

const mrNumbers = [
  'शून्य', 'एक', 'दोन', 'तीन', 'चार', 'पाच', 'सहा', 'सात', 'आठ', 'नऊ', 'दहा',
  'अकरा', 'बारा', 'तेरा', 'चौदा', 'पंधरा', 'सोळा', 'सतरा', 'अठरा', 'एकोणीस', 'वीस',
  'एकवीस', 'बावीस', 'तेवीस', 'चोवीस', 'पंचवीस', 'सव्वीस', 'सत्तावीस', 'अठ्ठावीस', 'एकोणतीस', 'तीस',
  'एकतीस', 'बत्तीस', 'तेहतीस', 'चौतीस', 'पस्तीस', 'छत्तीस', 'सदतीस', 'अडतीस', 'एकोणचाळीस', 'चाळीस',
  'एकेचाळीस', 'बेचाळीस', 'त्रेचाळीस', 'चव्वेचाळीस', 'पंचेचाळीस', 'शेहेचाळीस', 'सत्तेचाळीस', 'अठ्ठेचाळीस', 'एकोणपन्नास', 'पन्नास',
  'एकावन्न', 'बावन्न', 'त्रेपन्न', 'चोपन्न', 'पंचावन्न', 'छप्पन्न', 'सत्तावन्न', 'अठ्ठावन्न', 'एकोणसाठ', 'साठ',
  'एकसष्ट', 'बासष्ट', 'त्रेसष्ट', 'चौसष्ट', 'पासष्ट', 'सहासष्ट', 'सदुसष्ट', 'अडुसष्ट', 'एकोणसत्तर', 'सत्तर',
  'एकाहत्तर', 'बाहत्तर', 'त्र्याहत्तर', 'चौर्‍याहत्तर', 'पंच्याहत्तर', 'शहात्तर', 'सत्त्याहत्तर', 'अठ्ठ्याहत्तर', 'एकोणऐंशी', 'ऐंशी',
  'एक्क्याऐंशी', 'ब्याऐंशी', 'त्र्याऐंशी', 'चौर्‍याऐंशी', 'पंच्याऐंशी', 'शहाऐंशी', 'सत्त्याऐंशी', 'अठ्ठ्याऐंशी', 'एकोणनव्वद', 'नव्वद',
  'एक्क्याण्णव', 'ब्याण्णव', 'त्र्याण्णव', 'चौऱ्याण्णव', 'पंच्याण्णव', 'शहाण्णव', 'सत्त्याण्णव', 'अठ्ठ्याण्णव', 'नव्व्याण्णव'
];

function twoDigitWords(n: number, lang: string = 'en'): string {
  if (lang === 'mr') return mrNumbers[n] || '';
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
}

function threeDigitWords(n: number, lang: string = 'en'): string {
  if (n === 0) return '';
  if (lang === 'mr') {
    if (n < 100) return mrNumbers[n];
    return mrNumbers[Math.floor(n / 100)] + 'शे' + (n % 100 ? ' ' + mrNumbers[n % 100] : '');
  }
  if (n < 100) return twoDigitWords(n, 'en');
  return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigitWords(n % 100, 'en') : '');
}

/**
 * Convert a number to Indian words (e.g., 22855 → "Twenty Two Thousand Eight Hundred Fifty Five")
 * Supports up to 99,99,99,999 (99 Crore)
 */
export function numberToWords(num: number, lang: string = 'en'): string {
  if (num === 0) return lang === 'mr' ? 'शून्य' : 'Zero';

  const isNegative = num < 0;
  num = Math.abs(Math.round(num));

  if (num === 0) return lang === 'mr' ? 'शून्य' : 'Zero';

  // Indian system: Crore, Lakh, Thousand, Hundred
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const remainder = num;

  let words = '';
  if (lang === 'mr') {
    if (crore > 0) words += twoDigitWords(crore, 'mr') + ' कोटी ';
    if (lakh > 0) words += twoDigitWords(lakh, 'mr') + ' लाख ';
    if (thousand > 0) words += twoDigitWords(thousand, 'mr') + ' हजार ';
    if (remainder > 0) words += threeDigitWords(remainder, 'mr');
  } else {
    if (crore > 0) words += twoDigitWords(crore, 'en') + ' Crore ';
    if (lakh > 0) words += twoDigitWords(lakh, 'en') + ' Lakh ';
    if (thousand > 0) words += twoDigitWords(thousand, 'en') + ' Thousand ';
    if (remainder > 0) words += threeDigitWords(remainder, 'en');
  }

  words = words.trim();
  if (isNegative) words = (lang === 'mr' ? 'उणे ' : 'Minus ') + words;
  return words;
}

/**
 * Format amount in words for invoice
 */
export function amountInWords(amount: number, lang: string = 'en'): string {
  const rupees = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - rupees) * 100);

  if (lang === 'mr') {
    let result = 'रुपये ' + numberToWords(rupees, 'mr');
    if (paise > 0) {
      result += ' आणि ' + numberToWords(paise, 'mr') + ' पैसे';
    }
    result += ' मात्र';
    return result;
  }

  let result = 'INR ' + numberToWords(rupees, 'en');
  if (paise > 0) {
    result += ' and ' + numberToWords(paise, 'en') + ' Paise';
  }
  result += ' Only';
  return result;
}

/* ---------- GST Calculation Helpers ---------- */

export interface GstItemInput {
  product_id: number | null;
  product_name: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  price: number;        // selling price per unit
  discount: number;     // flat discount on this item
  gst_rate: number;     // GST rate (0, 5, 12, 18, 28)
  gst_inclusive: boolean; // is the price inclusive of GST?
}

export interface GstItemResult {
  product_id: number | null;
  product_name: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  price: number;
  discount: number;
  gst_rate: number;
  gst_inclusive: boolean;
  taxable_amount: number;   // amount on which tax is calculated
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  total: number;            // final line total (taxable + all taxes)
}

/**
 * Calculate GST for a single item.
 * @param item - The item details
 * @param isIgst - true for inter-state (IGST), false for intra-state (CGST+SGST)
 */
export function calculateItemGst(item: GstItemInput, isIgst: boolean = false): GstItemResult {
  const grossAmount = item.quantity * item.price;
  const afterDiscount = grossAmount - (item.discount || 0);

  let taxableAmount: number;
  let taxAmount: number;

  if (item.gst_inclusive && item.gst_rate > 0) {
    // Price includes GST — extract taxable value
    taxableAmount = afterDiscount * 100 / (100 + item.gst_rate);
    taxAmount = afterDiscount - taxableAmount;
  } else {
    // Price excludes GST — add tax on top
    taxableAmount = afterDiscount;
    taxAmount = taxableAmount * item.gst_rate / 100;
  }

  // Round to 2 decimal places
  taxableAmount = Math.round(taxableAmount * 100) / 100;
  taxAmount = Math.round(taxAmount * 100) / 100;

  let cgst_rate = 0, cgst_amount = 0;
  let sgst_rate = 0, sgst_amount = 0;
  let igst_rate = 0, igst_amount = 0;

  if (item.gst_rate > 0) {
    if (isIgst) {
      igst_rate = item.gst_rate;
      igst_amount = taxAmount;
    } else {
      cgst_rate = item.gst_rate / 2;
      sgst_rate = item.gst_rate / 2;
      cgst_amount = Math.round(taxAmount / 2 * 100) / 100;
      sgst_amount = Math.round((taxAmount - cgst_amount) * 100) / 100; // ensure no rounding loss
    }
  }

  const total = Math.round((taxableAmount + cgst_amount + sgst_amount + igst_amount) * 100) / 100;

  return {
    product_id: item.product_id,
    product_name: item.product_name,
    hsn_code: item.hsn_code,
    quantity: item.quantity,
    unit: item.unit,
    price: item.price,
    discount: item.discount,
    gst_rate: item.gst_rate,
    gst_inclusive: item.gst_inclusive,
    taxable_amount: taxableAmount,
    cgst_rate,
    cgst_amount,
    sgst_rate,
    sgst_amount,
    igst_rate,
    igst_amount,
    total,
  };
}

/* ---------- HSN Summary ---------- */

export interface HsnSummaryRow {
  hsn_code: string;
  taxable_amount: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  total_tax: number;
}

/**
 * Generate HSN-wise tax summary from calculated items.
 */
export function generateHsnSummary(items: GstItemResult[]): HsnSummaryRow[] {
  const map = new Map<string, HsnSummaryRow>();

  for (const item of items) {
    if (!item.hsn_code || item.gst_rate === 0) continue;

    const key = `${item.hsn_code}_${item.gst_rate}`;
    const existing = map.get(key);

    if (existing) {
      existing.taxable_amount += item.taxable_amount;
      existing.cgst_amount += item.cgst_amount;
      existing.sgst_amount += item.sgst_amount;
      existing.igst_amount += item.igst_amount;
      existing.total_tax += item.cgst_amount + item.sgst_amount + item.igst_amount;
    } else {
      map.set(key, {
        hsn_code: item.hsn_code,
        taxable_amount: item.taxable_amount,
        cgst_rate: item.cgst_rate,
        cgst_amount: item.cgst_amount,
        sgst_rate: item.sgst_rate,
        sgst_amount: item.sgst_amount,
        igst_rate: item.igst_rate,
        igst_amount: item.igst_amount,
        total_tax: item.cgst_amount + item.sgst_amount + item.igst_amount,
      });
    }
  }

  // Round all values
  return Array.from(map.values()).map(row => ({
    ...row,
    taxable_amount: Math.round(row.taxable_amount * 100) / 100,
    cgst_amount: Math.round(row.cgst_amount * 100) / 100,
    sgst_amount: Math.round(row.sgst_amount * 100) / 100,
    igst_amount: Math.round(row.igst_amount * 100) / 100,
    total_tax: Math.round(row.total_tax * 100) / 100,
  }));
}

/* ---------- Invoice Totals ---------- */

export interface InvoiceTotals {
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  gst_amount: number;
  discount_amount: number;
  subtotal: number;        // sum of all item (qty * price)
  round_off: number;
  total_amount: number;    // final rounded total
}

/**
 * Calculate invoice-level totals from all GST-calculated items.
 */
export function calculateInvoiceTotals(
  items: GstItemResult[],
  billDiscount: number = 0
): InvoiceTotals {
  let taxable_amount = 0;
  let cgst_amount = 0;
  let sgst_amount = 0;
  let igst_amount = 0;
  let subtotal = 0;

  for (const item of items) {
    subtotal += item.quantity * item.price;
    taxable_amount += item.taxable_amount;
    cgst_amount += item.cgst_amount;
    sgst_amount += item.sgst_amount;
    igst_amount += item.igst_amount;
  }

  const gst_amount = cgst_amount + sgst_amount + igst_amount;
  const exactTotal = taxable_amount + gst_amount - billDiscount;
  const roundedTotal = Math.round(exactTotal);
  const round_off = Math.round((roundedTotal - exactTotal) * 100) / 100;

  return {
    taxable_amount: Math.round(taxable_amount * 100) / 100,
    cgst_amount: Math.round(cgst_amount * 100) / 100,
    sgst_amount: Math.round(sgst_amount * 100) / 100,
    igst_amount: Math.round(igst_amount * 100) / 100,
    gst_amount: Math.round(gst_amount * 100) / 100,
    discount_amount: billDiscount,
    subtotal: Math.round(subtotal * 100) / 100,
    round_off,
    total_amount: roundedTotal,
  };
}

/* ---------- Indian State Codes ---------- */
export const INDIAN_STATES: { code: string; name: string }[] = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
];

/**
 * Determine if a transaction is inter-state based on GSTIN comparison.
 * First 2 digits of GSTIN = state code.
 */
export function isInterState(sellerGstin: string, buyerGstin: string): boolean {
  if (!sellerGstin || !buyerGstin) return false;
  const sellerState = sellerGstin.substring(0, 2);
  const buyerState = buyerGstin.substring(0, 2);
  return sellerState !== buyerState;
}

/**
 * Get state name from state code
 */
export function getStateName(code: string): string {
  return INDIAN_STATES.find(s => s.code === code)?.name || '';
}
