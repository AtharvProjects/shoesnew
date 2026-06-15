/**
 * Validation utilities for Gajraj Kirana Billing Software
 */

/**
 * Validates an email address format.
 */
export const isValidEmail = (email: string): boolean => {
  if (!email) return true; // Optional fields can be empty
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates a 10-digit Indian phone number.
 */
export const isValidPhone = (phone: string): boolean => {
  if (!phone) return true; // Optional
  // Remove spaces, dashes, etc.
  const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
  // Should be 10 digits (optionally 12 if including 91)
  const phoneRegex = /^(?:(?:\+|0{0,2})91[\-\s]?)?[6789]\d{9}$/;
  return phoneRegex.test(cleanPhone);
};

/**
 * Validates Indian GSTIN (Goods and Services Tax Identification Number).
 * Format: 2 digits for state code, 10 for PAN, 1 for entity code, 1 for check-sum, 1 for Z.
 */
export const isValidGSTIN = (gstin: string): boolean => {
  if (!gstin) return true; // Optional
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin.toUpperCase());
};

/**
 * Validates Indian IFSC (Indian Financial System Code).
 * Format: 4 alphabets, 0, 6 characters (digits or alphabets).
 */
export const isValidIFSC = (ifsc: string): boolean => {
  if (!ifsc) return true; // Optional
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc.toUpperCase());
};

/**
 * Validates UPI ID.
 * Basic format: identifier@provider
 */
export const isValidUPI = (upi: string): boolean => {
  if (!upi) return true; // Optional
  const upiRegex = /^[\w\.\-_]+@[\w\.\-_]+$/;
  return upiRegex.test(upi);
};

/**
 * Validates HSN Code (Harmonized System of Nomenclature).
 * Usually 4, 6, or 8 digits.
 */
export const isValidHSN = (hsn: string): boolean => {
  if (!hsn) return true; // Optional
  const hsnRegex = /^\d{4,8}$/;
  return hsnRegex.test(hsn);
};

/**
 * Validates PAN (Permanent Account Number).
 * Format: 5 letters, 4 digits, 1 letter.
 */
export const isValidPAN = (pan: string): boolean => {
  if (!pan) return true; // Optional
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan.toUpperCase());
};

/**
 * Numeric validations.
 */
export const isPositive = (n: number | string): boolean => {
  const val = typeof n === 'string' ? parseFloat(n) : n;
  return !isNaN(val) && val > 0;
};

export const isNonNegative = (n: number | string): boolean => {
  const val = typeof n === 'string' ? parseFloat(n) : n;
  return !isNaN(val) && val >= 0;
};

/**
 * Checks if a value is selected (not 'all' or empty).
 */
export const isSelected = (val: string): boolean => {
  return !!val && val !== 'all' && val !== '';
};
