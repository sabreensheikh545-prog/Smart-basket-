import React, { useEffect, useRef, useState } from 'react';
import { Order, RETURN_REASONS, getReturnWindowInfo } from '../types';

interface Props {
  order: Order | null;
  onClose: () => void;
  onSubmitReturn: (
    order: Order,
    payload: {
      returnReason: string;
      returnResolution: 'Return' | 'Replace';
      returnProofPhoto?: string;
    }
  ) => Promise<void> | void;
}

function compressImageToJpeg(source: HTMLVideoElement | HTMLImageElement, maxWidth = 640): string {
  const srcW = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const srcH = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!srcW || !srcH) return '';
  const scale = srcW > maxWidth ? maxWidth / srcW : 1;
  const targetW = Math.max(1, Math.round(srcW * scale));
  const targetH = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(source, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/jpeg', 0.72);
}

export const ReturnRequestModal: React.FC<Props> = ({ order, onClose, onSubmitReturn }) => {
  const [resolution, setResolution] = useState<'Return' | 'Replace'>('Return');
  const [reason, setReason] = useState<string>(RETURN_REASONS[0]);
  const [extraNote, setExtraNote] = useState('');
  const [proofPhoto, setProofPhoto] = useState<string>('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (order) {
      setResolution('Return');
      setReason(RETURN_REASONS[0]);
      setExtraNote('');
      setProofPhoto('');
      setCameraError('');
      setSubmitting(false);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [order]);

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  if (!order) return null;

  const returnWindow = getReturnWindowInfo(order);

  const handleOpenLiveCamera = async () => {
    setCameraError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Live camera preview is unavailable on this browser. Use "Upload / Take Photo" instead.');
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch {
      setCameraError('Camera permission denied or no camera detected. You can upload a photo directly below.');
    }
  };

  const handleCaptureFrame = () => {
    if (!videoRef.current) return;
    const dataUrl = compressImageToJpeg(videoRef.current, 640);
    if (dataUrl) {
      setProofPhoto(dataUrl);
      stopCamera();
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraError('');
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const compressed = compressImageToJpeg(img, 640);
        if (compressed) setProofPhoto(compressed);
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    stopCamera();
    const combinedReason = extraNote.trim() ? `${reason} — ${extraNote.trim()}` : reason;
    setSubmitting(true);
    try {
      await onSubmitReturn(order, {
        returnReason: combinedReason,
        returnResolution: resolution,
        returnProofPhoto: proofPhoto || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-[2px]"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <i className="fa-solid fa-rotate-left text-sm"></i>
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                Return / Replace Order
              </h3>
              <p className="text-[11px] text-slate-500">
                Order #{order.id} ·{' '}
                {returnWindow.eligible
                  ? `${returnWindow.daysLeft} day${returnWindow.daysLeft > 1 ? 's' : ''} left in 7-day window`
                  : '7-day return window expired'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close return modal"
            className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Resolution Toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              What would you like to do?
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {(['Return', 'Replace'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setResolution(opt)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition flex items-center justify-center gap-1.5 ${
                    resolution === opt
                      ? 'bg-blue-50 border-[#2874F0] text-[#2874F0]'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <i className={`fa-solid ${opt === 'Return' ? 'fa-wallet' : 'fa-arrows-rotate'}`}></i>
                  <span>{opt === 'Return' ? 'Return & Refund' : 'Replace Item'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Select Reason</label>
            <div className="space-y-1.5">
              {RETURN_REASONS.map((r) => (
                <label
                  key={r}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border cursor-pointer transition text-xs font-semibold ${
                    reason === r
                      ? 'bg-amber-50 border-amber-400 text-amber-950'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="returnReason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="accent-[#2874F0]"
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Live Camera Photo Proof */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                Photo Proof <span className="text-slate-400 font-normal">(recommended for faster approval)</span>
              </label>
              {proofPhoto && (
                <button
                  type="button"
                  onClick={() => setProofPhoto('')}
                  className="text-[11px] font-bold text-rose-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>

            {cameraActive ? (
              <div className="rounded-xl overflow-hidden border border-slate-300 bg-slate-950 relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full max-h-56 object-cover"
                />
                <div className="p-2.5 bg-slate-900/90 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-bold hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCaptureFrame}
                    className="px-4 py-1.5 rounded-lg bg-[#2874F0] text-white text-xs font-extrabold hover:bg-[#1e60d5] inline-flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-camera"></i>
                    <span>Capture Photo</span>
                  </button>
                </div>
              </div>
            ) : proofPhoto ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5 flex items-center gap-3">
                <img
                  src={proofPhoto}
                  alt="Return proof preview"
                  className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-extrabold text-emerald-900 flex items-center gap-1">
                    <i className="fa-solid fa-circle-check text-[#2E7D32]"></i>
                    <span>Photo proof attached</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Will be shared with Seller &amp; Admin for quick verification.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenLiveCamera}
                    className="mt-1 text-[11px] font-bold text-[#2874F0] hover:underline"
                  >
                    Retake with Camera
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleOpenLiveCamera}
                  className="py-2.5 px-3 rounded-xl border border-dashed border-[#2874F0]/60 bg-blue-50/50 hover:bg-blue-50 text-[#2874F0] text-xs font-bold inline-flex items-center justify-center gap-1.5 transition"
                >
                  <i className="fa-solid fa-camera"></i>
                  <span>Live Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="py-2.5 px-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition"
                >
                  <i className="fa-solid fa-image"></i>
                  <span>Upload Photo</span>
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelected}
              className="hidden"
            />

            {cameraError && (
              <p className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                {cameraError}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Additional Details <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
              placeholder="Briefly describe the damage, defect, or mismatch..."
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-800 focus:bg-white focus:border-[#2874F0] focus:outline-none"
            />
          </div>

          <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 leading-relaxed">
            <i className="fa-solid fa-shield-halved text-[#2E7D32] mr-1.5"></i>
            Approved refunds are credited to your original payment method within{' '}
            <strong>5–7 business days</strong>.
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !returnWindow.eligible}
              className="px-5 py-2.5 rounded-xl bg-[#FB641B] disabled:opacity-50 text-white text-xs font-extrabold hover:bg-[#e55812] transition"
            >
              {submitting ? 'Submitting...' : `Submit ${resolution} Request`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
