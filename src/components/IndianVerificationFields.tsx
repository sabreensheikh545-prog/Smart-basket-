import React, { useEffect, useId, useRef, useState } from 'react';
import {
  ConfirmationResult,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
} from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MapPin,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { getFirebaseAuthErrorMessage, phoneOtpAuth } from '../firebase';
import {
  PincodeLookupResult,
  isValidIndianMobile,
  isValidIndianPincodeFormat,
  lookupIndianPincode,
} from '../utils/indianKycValidation';

interface PhoneOtpFieldProps {
  label?: string;
  phone: string;
  onPhoneChange: (nextPhone: string) => void;
  verifiedPhone: string | null;
  onVerifiedChange: (verifiedPhone: string | null) => void;
  onToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
  required?: boolean;
}

export const PhoneOtpField: React.FC<PhoneOtpFieldProps> = ({
  label = 'Mobile Number',
  phone,
  onPhoneChange,
  verifiedPhone,
  onVerifiedChange,
  onToast,
  required = true,
}) => {
  const cleanPhone = phone.replace(/\D/g, '').slice(0, 10);
  const isValidMobile = isValidIndianMobile(cleanPhone);
  const isVerified = Boolean(verifiedPhone && verifiedPhone === cleanPhone && isValidMobile);

  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpInfo, setOtpInfo] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaHostRef = useRef<HTMLDivElement | null>(null);
  const reactId = useId();

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  // Clean up reCAPTCHA widget on unmount
  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch {
          // ignore cleanup errors
        }
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  const clearRecaptcha = () => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // ignore cleanup errors
      }
      recaptchaVerifierRef.current = null;
    }
    if (recaptchaHostRef.current) {
      recaptchaHostRef.current.innerHTML = '';
    }
  };

  const handlePhoneInput = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    onPhoneChange(digits);
    setOtpError('');
    setOtpInfo('');
    if (verifiedPhone && digits !== verifiedPhone) {
      onVerifiedChange(null);
    }
    if (otpSentTo && digits !== otpSentTo) {
      setOtpSentTo(null);
      setOtpCode('');
      confirmationRef.current = null;
    }
  };

  const handleSendOtp = async () => {
    setOtpError('');
    setOtpInfo('');

    if (!isValidMobile) {
      setOtpError('Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    if (!recaptchaHostRef.current) {
      setOtpError('Verification container not ready. Please try again.');
      return;
    }

    setSendingOtp(true);
    try {
      clearRecaptcha();
      const slot = document.createElement('div');
      slot.id = `sb-recaptcha-${reactId.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;
      recaptchaHostRef.current.appendChild(slot);

      const verifier = new RecaptchaVerifier(phoneOtpAuth, slot, {
        size: 'invisible',
      });
      recaptchaVerifierRef.current = verifier;

      const e164Phone = `+91${cleanPhone}`;
      const confirmation = await signInWithPhoneNumber(phoneOtpAuth, e164Phone, verifier);
      confirmationRef.current = confirmation;
      setOtpSentTo(cleanPhone);
      setOtpCode('');
      setResendCooldown(30);
      const msg = `6-digit SMS OTP sent to +91 ${cleanPhone}.`;
      setOtpInfo(msg);
      onToast?.(msg, 'success');
    } catch (err) {
      clearRecaptcha();
      const errMsg = getFirebaseAuthErrorMessage(err);
      setOtpError(errMsg);
      onToast?.(errMsg, 'error');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpError('');
    const cleanOtp = otpCode.replace(/\D/g, '').slice(0, 6);
    if (cleanOtp.length !== 6) {
      setOtpError('Please enter the 6-digit SMS OTP sent to your mobile.');
      return;
    }
    if (!confirmationRef.current) {
      setOtpError('Please tap "Send OTP" first to receive an SMS code.');
      return;
    }

    setVerifyingOtp(true);
    try {
      await confirmationRef.current.confirm(cleanOtp);
      // Sign out the isolated phone-OTP auth instance so primary app auth remains untouched
      await signOut(phoneOtpAuth).catch(() => {});
      confirmationRef.current = null;
      setOtpSentTo(null);
      setOtpCode('');
      setOtpInfo('');
      onVerifiedChange(cleanPhone);
      onToast?.(`Mobile +91 ${cleanPhone} verified via SMS OTP!`, 'success');
    } catch (err) {
      const errMsg = getFirebaseAuthErrorMessage(err);
      setOtpError(errMsg);
      onToast?.(errMsg, 'error');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const showFormatError = cleanPhone.length > 0 && !/^[6-9]/.test(cleanPhone);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-bold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {isVerified ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Verified ✓
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-amber-700">
            SMS OTP Verification Required
          </span>
        )}
      </div>

      <div className="flex items-stretch gap-2">
        <div
          className={`flex-1 flex items-center rounded-lg border bg-slate-50 overflow-hidden transition ${
            isVerified
              ? 'border-emerald-400 bg-emerald-50/40'
              : showFormatError
              ? 'border-rose-400 bg-rose-50/30'
              : 'border-slate-300 focus-within:border-[#2874F0] focus-within:bg-white'
          }`}
        >
          <span className="px-2.5 h-11 flex items-center justify-center bg-slate-100 border-r border-slate-200 text-xs font-bold text-slate-700 shrink-0">
            +91
          </span>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            required={required}
            value={cleanPhone}
            onChange={(e) => handlePhoneInput(e.target.value)}
            placeholder="9876543210"
            className="w-full h-11 px-3 bg-transparent text-sm font-mono font-semibold text-slate-900 placeholder-slate-400 focus:outline-none"
          />
        </div>

        <button
          type="button"
          disabled={sendingOtp || !isValidMobile || isVerified || resendCooldown > 0}
          onClick={handleSendOtp}
          className={`px-3.5 h-11 rounded-lg text-xs font-extrabold whitespace-nowrap transition shrink-0 flex items-center justify-center gap-1.5 ${
            isVerified
              ? 'bg-emerald-600 text-white cursor-default'
              : 'bg-[#2874F0] hover:bg-[#1e60d5] text-white disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed'
          }`}
        >
          {sendingOtp ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Sending...</span>
            </>
          ) : isVerified ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified ✓</span>
            </>
          ) : resendCooldown > 0 ? (
            <span>Resend ({resendCooldown}s)</span>
          ) : otpSentTo === cleanPhone ? (
            <span>Resend OTP</span>
          ) : (
            <>
              <Smartphone className="w-3.5 h-3.5" />
              <span>Send OTP</span>
            </>
          )}
        </button>
      </div>

      {/* Dedicated hidden container for Firebase Invisible reCAPTCHA */}
      <div ref={recaptchaHostRef} className="hidden" />

      {showFormatError && (
        <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Indian mobile numbers must start with 6, 7, 8, or 9.
        </p>
      )}

      {/* 6-Digit SMS OTP Entry Box */}
      {otpSentTo === cleanPhone && !isVerified && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-blue-900 font-bold">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2874F0]" />
              Enter 6-digit SMS OTP sent to +91 {cleanPhone}
            </span>
          </div>
          <div className="flex items-stretch gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(e) => {
                setOtpError('');
                setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
              }}
              placeholder="• • • • • •"
              className="flex-1 h-10 px-3 rounded-lg bg-white border border-blue-300 text-center font-mono text-base font-extrabold tracking-[0.4em] text-slate-900 focus:border-[#2874F0] focus:outline-none"
            />
            <button
              type="button"
              disabled={verifyingOtp || otpCode.length !== 6}
              onClick={handleVerifyOtp}
              className="px-4 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold disabled:opacity-50 transition whitespace-nowrap flex items-center gap-1.5"
            >
              {verifyingOtp ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Verify OTP</span>
              )}
            </button>
          </div>
        </div>
      )}

      {otpInfo && !otpError && !isVerified && (
        <p className="text-[11px] font-semibold text-emerald-700">{otpInfo}</p>
      )}

      {otpError && (
        <p className="text-[11px] font-semibold text-rose-600 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{otpError}</span>
        </p>
      )}
    </div>
  );
};

interface IndianPincodeFieldProps {
  label?: string;
  pincode: string;
  onPincodeChange: (nextPincode: string) => void;
  selectedPostOffice: string;
  onSelectedPostOfficeChange: (postOffice: string) => void;
  onLookupResult: (result: PincodeLookupResult | null) => void;
  required?: boolean;
}

export const IndianPincodeField: React.FC<IndianPincodeFieldProps> = ({
  label = '6-Digit Indian Pincode',
  pincode,
  onPincodeChange,
  selectedPostOffice,
  onSelectedPostOfficeChange,
  onLookupResult,
  required = true,
}) => {
  const cleanPin = pincode.replace(/\D/g, '').slice(0, 6);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PincodeLookupResult | null>(null);

  useEffect(() => {
    if (cleanPin.length < 6) {
      setLoading(false);
      setResult(null);
      onLookupResult(null);
      return;
    }

    if (!isValidIndianPincodeFormat(cleanPin)) {
      const invalid: PincodeLookupResult = {
        valid: false,
        pincode: cleanPin,
        error: 'Invalid Pincode. Indian pincodes are 6 digits and cannot start with 0.',
      };
      setLoading(false);
      setResult(invalid);
      onLookupResult(invalid);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    lookupIndianPincode(cleanPin, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return;
        setResult(res);
        onLookupResult(res);
        if (res.valid && res.postOffices && res.postOffices.length > 0) {
          const exists = res.postOffices.some((po) => po.name === selectedPostOffice);
          if (!exists) {
            onSelectedPostOfficeChange(res.postOffices[0].name);
          }
        }
      })
      .catch(() => {
        // Ignore abort errors
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [cleanPin]);

  const isValid = Boolean(result?.valid);
  const isInvalid = Boolean(result && !result.valid);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-bold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {loading && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2874F0]">
            <Loader2 className="w-3 h-3 animate-spin" />
            Checking India Post...
          </span>
        )}
        {!loading && isValid && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Valid India Post PIN
          </span>
        )}
      </div>

      <div className="relative">
        <input
          type="tel"
          inputMode="numeric"
          maxLength={6}
          required={required}
          value={cleanPin}
          onChange={(e) => onPincodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="e.g., 110039"
          className={`w-full h-11 px-3.5 rounded-lg border text-sm font-mono font-bold tracking-wider focus:outline-none transition ${
            isValid
              ? 'bg-emerald-50/40 border-emerald-400 text-slate-900'
              : isInvalid
              ? 'bg-rose-50/40 border-rose-400 text-rose-900'
              : 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-[#2874F0]'
          }`}
        />
      </div>

      {!loading && isValid && result && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 space-y-2 text-xs">
          <div className="flex items-start gap-2 text-emerald-950">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">
                {selectedPostOffice || result.postOffice} · {result.district}, {result.state}
              </p>
              <p className="text-[11px] text-emerald-800">
                Verified via India Post ({result.pincode})
              </p>
            </div>
          </div>
          {result.postOffices && result.postOffices.length > 1 && (
            <div>
              <label className="block text-[10px] font-bold uppercase text-emerald-800 mb-1">
                Select Post Office / Locality
              </label>
              <select
                value={selectedPostOffice || result.postOffices[0].name}
                onChange={(e) => onSelectedPostOfficeChange(e.target.value)}
                className="w-full h-9 px-2.5 rounded-lg bg-white border border-emerald-300 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#2874F0]"
              >
                {result.postOffices.map((po) => (
                  <option key={`${po.name}_${po.branchType || ''}`} value={po.name}>
                    {po.name} ({po.district}, {po.state})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {!loading && isInvalid && result?.error && (
        <p className="text-[11px] font-semibold text-rose-600 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{result.error}</span>
        </p>
      )}
    </div>
  );
};
