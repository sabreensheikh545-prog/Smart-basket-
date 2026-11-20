import React, { useEffect, useRef, useState } from 'react';
import {
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mail,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { auth, getFirebaseAuthErrorMessage, verificationAuth } from '../firebase';
import { checkDuplicateMobileFirestore } from '../services/firestoreService';
import {
  PincodeLookupResult,
  isValidIndianMobile,
  isValidIndianPincodeFormat,
  lookupIndianPincode,
} from '../utils/indianKycValidation';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function deriveVerificationSecret(email: string): string {
  const clean = email.trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i += 1) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `SbVerify#${(hash >>> 0).toString(36)}!9K`;
}

// =============================================================================
// 1. REAL FIREBASE EMAIL VERIFICATION (100% Free Spark Plan & Android APK Safe)
// =============================================================================
interface EmailVerificationFieldProps {
  label?: string;
  email: string;
  onEmailChange: (nextEmail: string) => void;
  readOnlyEmail?: boolean;
  verifiedEmail: string | null;
  onVerifiedChange: (verifiedEmail: string | null) => void;
  onToast?: (text: string, type?: 'success' | 'error' | 'info') => void;
  required?: boolean;
}

export const EmailVerificationField: React.FC<EmailVerificationFieldProps> = ({
  label = 'Email Address',
  email,
  onEmailChange,
  readOnlyEmail = false,
  verifiedEmail,
  onVerifiedChange,
  onToast,
  required = true,
}) => {
  const cleanEmail = email.trim().toLowerCase();
  const isValidEmail = EMAIL_REGEX.test(cleanEmail);
  const isVerified = Boolean(verifiedEmail && verifiedEmail.toLowerCase() === cleanEmail && isValidEmail);

  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);
  const [needsAccountPassword, setNeedsAccountPassword] = useState(false);
  const [existingPassword, setExistingPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const activeTargetRef = useRef<'primary' | 'isolated' | null>(null);

  // Auto-detect if the primary signed-in Firebase user already has this exact email verified
  useEffect(() => {
    if (!isValidEmail || isVerified) return;
    const primaryUser = auth.currentUser;
    if (primaryUser?.email?.trim().toLowerCase() === cleanEmail) {
      if (primaryUser.emailVerified) {
        onVerifiedChange(cleanEmail);
        return;
      }
      primaryUser
        .reload()
        .then(() => {
          if (auth.currentUser?.email?.trim().toLowerCase() === cleanEmail && auth.currentUser.emailVerified) {
            onVerifiedChange(cleanEmail);
          }
        })
        .catch(() => {});
    }
  }, [cleanEmail, isValidEmail, isVerified, onVerifiedChange]);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const checkVerificationStatus = async (silent = false) => {
    if (!isValidEmail || isVerified) return;
    const targetUser: FirebaseUser | null =
      activeTargetRef.current === 'primary'
        ? auth.currentUser
        : activeTargetRef.current === 'isolated'
        ? verificationAuth.currentUser
        : auth.currentUser?.email?.trim().toLowerCase() === cleanEmail
        ? auth.currentUser
        : verificationAuth.currentUser;

    if (!targetUser) {
      if (!silent) {
        setError('Please tap "Verify Email" first to receive your verification link.');
      }
      return;
    }

    if (!silent) {
      setChecking(true);
      setError('');
    }
    try {
      await targetUser.reload();
      const refreshedUser =
        activeTargetRef.current === 'primary'
          ? auth.currentUser
          : activeTargetRef.current === 'isolated'
          ? verificationAuth.currentUser
          : targetUser;

      if (refreshedUser?.emailVerified) {
        if (activeTargetRef.current === 'isolated') {
          await signOut(verificationAuth).catch(() => {});
        }
        setLinkSentTo(null);
        setNeedsAccountPassword(false);
        setExistingPassword('');
        setInfo('');
        setError('');
        onVerifiedChange(cleanEmail);
        onToast?.(`Email ${cleanEmail} verified successfully!`, 'success');
      } else if (!silent) {
        setInfo('Not verified yet. Open the verification email in your inbox, tap the link, then check again.');
      }
    } catch {
      if (!silent) {
        setError('Could not check status right now. Please try again.');
      }
    } finally {
      if (!silent) {
        setChecking(false);
      }
    }
  };

  // Auto-poll & check immediately when returning from Gmail / Mail app inside Android APK
  useEffect(() => {
    if (linkSentTo !== cleanEmail || isVerified) return;

    const intervalId = window.setInterval(() => {
      checkVerificationStatus(true);
    }, 4500);

    const handleReturnFocus = () => {
      if (document.visibilityState === 'visible') {
        checkVerificationStatus(true);
      }
    };

    window.addEventListener('focus', handleReturnFocus);
    document.addEventListener('visibilitychange', handleReturnFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleReturnFocus);
      document.removeEventListener('visibilitychange', handleReturnFocus);
    };
  }, [linkSentTo, cleanEmail, isVerified]);

  const handleEmailChange = (raw: string) => {
    if (readOnlyEmail) return;
    const next = raw.trimStart();
    onEmailChange(next);
    setError('');
    setInfo('');
    setNeedsAccountPassword(false);
    setExistingPassword('');
    const nextLower = next.trim().toLowerCase();
    if (verifiedEmail && verifiedEmail.toLowerCase() !== nextLower) {
      onVerifiedChange(null);
    }
    if (linkSentTo && linkSentTo !== nextLower) {
      setLinkSentTo(null);
    }
  };

  const dispatchVerificationForUser = async (user: FirebaseUser, target: 'primary' | 'isolated') => {
    activeTargetRef.current = target;
    await user.reload().catch(() => {});
    if (user.emailVerified) {
      if (target === 'isolated') {
        await signOut(verificationAuth).catch(() => {});
      }
      setLinkSentTo(null);
      setNeedsAccountPassword(false);
      setExistingPassword('');
      setInfo('');
      onVerifiedChange(cleanEmail);
      onToast?.(`Email ${cleanEmail} is already verified!`, 'success');
      return;
    }

    await sendEmailVerification(user);
    setLinkSentTo(cleanEmail);
    setNeedsAccountPassword(false);
    setExistingPassword('');
    setResendCooldown(30);
    const msg = `Verification link sent to ${cleanEmail}. Check your inbox or spam folder.`;
    setInfo(msg);
    onToast?.(msg, 'success');
  };

  const handleSendVerification = async () => {
    setError('');
    setInfo('');

    if (!isValidEmail) {
      setError('Please enter a valid email address.');
      return;
    }

    setSending(true);
    try {
      // Case 1: Primary signed-in user matches this email (Seller onboarding / signed-in Rider)
      if (auth.currentUser?.email?.trim().toLowerCase() === cleanEmail) {
        await dispatchVerificationForUser(auth.currentUser, 'primary');
        return;
      }

      // Case 2: Isolated verification auth already signed into this email
      if (verificationAuth.currentUser?.email?.trim().toLowerCase() === cleanEmail) {
        await dispatchVerificationForUser(verificationAuth.currentUser, 'isolated');
        return;
      }

      // Case 3: Applicant entered existing Smart Basket password after email-already-in-use prompt
      if (needsAccountPassword) {
        if (existingPassword.length < 6) {
          setError('Enter your Smart Basket account password (at least 6 characters).');
          return;
        }
        const cred = await signInWithEmailAndPassword(verificationAuth, cleanEmail, existingPassword);
        await dispatchVerificationForUser(cred.user, 'isolated');
        return;
      }

      // Case 4: New email — create lightweight verification session on isolated auth instance
      const derivedSecret = deriveVerificationSecret(cleanEmail);
      try {
        const cred = await createUserWithEmailAndPassword(verificationAuth, cleanEmail, derivedSecret);
        await dispatchVerificationForUser(cred.user, 'isolated');
      } catch (createErr) {
        const code = (createErr as { code?: string } | null)?.code || '';
        if (code === 'auth/email-already-in-use') {
          try {
            const cred = await signInWithEmailAndPassword(verificationAuth, cleanEmail, derivedSecret);
            await dispatchVerificationForUser(cred.user, 'isolated');
          } catch {
            // Email belongs to an existing Smart Basket customer account with a custom password
            setNeedsAccountPassword(true);
            setInfo('This email already has a Smart Basket account. Enter your account password below to send/confirm verification.');
          }
        } else {
          throw createErr;
        }
      }
    } catch (err) {
      const msg = getFirebaseAuthErrorMessage(err);
      setError(msg);
      onToast?.(msg, 'error');
    } finally {
      setSending(false);
    }
  };

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
            Email Verification Required
          </span>
        )}
      </div>

      <div className="flex items-stretch gap-2">
        <div
          className={`flex-1 flex items-center rounded-lg border overflow-hidden transition ${
            isVerified
              ? 'border-emerald-400 bg-emerald-50/40'
              : readOnlyEmail
              ? 'border-slate-200 bg-slate-100'
              : 'border-slate-300 bg-slate-50 focus-within:border-[#2874F0] focus-within:bg-white'
          }`}
        >
          <span className="pl-3 pr-1 text-slate-400 shrink-0">
            <Mail className="w-4 h-4" />
          </span>
          <input
            type="email"
            required={required}
            readOnly={readOnlyEmail}
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="name@example.com"
            className={`w-full h-11 px-2 bg-transparent text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none ${
              readOnlyEmail ? 'cursor-not-allowed text-slate-600' : ''
            }`}
          />
        </div>

        <button
          type="button"
          disabled={sending || !isValidEmail || isVerified || (resendCooldown > 0 && !needsAccountPassword)}
          onClick={handleSendVerification}
          className={`px-3.5 h-11 rounded-lg text-xs font-extrabold whitespace-nowrap transition shrink-0 flex items-center justify-center gap-1.5 ${
            isVerified
              ? 'bg-emerald-600 text-white cursor-default'
              : 'bg-[#2874F0] hover:bg-[#1e60d5] text-white disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed'
          }`}
        >
          {sending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Sending...</span>
            </>
          ) : isVerified ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified ✓</span>
            </>
          ) : resendCooldown > 0 && !needsAccountPassword ? (
            <span>Resend ({resendCooldown}s)</span>
          ) : linkSentTo === cleanEmail ? (
            <span>Resend Link</span>
          ) : (
            <span>Verify Email</span>
          )}
        </button>
      </div>

      {/* Password confirmation for existing customer email being used in Rider KYC */}
      {needsAccountPassword && !isVerified && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-2">
          <p className="text-[11px] font-semibold text-amber-900">
            Enter your existing Smart Basket account password to verify <strong>{cleanEmail}</strong>:
          </p>
          <div className="flex items-stretch gap-2">
            <input
              type="password"
              value={existingPassword}
              onChange={(e) => {
                setError('');
                setExistingPassword(e.target.value);
              }}
              placeholder="Account password"
              className="flex-1 h-10 px-3 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-slate-900 focus:border-[#2874F0] focus:outline-none"
            />
            <button
              type="button"
              disabled={sending || existingPassword.length < 6}
              onClick={handleSendVerification}
              className="px-3.5 h-10 rounded-lg bg-[#2874F0] hover:bg-[#1e60d5] text-white text-xs font-bold disabled:opacity-50 transition whitespace-nowrap"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Live Verification Status Box */}
      {linkSentTo === cleanEmail && !isVerified && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 space-y-2.5">
          <div className="flex items-start gap-2 text-xs text-blue-950">
            <Mail className="w-4 h-4 text-[#2874F0] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">Verification link sent to {cleanEmail}</p>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                Open your email inbox, tap the verification link, then return here or tap the button below.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={checking}
            onClick={() => checkVerificationStatus(false)}
            className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {checking ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Checking verification status...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>I&apos;ve Verified — Check Status</span>
              </>
            )}
          </button>
        </div>
      )}

      {info && !error && !isVerified && linkSentTo !== cleanEmail && !needsAccountPassword && (
        <p className="text-[11px] font-semibold text-blue-700">{info}</p>
      )}

      {error && (
        <p className="text-[11px] font-semibold text-rose-600 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

// =============================================================================
// 2. STRICT INDIAN MOBILE NUMBER + REAL-TIME FIRESTORE DUPLICATE CHECK
// =============================================================================
export interface MobileAvailabilityState {
  validFormat: boolean;
  checking: boolean;
  available: boolean;
  error?: string;
}

interface IndianMobileFieldProps {
  label?: string;
  phone: string;
  onPhoneChange: (nextPhone: string) => void;
  onAvailabilityChange: (state: MobileAvailabilityState) => void;
  excludeSellerEmail?: string;
  excludeSellerUid?: string;
  excludeRiderEmail?: string;
  excludeRiderId?: string;
  required?: boolean;
}

export const IndianMobileField: React.FC<IndianMobileFieldProps> = ({
  label = 'Mobile Number',
  phone,
  onPhoneChange,
  onAvailabilityChange,
  excludeSellerEmail,
  excludeSellerUid,
  excludeRiderEmail,
  excludeRiderId,
  required = true,
}) => {
  const cleanPhone = phone.replace(/\D/g, '').slice(0, 10);
  const isValidFormat = isValidIndianMobile(cleanPhone);
  const showStartDigitError = cleanPhone.length > 0 && !/^[6-9]/.test(cleanPhone);

  const [state, setState] = useState<MobileAvailabilityState>({
    validFormat: isValidFormat,
    checking: false,
    available: false,
  });

  useEffect(() => {
    let active = true;

    if (!isValidFormat) {
      const next: MobileAvailabilityState = {
        validFormat: false,
        checking: false,
        available: false,
        error: showStartDigitError
          ? 'Indian mobile numbers must start with 6, 7, 8, or 9.'
          : undefined,
      };
      setState(next);
      onAvailabilityChange(next);
      return;
    }

    const checkingState: MobileAvailabilityState = {
      validFormat: true,
      checking: true,
      available: false,
    };
    setState(checkingState);
    onAvailabilityChange(checkingState);

    const timer = window.setTimeout(() => {
      checkDuplicateMobileFirestore(cleanPhone, {
        excludeSellerEmail,
        excludeSellerUid,
        excludeRiderEmail,
        excludeRiderId,
      })
        .then((res) => {
          if (!active) return;
          const resolved: MobileAvailabilityState = {
            validFormat: true,
            checking: false,
            available: res.available,
            error: res.available ? undefined : res.reason,
          };
          setState(resolved);
          onAvailabilityChange(resolved);
        })
        .catch(() => {
          if (!active) return;
          const fallback: MobileAvailabilityState = {
            validFormat: true,
            checking: false,
            available: true,
          };
          setState(fallback);
          onAvailabilityChange(fallback);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [cleanPhone, isValidFormat, showStartDigitError, excludeSellerEmail, excludeSellerUid, excludeRiderEmail, excludeRiderId]);

  const isDuplicateError = isValidFormat && !state.checking && !state.available && Boolean(state.error);
  const isAvailable = isValidFormat && !state.checking && state.available;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-bold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {state.checking && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2874F0]">
            <Loader2 className="w-3 h-3 animate-spin" />
            Checking availability...
          </span>
        )}
        {isAvailable && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Available ✓
          </span>
        )}
      </div>

      <div
        className={`flex items-center rounded-lg border bg-slate-50 overflow-hidden transition ${
          isAvailable
            ? 'border-emerald-400 bg-emerald-50/40'
            : showStartDigitError || isDuplicateError
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
          onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="9876543210"
          className="w-full h-11 px-3 bg-transparent text-sm font-mono font-semibold text-slate-900 placeholder-slate-400 focus:outline-none"
        />
      </div>

      {showStartDigitError && (
        <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          Indian mobile numbers must start with 6, 7, 8, or 9.
        </p>
      )}

      {isDuplicateError && state.error && (
        <p className="text-[11px] font-semibold text-rose-600 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{state.error}</span>
        </p>
      )}
    </div>
  );
};

// =============================================================================
// 3. REAL INDIA POST 6-DIGIT PINCODE LOOKUP
// =============================================================================
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
