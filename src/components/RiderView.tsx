import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Bike,
  Camera,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck2,
  IdCard,
  IndianRupee,
  KeyRound,
  LocateFixed,
  LogOut,
  MapPin,
  Navigation,
  Package,
  Phone,
  RefreshCw,
  ShieldCheck,
  Truck,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import {
  DeliveryBoy,
  Order,
  extractPincodeFromAddress,
  formatINR,
  isOnlinePaidOrder,
} from '../types';
import {
  authenticateDeliveryBoyFirestore,
  markOrderOutForDeliveryFirestore,
  submitRiderKycApplicationFirestore,
  subscribeDeliveryBoysFirestore,
  subscribeRiderOrdersFirestore,
  updateOrderRiderLocationFirestore,
  verifyAndDeliverOrderFirestore,
} from '../services/firestoreService';
import { setStoredCurrentRider } from '../store/localStore';
import {
  EmailVerificationField,
  IndianMobileField,
  IndianPincodeField,
  MobileAvailabilityState,
} from './IndianVerificationFields';
import {
  PincodeLookupResult,
  isValidAadhaarVerhoeff,
  isValidIndianMobile,
  isValidIndianVehicleNumber,
} from '../utils/indianKycValidation';

interface RiderViewProps {
  rider: DeliveryBoy | null;
  initialView?: 'login' | 'register';
  onRiderAuthenticated: (rider: DeliveryBoy) => void;
  onRiderLogout: () => void;
  onExit: () => void;
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

const VEHICLE_TYPES = ['Bike', 'Scooter', 'Electric Scooter', 'Auto / Tempo', 'Cycle'] as const;

function compressImageFile(file: File, maxDim = 480, quality = 0.62): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

function captureCurrentGpsCoords(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
    );
  });
}

export const RiderView: React.FC<RiderViewProps> = ({
  rider,
  initialView = 'login',
  onRiderAuthenticated,
  onRiderLogout,
  onExit,
  showToast,
}) => {
  // Unauthenticated view switcher ('login' | 'register')
  const [authTab, setAuthTab] = useState<'login' | 'register'>(initialView);

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginFeedback, setLoginFeedback] = useState<{ text: string; pendingKyc?: boolean } | null>(null);

  // KYC Self-Registration form state
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regMobileStatus, setRegMobileStatus] = useState<MobileAvailabilityState>({
    validFormat: false,
    checking: false,
    available: false,
  });
  const [regEmail, setRegEmail] = useState('');
  const [regVerifiedEmail, setRegVerifiedEmail] = useState<string | null>(null);
  const [regPincode, setRegPincode] = useState('');
  const [regSelectedPostOffice, setRegSelectedPostOffice] = useState('');
  const [regPincodeResult, setRegPincodeResult] = useState<PincodeLookupResult | null>(null);
  const [regVehicleType, setRegVehicleType] = useState<string>('Bike');
  const [regVehicleNumber, setRegVehicleNumber] = useState('');
  const [regAadhaarNumber, setRegAadhaarNumber] = useState('');
  const [regAadhaarPhoto, setRegAadhaarPhoto] = useState('');
  const [regDlPhoto, setRegDlPhoto] = useState('');
  const [regSelfiePhoto, setRegSelfiePhoto] = useState('');
  const [regPin, setRegPin] = useState('');
  const [submittingKyc, setSubmittingKyc] = useState(false);
  const [submittedApplication, setSubmittedApplication] = useState<DeliveryBoy | null>(null);

  const aadhaarInputRef = useRef<HTMLInputElement | null>(null);
  const dlInputRef = useRef<HTMLInputElement | null>(null);
  const selfieInputRef = useRef<HTMLInputElement | null>(null);

  // Authenticated Rider dashboard state
  const [liveRiderProfile, setLiveRiderProfile] = useState<DeliveryBoy | null>(rider);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);
  const [gpsBusyOrderId, setGpsBusyOrderId] = useState<number | null>(null);
  const [otpModalOrder, setOtpModalOrder] = useState<Order | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  useEffect(() => {
    setAuthTab(initialView);
  }, [initialView]);

  useEffect(() => {
    setLiveRiderProfile(rider);
  }, [rider]);

  // Subscribe to rider's live profile (for COD Cash in Hand updates & settlements)
  useEffect(() => {
    if (!rider) return;
    const unsub = subscribeDeliveryBoysFirestore((allRiders) => {
      const matched = allRiders.find(
        (r) =>
          r.id === rider.id ||
          (rider.docId && r.docId === rider.docId) ||
          r.riderId.toLowerCase() === rider.riderId.toLowerCase()
      );
      if (matched) {
        setLiveRiderProfile(matched);
      }
    });
    return () => unsub();
  }, [rider]);

  // Subscribe to orders assigned to this rider
  useEffect(() => {
    if (!rider) {
      setOrders([]);
      return;
    }
    const unsub = subscribeRiderOrdersFirestore(
      rider,
      (list) => setOrders(list),
      () => {}
    );
    return () => unsub();
  }, [rider]);

  const activeDeliveries = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status !== 'Delivered' &&
          o.status !== 'Cancelled' &&
          o.status !== 'Refunded'
      ),
    [orders]
  );

  const completedDeliveries = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === 'Delivered' ||
          o.status === 'Return Requested' ||
          o.status === 'Return Approved' ||
          o.status === 'Refunded'
      ),
    [orders]
  );

  const codPendingToCollect = useMemo(
    () =>
      activeDeliveries
        .filter((o) => !isOnlinePaidOrder(o))
        .reduce((sum, o) => sum + Number(o.total_amount ?? o.total ?? 0), 0),
    [activeDeliveries]
  );

  const effectiveRider = liveRiderProfile || rider;

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string>>,
    label: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 480, 0.62);
      setter(compressed);
      showToast(`${label} captured successfully`, 'success');
    } catch {
      showToast(`Could not process ${label}. Please retake using camera.`, 'error');
    }
  };

  const handleRiderLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginFeedback(null);
    setLoggingIn(true);
    const res = await authenticateDeliveryBoyFirestore(identifier, password);
    setLoggingIn(false);
    if (!res.success || !res.rider) {
      setLoginFeedback({ text: res.message, pendingKyc: res.pendingKyc });
      showToast(res.message, res.pendingKyc ? 'info' : 'error');
      return;
    }
    setStoredCurrentRider(res.rider);
    onRiderAuthenticated(res.rider);
    showToast(res.message, 'success');
  };

  const cleanRegPhone = regPhone.replace(/\D/g, '').slice(0, 10);
  const cleanRegEmail = regEmail.trim().toLowerCase();
  const isRegEmailVerified = Boolean(
    regVerifiedEmail &&
      regVerifiedEmail.toLowerCase() === cleanRegEmail &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanRegEmail)
  );
  const isRegMobileAvailable = Boolean(
    isValidIndianMobile(cleanRegPhone) && !regMobileStatus.checking && regMobileStatus.available
  );
  const isRegPincodeVerified = Boolean(regPincodeResult?.valid);
  const isRegVehicleValid = isValidIndianVehicleNumber(regVehicleNumber);
  const isRegAadhaarValid = isValidAadhaarVerhoeff(regAadhaarNumber);
  const hasAllKycPhotos = Boolean(regAadhaarPhoto && regDlPhoto && regSelfiePhoto);
  const isRegPinValid = /^\d{4}$/.test(regPin);
  const canSubmitKyc =
    regName.trim().length >= 2 &&
    isRegEmailVerified &&
    isRegMobileAvailable &&
    isRegPincodeVerified &&
    isRegVehicleValid &&
    isRegAadhaarValid &&
    hasAllKycPhotos &&
    isRegPinValid;

  const handleKycSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (regName.trim().length < 2) {
      showToast('Please enter your Full Name.', 'error');
      return;
    }
    if (!isRegEmailVerified) {
      showToast('Please verify your Email Address via Firebase verification link before submitting.', 'error');
      return;
    }
    if (!isValidIndianMobile(cleanRegPhone)) {
      showToast('Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.', 'error');
      return;
    }
    if (!isRegMobileAvailable) {
      showToast(
        regMobileStatus.error || 'This mobile number is already registered or still being checked.',
        'error'
      );
      return;
    }
    if (!regPincodeResult?.valid) {
      showToast('Please enter a valid 6-digit Indian Pincode verified by India Post.', 'error');
      return;
    }
    if (!isRegVehicleValid) {
      showToast('Enter a valid Indian RTO Vehicle Number (e.g., DL01AB1234).', 'error');
      return;
    }
    if (!isRegAadhaarValid) {
      showToast('Invalid 12-digit Aadhaar Number (failed official Verhoeff checksum).', 'error');
      return;
    }
    if (!regAadhaarPhoto || !regDlPhoto || !regSelfiePhoto) {
      showToast('Please capture live camera photos of Aadhaar, Driving License, and Live Selfie.', 'error');
      return;
    }
    if (!isRegPinValid) {
      showToast('Please create a 4-digit numeric Login PIN.', 'error');
      return;
    }

    const postOfficeName = regSelectedPostOffice || regPincodeResult.postOffice || '';
    const resolvedAreaPincode = `${postOfficeName ? `${postOfficeName}, ` : ''}${
      regPincodeResult.district || ''
    }, ${regPincodeResult.state || ''} - ${regPincodeResult.pincode}`;

    setSubmittingKyc(true);
    const res = await submitRiderKycApplicationFirestore({
      name: regName,
      phone: cleanRegPhone,
      email: cleanRegEmail,
      areaPincode: resolvedAreaPincode,
      vehicleType: regVehicleType,
      vehicleNumber: regVehicleNumber.trim().toUpperCase(),
      aadhaarNumber: regAadhaarNumber,
      aadhaarPhoto: regAadhaarPhoto,
      drivingLicensePhoto: regDlPhoto,
      selfiePhoto: regSelfiePhoto,
      loginPin: regPin,
    });
    setSubmittingKyc(false);
    if (!res.success || !res.rider) {
      showToast(res.message, 'error');
      return;
    }
    setSubmittedApplication(res.rider);
    showToast(res.message, 'success');
  };

  const handleMarkOutForDelivery = async (order: Order) => {
    setBusyOrderId(order.id);
    showToast('Capturing live GPS location...', 'info');
    const coords = await captureCurrentGpsCoords();
    const res = await markOrderOutForDeliveryFirestore(order, coords);
    setBusyOrderId(null);
    if (!res.success) {
      showToast(res.message, 'error');
      return;
    }
    if (!coords) {
      showToast(`Order #${order.id} Out for Delivery (Enable GPS to share live map pin)`, 'info');
    } else {
      showToast(res.message, 'success');
    }
  };

  const handleRefreshLiveGps = async (order: Order) => {
    setGpsBusyOrderId(order.id);
    const coords = await captureCurrentGpsCoords();
    if (!coords) {
      setGpsBusyOrderId(null);
      showToast('Location permission denied or unavailable. Please enable GPS.', 'error');
      return;
    }
    const res = await updateOrderRiderLocationFirestore(order, coords.lat, coords.lng);
    setGpsBusyOrderId(null);
    showToast(res.message, res.success ? 'success' : 'error');
  };

  const openOtpModal = (order: Order) => {
    setOtpModalOrder(order);
    setOtpInput('');
    setOtpError('');
  };

  const handleVerifyDeliveryOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpModalOrder) return;
    setOtpError('');
    setVerifyingOtp(true);
    const res = await verifyAndDeliverOrderFirestore(otpModalOrder, otpInput, effectiveRider);
    setVerifyingOtp(false);
    if (!res.success) {
      setOtpError(res.message);
      return;
    }
    showToast(res.message, 'success');
    setOtpModalOrder(null);
    setOtpInput('');
  };

  // ===========================================================================
  // UNAUTHENTICATED SCREEN: RIDER LOGIN + JOIN AS DELIVERY PARTNER (KYC)
  // ===========================================================================
  if (!effectiveRider) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] flex flex-col">
        {/* Top Bar */}
        <header className="bg-[#0F172A] text-white sticky top-0 z-30 shadow-md">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
            <button
              onClick={onExit}
              className="flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Smart Basket
            </button>
            <div className="flex items-center gap-2">
              <Bike className="w-5 h-5 text-[#FFE500]" />
              <span className="font-bold text-sm tracking-tight">Delivery Partner Portal</span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 max-w-xl w-full mx-auto">
          {/* Tab Switcher */}
          <div className="bg-white rounded-2xl p-1.5 shadow-sm border border-gray-200 grid grid-cols-2 gap-1.5 mb-5">
            <button
              type="button"
              onClick={() => {
                setAuthTab('login');
                setSubmittedApplication(null);
              }}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
                authTab === 'login'
                  ? 'bg-[#2874F0] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Bike className="w-4 h-4" />
              Delivery Partner Login
            </button>
            <button
              type="button"
              onClick={() => setAuthTab('register')}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
                authTab === 'register'
                  ? 'bg-[#0F172A] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Join as Delivery Partner
            </button>
          </div>

          {authTab === 'login' ? (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-[#2874F0] to-[#1a5bc9] px-6 py-6 text-white">
                <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center mb-3">
                  <Truck className="w-6 h-6 text-[#FFE500]" />
                </div>
                <h1 className="text-xl font-extrabold tracking-tight">Delivery Partner Login</h1>
                <p className="text-xs text-blue-100 mt-1">
                  Sign in with your Mobile Number, Rider ID, or Email and 4-digit Login PIN.
                </p>
              </div>

              <form onSubmit={handleRiderLogin} className="p-6 space-y-4">
                {loginFeedback && (
                  <div
                    className={`rounded-xl p-3.5 border flex items-start gap-2.5 text-xs font-semibold ${
                      loginFeedback.pendingKyc
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    {loginFeedback.pendingKyc ? (
                      <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      {loginFeedback.pendingKyc && (
                        <p className="font-extrabold text-amber-950 mb-0.5">
                          KYC Verification Pending from Admin
                        </p>
                      )}
                      <p>{loginFeedback.text}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                    Phone Number / Rider ID / Email
                  </label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g., 9876543210 or RDR-1024"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#2874F0] focus:border-[#2874F0] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">
                    4-Digit Login PIN / Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your 4-digit PIN or password"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#2874F0] focus:border-[#2874F0] outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loggingIn}
                  className="w-full py-3 rounded-lg bg-[#FB641B] hover:bg-[#e55a14] text-white font-bold text-sm shadow-sm transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {loggingIn ? 'Verifying Rider Account...' : 'Sign In to Rider Dashboard'}
                </button>

                <div className="pt-3 border-t border-gray-100 text-center">
                  <p className="text-xs text-gray-500 mb-2">New to Smart Basket Fleet?</p>
                  <button
                    type="button"
                    onClick={() => setAuthTab('register')}
                    className="text-xs font-bold text-[#2874F0] hover:underline inline-flex items-center gap-1"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Register & Upload KYC Documents Now
                  </button>
                </div>
              </form>
            </div>
          ) : submittedApplication ? (
            <div className="bg-white rounded-2xl shadow-lg border border-emerald-200 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8" />
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-extrabold uppercase tracking-wide">
                Status: Pending KYC
              </span>
              <h2 className="text-xl font-extrabold text-gray-900 mt-3">
                Application Submitted Successfully!
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                Thank you, <span className="font-bold text-gray-900">{submittedApplication.name}</span>. Your
                Aadhaar, Driving License, and Selfie have been sent to Smart Basket Admin for KYC verification.
              </p>

              <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Your Rider ID</span>
                  <span className="font-mono font-extrabold text-[#2874F0]">{submittedApplication.riderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Registered Phone</span>
                  <span className="font-bold text-gray-900">{submittedApplication.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Area & Vehicle</span>
                  <span className="font-semibold text-gray-800">{submittedApplication.vehicleArea}</span>
                </div>
              </div>

              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                Once Admin approves your KYC, sign in using your Phone Number ({submittedApplication.phone}) or Rider ID ({submittedApplication.riderId}) and your 4-digit PIN.
              </p>

              <button
                type="button"
                onClick={() => {
                  setIdentifier(submittedApplication.phone);
                  setSubmittedApplication(null);
                  setAuthTab('login');
                }}
                className="mt-5 w-full py-3 rounded-lg bg-[#2874F0] hover:bg-[#1e60d5] text-white font-bold text-sm transition"
              >
                Go to Delivery Partner Login
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] px-6 py-5 text-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#FFE500]/15 border border-[#FFE500]/30 flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-[#FFE500]" />
                  </div>
                  <div>
                    <h1 className="text-lg font-extrabold tracking-tight">Join as Delivery Partner</h1>
                    <p className="text-xs text-slate-300">
                      Complete KYC registration to start delivering orders in your area
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleKycSubmit} className="p-5 sm:p-6 space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g., Rahul Sharma"
                    className="w-full h-11 px-3 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#2874F0] outline-none"
                  />
                </div>

                {/* Mandatory Firebase Email Verification (APK-Compatible, Zero reCAPTCHA) */}
                <EmailVerificationField
                  label="Email Address"
                  email={regEmail}
                  onEmailChange={setRegEmail}
                  verifiedEmail={regVerifiedEmail}
                  onVerifiedChange={setRegVerifiedEmail}
                  onToast={showToast}
                />

                {/* Strict Indian Mobile Format + Live Firestore Duplicate Check */}
                <IndianMobileField
                  label="10-Digit Indian Mobile Number"
                  phone={regPhone}
                  onPhoneChange={setRegPhone}
                  onAvailabilityChange={setRegMobileStatus}
                />

                {/* Strict India Post 6-Digit Pincode Lookup */}
                <IndianPincodeField
                  label="Delivery Area 6-Digit Pincode"
                  pincode={regPincode}
                  onPincodeChange={setRegPincode}
                  selectedPostOffice={regSelectedPostOffice}
                  onSelectedPostOfficeChange={setRegSelectedPostOffice}
                  onLookupResult={setRegPincodeResult}
                />

                {/* Vehicle Details with Strict Indian RTO Format Validation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Vehicle Type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={regVehicleType}
                      onChange={(e) => setRegVehicleType(e.target.value)}
                      className="w-full h-11 px-3 rounded-lg border border-gray-300 text-sm bg-white focus:ring-2 focus:ring-[#2874F0] outline-none"
                    >
                      {VEHICLE_TYPES.map((vt) => (
                        <option key={vt} value={vt}>
                          {vt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-700">
                        Vehicle Number (RTO) <span className="text-rose-500">*</span>
                      </label>
                      {regVehicleNumber.trim().length > 0 && isRegVehicleValid && (
                        <span className="text-[10px] font-extrabold text-emerald-700">
                          Valid RTO ✓
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      maxLength={15}
                      value={regVehicleNumber}
                      onChange={(e) =>
                        setRegVehicleNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9 -]/g, ''))
                      }
                      placeholder="e.g., DL01AB1234"
                      className={`w-full h-11 px-3 rounded-lg border text-sm font-mono uppercase focus:outline-none transition ${
                        regVehicleNumber.trim().length === 0
                          ? 'border-gray-300 focus:ring-2 focus:ring-[#2874F0]'
                          : isRegVehicleValid
                          ? 'border-emerald-400 bg-emerald-50/40 text-emerald-950'
                          : 'border-rose-400 bg-rose-50/40 text-rose-900'
                      }`}
                    />
                    {regVehicleNumber.trim().length > 0 && !isRegVehicleValid && (
                      <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-start gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>Use official Indian RTO format (e.g., DL01AB1234 or MH 12 DE 1433).</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Aadhaar Number (Verhoeff Checksum) & 4-Digit Login PIN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-700">
                        12-Digit Aadhaar Number <span className="text-rose-500">*</span>
                      </label>
                      {isRegAadhaarValid && (
                        <span className="text-[10px] font-extrabold text-emerald-700">
                          Verhoeff Valid ✓
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      maxLength={12}
                      value={regAadhaarNumber}
                      onChange={(e) => setRegAadhaarNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder="12-digit UIDAI Aadhaar"
                      className={`w-full h-11 px-3 rounded-lg border text-sm font-mono tracking-wider focus:outline-none transition ${
                        regAadhaarNumber.length === 0
                          ? 'border-gray-300 focus:ring-2 focus:ring-[#2874F0]'
                          : isRegAadhaarValid
                          ? 'border-emerald-400 bg-emerald-50/40 text-emerald-950'
                          : regAadhaarNumber.length === 12 || /^[01]/.test(regAadhaarNumber)
                          ? 'border-rose-400 bg-rose-50/40 text-rose-900'
                          : 'border-gray-300 focus:ring-2 focus:ring-[#2874F0]'
                      }`}
                    />
                    {regAadhaarNumber.length > 0 && /^[01]/.test(regAadhaarNumber) && (
                      <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-start gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>Aadhaar numbers cannot start with 0 or 1.</span>
                      </p>
                    )}
                    {regAadhaarNumber.length === 12 &&
                      !/^[01]/.test(regAadhaarNumber) &&
                      !isRegAadhaarValid && (
                        <p className="mt-1 text-[11px] font-semibold text-rose-600 flex items-start gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>Invalid Aadhaar number — failed official Verhoeff checksum.</span>
                        </p>
                      )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Create 4-Digit Login PIN <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      required
                      maxLength={4}
                      value={regPin}
                      onChange={(e) => setRegPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="••••"
                      className="w-full h-11 px-3 rounded-lg border border-gray-300 text-sm font-mono tracking-[0.35em] focus:ring-2 focus:ring-[#2874F0] outline-none"
                    />
                  </div>
                </div>

                {/* Mandatory Live Camera KYC Capture */}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-[#2874F0]" />
                      <h3 className="text-xs font-extrabold uppercase tracking-wide text-gray-800">
                        Live Camera KYC Capture (Required)
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#2874F0]">
                      Camera Only
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-3">
                    Capture real-time photos using your device camera — rear camera for Aadhaar &amp; Driving License, front camera for Live Selfie.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Aadhaar Card Live Rear Camera Photo */}
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center bg-gray-50/70">
                      <input
                        ref={aadhaarInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handlePhotoUpload(e, setRegAadhaarPhoto, 'Aadhaar Card Photo')}
                      />
                      {regAadhaarPhoto ? (
                        <div className="relative">
                          <img
                            src={regAadhaarPhoto}
                            alt="Aadhaar live capture preview"
                            className="w-full h-24 object-cover rounded-lg border border-emerald-300"
                          />
                          <button
                            type="button"
                            onClick={() => aadhaarInputRef.current?.click()}
                            className="mt-2 w-full py-1 rounded bg-white border border-gray-200 text-[11px] font-bold text-[#2874F0]"
                          >
                            Retake Aadhaar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => aadhaarInputRef.current?.click()}
                          className="w-full py-4 flex flex-col items-center justify-center gap-1.5 text-gray-600 hover:text-[#2874F0]"
                        >
                          <IdCard className="w-6 h-6 text-[#2874F0]" />
                          <span className="text-xs font-bold">Aadhaar Card</span>
                          <span className="text-[10px] text-gray-500 flex items-center gap-1 font-semibold">
                            <Camera className="w-3 h-3" /> Take Live Photo
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Driving License Live Rear Camera Photo */}
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center bg-gray-50/70">
                      <input
                        ref={dlInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handlePhotoUpload(e, setRegDlPhoto, 'Driving License Photo')}
                      />
                      {regDlPhoto ? (
                        <div className="relative">
                          <img
                            src={regDlPhoto}
                            alt="Driving License live capture preview"
                            className="w-full h-24 object-cover rounded-lg border border-emerald-300"
                          />
                          <button
                            type="button"
                            onClick={() => dlInputRef.current?.click()}
                            className="mt-2 w-full py-1 rounded bg-white border border-gray-200 text-[11px] font-bold text-[#2874F0]"
                          >
                            Retake License
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => dlInputRef.current?.click()}
                          className="w-full py-4 flex flex-col items-center justify-center gap-1.5 text-gray-600 hover:text-[#2874F0]"
                        >
                          <FileCheck2 className="w-6 h-6 text-emerald-600" />
                          <span className="text-xs font-bold">Driving License</span>
                          <span className="text-[10px] text-gray-500 flex items-center gap-1 font-semibold">
                            <Camera className="w-3 h-3" /> Take Live Photo
                          </span>
                        </button>
                      )}
                    </div>

                    {/* Live Front Camera Selfie */}
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center bg-gray-50/70">
                      <input
                        ref={selfieInputRef}
                        type="file"
                        accept="image/*"
                        capture="user"
                        className="hidden"
                        onChange={(e) => handlePhotoUpload(e, setRegSelfiePhoto, 'Live Selfie')}
                      />
                      {regSelfiePhoto ? (
                        <div className="relative">
                          <img
                            src={regSelfiePhoto}
                            alt="Live Selfie preview"
                            className="w-full h-24 object-cover rounded-lg border border-emerald-300"
                          />
                          <button
                            type="button"
                            onClick={() => selfieInputRef.current?.click()}
                            className="mt-2 w-full py-1 rounded bg-white border border-gray-200 text-[11px] font-bold text-[#2874F0]"
                          >
                            Retake Selfie
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => selfieInputRef.current?.click()}
                          className="w-full py-4 flex flex-col items-center justify-center gap-1.5 text-gray-600 hover:text-[#2874F0]"
                        >
                          <Camera className="w-6 h-6 text-[#FB641B]" />
                          <span className="text-xs font-bold">Live Selfie</span>
                          <span className="text-[10px] text-gray-500 flex items-center gap-1 font-semibold">
                            <Camera className="w-3 h-3" /> Capture Live Selfie
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Live KYC Verification Checklist */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                    Mandatory Verification Checklist
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] font-semibold">
                    {[
                      { label: 'Email Verified via Firebase', ok: isRegEmailVerified },
                      { label: 'Mobile Format & Uniqueness Valid', ok: isRegMobileAvailable },
                      { label: 'India Post Pincode Verified', ok: isRegPincodeVerified },
                      { label: 'Valid Indian RTO Vehicle No.', ok: isRegVehicleValid },
                      { label: 'Aadhaar Verhoeff Checksum Valid', ok: isRegAadhaarValid },
                      { label: 'All 3 Live Camera KYC Photos', ok: hasAllKycPhotos },
                      { label: '4-Digit Login PIN Created', ok: isRegPinValid },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={`flex items-center gap-1.5 ${
                          item.ok ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        <CheckCircle2
                          className={`w-3.5 h-3.5 shrink-0 ${
                            item.ok ? 'text-emerald-600' : 'text-slate-300'
                          }`}
                        />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingKyc || !canSubmitKyc}
                  className="w-full py-3.5 rounded-xl bg-[#FB641B] hover:bg-[#e55a14] text-white font-extrabold text-sm shadow-md transition disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {submittingKyc ? 'Submitting KYC Application...' : 'Submit Verified KYC & Join Fleet'}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ===========================================================================
  // AUTHENTICATED RIDER DASHBOARD
  // ===========================================================================
  const visibleOrders = activeTab === 'active' ? activeDeliveries : completedDeliveries;

  return (
    <div className="min-h-screen bg-[#F1F3F6] pb-12">
      {/* Rider Sticky Header */}
      <header className="bg-[#0F172A] text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#2874F0] flex items-center justify-center shrink-0 overflow-hidden">
              {effectiveRider.selfiePhoto ? (
                <img
                  src={effectiveRider.selfiePhoto}
                  alt={effectiveRider.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Bike className="w-5 h-5 text-[#FFE500]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base truncate">{effectiveRider.name}</h1>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase shrink-0">
                  {effectiveRider.riderId}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate">
                {effectiveRider.vehicleArea} • {effectiveRider.phone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onExit}
              className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition"
            >
              Store
            </button>
            <button
              onClick={() => {
                setStoredCurrentRider(null);
                onRiderLogout();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-semibold text-red-200 flex items-center gap-1 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-4 space-y-4">
        {/* Shift Summary Metrics including COD Cash in Hand */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="bg-white rounded-xl p-3.5 border border-gray-200/80 shadow-sm">
            <p className="text-[11px] font-semibold text-gray-500 uppercase">Active</p>
            <p className="text-xl sm:text-2xl font-extrabold text-[#2874F0] mt-0.5">
              {activeDeliveries.length}
            </p>
          </div>
          <div className="bg-white rounded-xl p-3.5 border border-gray-200/80 shadow-sm">
            <p className="text-[11px] font-semibold text-gray-500 uppercase">Completed</p>
            <p className="text-xl sm:text-2xl font-extrabold text-emerald-600 mt-0.5">
              {completedDeliveries.length}
            </p>
          </div>
          <div className="bg-white rounded-xl p-3.5 border border-amber-200/80 shadow-sm">
            <p className="text-[11px] font-semibold text-amber-700 uppercase">COD to Collect</p>
            <p className="text-lg sm:text-xl font-extrabold text-amber-600 mt-0.5">
              {formatINR(codPendingToCollect)}
            </p>
          </div>
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-3.5 text-white shadow-sm">
            <p className="text-[10px] font-bold text-emerald-100 uppercase flex items-center gap-1">
              <Wallet className="w-3 h-3" /> COD Cash in Hand
            </p>
            <p className="text-lg sm:text-xl font-extrabold mt-0.5">
              {formatINR(effectiveRider.codCashInHand || 0)}
            </p>
          </div>
        </div>

        {/* Active vs Completed Tabs */}
        <div className="bg-white rounded-xl p-1.5 border border-gray-200/80 shadow-sm flex gap-1.5">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'active'
                ? 'bg-[#2874F0] text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Truck className="w-4 h-4" />
            Active Deliveries ({activeDeliveries.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'completed'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Completed ({completedDeliveries.length})
          </button>
        </div>

        {/* Delivery Cards */}
        {visibleOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200/80 p-10 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-bold text-gray-800 text-base">
              {activeTab === 'active' ? 'No Active Deliveries Assigned' : 'No Completed Deliveries Yet'}
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              {activeTab === 'active'
                ? 'When Smart Basket Admin assigns an order to you, it will appear here instantly.'
                : 'Your OTP-verified delivered orders will be listed here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {visibleOrders.map((order) => {
              const onlinePaid = isOnlinePaidOrder(order);
              const totalAmt = Number(order.total_amount ?? order.total ?? 0);
              const pincode = extractPincodeFromAddress(order.address, order.pincode);
              const mapsQuery = encodeURIComponent(
                pincode && !order.address.includes(pincode)
                  ? `${order.address}, ${pincode}`
                  : order.address
              );
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
              const cleanPhone = order.phone.replace(/[^\d+]/g, '');
              const isOutForDelivery = order.status === 'Out for Delivery';
              const isDelivered =
                order.status === 'Delivered' ||
                order.status === 'Return Requested' ||
                order.status === 'Return Approved' ||
                order.status === 'Refunded';
              const hasLiveGps =
                typeof order.riderLiveLat === 'number' && typeof order.riderLiveLng === 'number';

              return (
                <div
                  key={order.docId || order.id}
                  className="bg-white rounded-2xl border border-gray-200/90 shadow-sm overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="px-4 py-3 bg-gray-50/90 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-gray-900">
                        Order #{order.id}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          isDelivered
                            ? 'bg-emerald-100 text-emerald-800'
                            : isOutForDelivery
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {isDelivered ? 'Delivered' : isOutForDelivery ? 'Out for Delivery' : 'Assigned'}
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(order.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Prominent Payment Collection Banner */}
                  <div
                    className={`px-4 py-2.5 flex items-center justify-between gap-2 border-b ${
                      onlinePaid
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-900'
                        : 'bg-amber-50 border-amber-200 text-amber-950'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {onlinePaid ? (
                        <CreditCard className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <IndianRupee className="w-4 h-4 text-amber-700 shrink-0" />
                      )}
                      <span className="text-xs sm:text-sm font-extrabold tracking-tight">
                        {onlinePaid
                          ? 'PAID ONLINE (₹0 to collect)'
                          : `COLLECT CASH (COD): ${formatINR(totalAmt)}`}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        onlinePaid ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                      }`}
                    >
                      {onlinePaid ? 'Prepaid' : 'COD'}
                    </span>
                  </div>

                  {/* Customer & Address Details */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-500 uppercase">Customer</p>
                        <p className="text-base font-bold text-gray-900">{order.name}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{order.phone}</p>
                      </div>
                      {pincode && (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold shrink-0">
                          PIN: {pincode}
                        </span>
                      )}
                    </div>

                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70 flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-[#2874F0] shrink-0 mt-0.5" />
                      <p className="text-xs sm:text-sm text-gray-800 leading-relaxed">
                        {order.address}
                      </p>
                    </div>

                    {/* Items summary */}
                    <div className="text-xs text-gray-600 flex flex-wrap gap-1.5">
                      {order.items.map((it) => (
                        <span
                          key={`${order.id}_${it.id}`}
                          className="px-2 py-1 rounded bg-gray-100 text-gray-700 font-medium"
                        >
                          {it.product_name} × {it.quantity}
                        </span>
                      ))}
                    </div>

                    {/* Live GPS Status Banner when Out for Delivery */}
                    {isOutForDelivery && (
                      <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-blue-900">
                          <LocateFixed className="w-4 h-4 text-[#2874F0] shrink-0" />
                          <div>
                            <p className="font-bold">
                              {hasLiveGps
                                ? 'Live GPS Sharing Active'
                                : 'GPS Coordinates Not Captured Yet'}
                            </p>
                            {hasLiveGps && (
                              <p className="text-[10px] text-blue-700">
                                {order.riderLiveLat?.toFixed(5)}, {order.riderLiveLng?.toFixed(5)}
                                {order.riderLocationUpdatedAt
                                  ? ` • Updated ${new Date(order.riderLocationUpdatedAt).toLocaleTimeString('en-IN', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}`
                                  : ''}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRefreshLiveGps(order)}
                          disabled={gpsBusyOrderId === order.id}
                          className="px-3 py-1.5 rounded-lg bg-[#2874F0] hover:bg-[#1e60d5] text-white text-[11px] font-bold flex items-center gap-1.5 transition disabled:opacity-60"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${gpsBusyOrderId === order.id ? 'animate-spin' : ''}`}
                          />
                          {gpsBusyOrderId === order.id ? 'Updating...' : 'Update Live GPS'}
                        </button>
                      </div>
                    )}

                    {/* Call Customer + Open in Google Maps */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <a
                        href={`tel:${cleanPhone}`}
                        className="py-2.5 px-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition"
                      >
                        <Phone className="w-4 h-4" />
                        Call Customer
                      </a>
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2.5 px-3 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-[#2874F0] font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition"
                      >
                        <Navigation className="w-4 h-4" />
                        Open in Google Maps
                      </a>
                    </div>

                    {/* Status Update Action Buttons */}
                    {!isDelivered ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          disabled={isOutForDelivery || busyOrderId === order.id}
                          onClick={() => handleMarkOutForDelivery(order)}
                          className={`py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition ${
                            isOutForDelivery
                              ? 'bg-orange-100 text-orange-700 cursor-default'
                              : 'bg-[#2874F0] hover:bg-[#1e60d5] text-white shadow-sm'
                          }`}
                        >
                          <LocateFixed className="w-4 h-4" />
                          {busyOrderId === order.id
                            ? 'Capturing GPS...'
                            : isOutForDelivery
                            ? 'Out for Delivery ✓'
                            : 'Out for Delivery (Share GPS)'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openOtpModal(order)}
                          className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition"
                        >
                          <KeyRound className="w-4 h-4" />
                          Mark Delivered (OTP)
                        </button>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-emerald-700 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <BadgeCheck className="w-4 h-4 text-emerald-600" />
                          OTP Verified & Delivered
                        </span>
                        {order.deliveredAt && (
                          <span className="text-gray-500 font-normal">
                            {new Date(order.deliveredAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 4-Digit Delivery OTP Verification Modal */}
      {otpModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-[#0F172A] px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#FFE500]" />
                <h3 className="font-bold text-sm">Verify Delivery OTP</h3>
              </div>
              <button
                onClick={() => setOtpModalOrder(null)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleVerifyDeliveryOtp} className="p-5 space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1">
                <p className="font-bold text-gray-900">
                  Order #{otpModalOrder.id} — {otpModalOrder.name}
                </p>
                <p
                  className={`font-extrabold ${
                    isOnlinePaidOrder(otpModalOrder) ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {isOnlinePaidOrder(otpModalOrder)
                    ? 'PAID ONLINE (Collect ₹0)'
                    : `Collect COD Cash: ${formatINR(
                        Number(otpModalOrder.total_amount ?? otpModalOrder.total ?? 0)
                      )}`}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Ask customer for their 4-digit Delivery OTP
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  required
                  value={otpInput}
                  onChange={(e) => {
                    setOtpError('');
                    setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                  }}
                  placeholder="• • • •"
                  className="w-full text-center tracking-[0.6em] font-extrabold text-2xl py-3 rounded-xl border-2 border-gray-300 focus:border-[#2874F0] outline-none"
                />
                {otpError && (
                  <p className="text-xs font-semibold text-red-600 mt-2">{otpError}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOtpModalOrder(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyingOtp || otpInput.length !== 4}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-50 transition"
                >
                  {verifyingOtp ? 'Verifying...' : 'Confirm Delivery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
