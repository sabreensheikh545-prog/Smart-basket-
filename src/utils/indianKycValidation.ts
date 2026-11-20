// Real-world Indian KYC, Mobile, RTO Vehicle, Aadhaar (Verhoeff), and India Post Pincode validation

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
const INDIAN_PINCODE_REGEX = /^[1-9]\d{5}$/;
const INDIAN_VEHICLE_REGEX = /^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{1,3}[ -]?[0-9]{4}$/;

// Official Verhoeff Dihedral Group D5 Multiplication Table
const VERHOEFF_D: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

// Official Verhoeff Permutation Table (mod 8)
const VERHOEFF_P: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/**
 * Validates a 10-digit Indian mobile number starting with 6, 7, 8, or 9.
 */
export function isValidIndianMobile(phone: string): boolean {
  const digits = (phone || '').replace(/\D/g, '');
  return INDIAN_MOBILE_REGEX.test(digits);
}

/**
 * Validates a 6-digit Indian pincode format (first digit 1-9).
 */
export function isValidIndianPincodeFormat(pincode: string): boolean {
  const digits = (pincode || '').replace(/\D/g, '');
  return INDIAN_PINCODE_REGEX.test(digits);
}

/**
 * Validates an Indian RTO Vehicle Registration Number.
 * Format: ^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{1,3}[ -]?[0-9]{4}$ (e.g. DL01AB1234, MH-12-DE-1433)
 */
export function isValidIndianVehicleNumber(vehicleNumber: string): boolean {
  const normalized = (vehicleNumber || '').trim().toUpperCase().replace(/\s+/g, ' ');
  return INDIAN_VEHICLE_REGEX.test(normalized);
}

/**
 * Validates a 12-digit Indian Aadhaar number using:
 * 1) Must be exactly 12 digits
 * 2) Cannot start with 0 or 1
 * 3) Must pass the official Verhoeff checksum algorithm
 */
export function isValidAadhaarVerhoeff(aadhaar: string): boolean {
  const digits = (aadhaar || '').replace(/\D/g, '');
  if (!/^[2-9]\d{11}$/.test(digits)) {
    return false;
  }

  let checksum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    const digit = digits.charCodeAt(digits.length - 1 - i) - 48;
    checksum = VERHOEFF_D[checksum][VERHOEFF_P[i % 8][digit]];
  }
  return checksum === 0;
}

export interface IndiaPostOffice {
  name: string;
  district: string;
  state: string;
  block?: string;
  branchType?: string;
}

export interface PincodeLookupResult {
  valid: boolean;
  pincode: string;
  postOffice?: string;
  district?: string;
  state?: string;
  postOffices?: IndiaPostOffice[];
  error?: string;
}

interface RawIndiaPostEntry {
  Status?: string;
  Message?: string;
  PostOffice?: Array<{
    Name?: string;
    District?: string;
    State?: string;
    Block?: string;
    BranchType?: string;
  }> | null;
}

const pincodeCache = new Map<string, PincodeLookupResult>();

/**
 * Fetches real Indian Post Office, District, and State from the official India Post API.
 */
export async function lookupIndianPincode(
  rawPincode: string,
  signal?: AbortSignal
): Promise<PincodeLookupResult> {
  const pincode = (rawPincode || '').replace(/\D/g, '').slice(0, 6);
  if (!isValidIndianPincodeFormat(pincode)) {
    return {
      valid: false,
      pincode,
      error: 'Enter a valid 6-digit Indian Pincode (cannot start with 0).',
    };
  }

  const cached = pincodeCache.get(pincode);
  if (cached) return cached;

  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      method: 'GET',
      signal,
    });
    if (!response.ok) {
      return {
        valid: false,
        pincode,
        error: 'Unable to reach India Post Pincode service. Please try again.',
      };
    }

    const payload = (await response.json()) as RawIndiaPostEntry[];
    const first = Array.isArray(payload) ? payload[0] : null;
    const rawOffices = first?.Status === 'Success' && Array.isArray(first.PostOffice) ? first.PostOffice : [];

    if (rawOffices.length === 0) {
      const invalidRes: PincodeLookupResult = {
        valid: false,
        pincode,
        error: `Pincode ${pincode} was not found in India Post records. Please enter a real Indian Pincode.`,
      };
      pincodeCache.set(pincode, invalidRes);
      return invalidRes;
    }

    const postOffices: IndiaPostOffice[] = rawOffices
      .filter((po) => Boolean(po?.Name))
      .map((po) => ({
        name: String(po.Name || '').trim(),
        district: String(po.District || '').trim(),
        state: String(po.State || '').trim(),
        block: po.Block ? String(po.Block).trim() : undefined,
        branchType: po.BranchType ? String(po.BranchType).trim() : undefined,
      }));

    const primary = postOffices[0];
    const validRes: PincodeLookupResult = {
      valid: true,
      pincode,
      postOffice: primary.name,
      district: primary.district,
      state: primary.state,
      postOffices,
    };
    pincodeCache.set(pincode, validRes);
    return validRes;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    return {
      valid: false,
      pincode,
      error: 'Could not verify Pincode with India Post API. Check your internet connection and retry.',
    };
  }
}
