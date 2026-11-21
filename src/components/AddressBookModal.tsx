import React, { useEffect, useState } from 'react';
import { AddressLabel, SavedAddress, formatSavedAddressLine } from '../types';
import {
  isValidIndianMobile,
  isValidIndianPincodeFormat,
  lookupIndianPincode,
} from '../utils/indianKycValidation';

interface Props {
  open: boolean;
  onClose: () => void;
  addresses: SavedAddress[];
  selectedAddressId?: string;
  defaultName?: string;
  defaultPhone?: string;
  onSaveAddresses: (next: SavedAddress[], selectedId?: string) => Promise<void> | void;
  onSelectAddress?: (addr: SavedAddress) => void;
  mode?: 'manage' | 'select';
}

const LABELS: { value: AddressLabel; icon: string }[] = [
  { value: 'Home', icon: 'fa-house' },
  { value: 'Work', icon: 'fa-briefcase' },
  { value: 'Other', icon: 'fa-location-dot' },
];

export const AddressBookModal: React.FC<Props> = ({
  open,
  onClose,
  addresses,
  selectedAddressId,
  defaultName = '',
  defaultPhone = '',
  onSaveAddresses,
  onSelectAddress,
  mode = 'manage',
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [label, setLabel] = useState<AddressLabel>('Home');
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [houseStreet, setHouseStreet] = useState('');
  const [area, setArea] = useState('');
  const [city, setCity] = useState('New Delhi');
  const [stateName, setStateName] = useState('Delhi');
  const [pincode, setPincode] = useState('110039');
  const [isDefault, setIsDefault] = useState(true);

  const [pinLoading, setPinLoading] = useState(false);
  const [pinInfo, setPinInfo] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormError('');
    setPinInfo('');
    if (addresses.length === 0) {
      setShowForm(true);
      setEditingId(null);
      setLabel('Home');
      setName(defaultName);
      setPhone(defaultPhone);
      setHouseStreet('');
      setArea('');
      setCity('New Delhi');
      setStateName('Delhi');
      setPincode('110039');
      setIsDefault(true);
    } else {
      setShowForm(false);
      setEditingId(null);
    }
  }, [open, addresses.length, defaultName, defaultPhone]);

  if (!open) return null;

  const openAddForm = () => {
    setEditingId(null);
    setLabel('Home');
    setName(defaultName);
    setPhone(defaultPhone);
    setHouseStreet('');
    setArea('');
    setCity('New Delhi');
    setStateName('Delhi');
    setPincode('110039');
    setIsDefault(addresses.length === 0);
    setPinInfo('');
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (addr: SavedAddress) => {
    setEditingId(addr.id);
    setLabel(addr.label || 'Home');
    setName(addr.name || defaultName);
    setPhone(addr.phone || defaultPhone);
    setHouseStreet(addr.houseStreet || '');
    setArea(addr.area || '');
    setCity(addr.city || '');
    setStateName(addr.state || '');
    setPincode(addr.pincode || '110039');
    setIsDefault(Boolean(addr.isDefault));
    setPinInfo('');
    setFormError('');
    setShowForm(true);
  };

  const handlePincodeChange = async (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 6);
    setPincode(digits);
    setPinInfo('');
    if (digits.length === 6) {
      setPinLoading(true);
      const res = await lookupIndianPincode(digits);
      setPinLoading(false);
      if (res.valid) {
        if (res.district) setCity(res.district);
        if (res.state) setStateName(res.state);
        if (res.postOffice && !area.trim()) setArea(res.postOffice);
        setPinInfo(`${res.postOffice ? `${res.postOffice}, ` : ''}${res.district}, ${res.state}`);
      } else {
        setPinInfo(res.error || 'Could not verify pincode');
      }
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanName = name.trim();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const cleanHouse = houseStreet.trim();
    const cleanCity = city.trim();
    const cleanPin = pincode.replace(/\D/g, '').slice(0, 6);

    if (cleanName.length < 2) {
      setFormError('Please enter recipient full name.');
      return;
    }
    if (!isValidIndianMobile(cleanPhone)) {
      setFormError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (cleanHouse.length < 4) {
      setFormError('Please enter House/Flat No., Building & Street.');
      return;
    }
    if (!isValidIndianPincodeFormat(cleanPin)) {
      setFormError('Please enter a valid 6-digit Indian Pincode.');
      return;
    }
    if (!cleanCity) {
      setFormError('Please enter City / District.');
      return;
    }

    setSaving(true);
    const id = editingId || `addr_${Date.now()}`;
    const entry: SavedAddress = {
      id,
      label,
      name: cleanName,
      phone: cleanPhone,
      houseStreet: cleanHouse,
      area: area.trim() || undefined,
      city: cleanCity,
      state: stateName.trim() || undefined,
      pincode: cleanPin,
      isDefault: isDefault || addresses.length === 0,
      updatedAt: new Date().toISOString(),
    };

    let next: SavedAddress[];
    if (editingId) {
      next = addresses.map((a) => (a.id === editingId ? entry : a));
    } else {
      next = [entry, ...addresses];
    }

    if (entry.isDefault) {
      next = next.map((a) => ({ ...a, isDefault: a.id === entry.id }));
    } else if (!next.some((a) => a.isDefault) && next.length > 0) {
      next[0] = { ...next[0], isDefault: true };
    }

    await onSaveAddresses(next, entry.id);
    if (onSelectAddress && mode === 'select') {
      onSelectAddress(entry);
    }
    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    if (mode === 'select') {
      onClose();
    }
  };

  const handleSetDefault = async (id: string) => {
    const next = addresses.map((a) => ({ ...a, isDefault: a.id === id }));
    await onSaveAddresses(next, id);
  };

  const handleDelete = async (id: string) => {
    const remaining = addresses.filter((a) => a.id !== id);
    if (remaining.length > 0 && !remaining.some((a) => a.isDefault)) {
      remaining[0] = { ...remaining[0], isDefault: true };
    }
    await onSaveAddresses(remaining, remaining[0]?.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 bg-[#2874F0] text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-extrabold tracking-tight">
              {showForm
                ? editingId
                  ? 'Edit Delivery Address'
                  : 'Add New Delivery Address'
                : mode === 'select'
                  ? 'Select Delivery Address'
                  : 'My Saved Addresses'}
            </h2>
            <p className="text-[11px] text-blue-100 mt-0.5">
              Save Home, Work &amp; Other addresses with 6-digit Indian Pincode verification
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close address modal"
            className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center text-white"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {showForm ? (
            <form onSubmit={handleSaveForm} className="space-y-3">
              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Address Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {LABELS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setLabel(item.value)}
                      className={`h-9 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        label === item.value
                          ? 'bg-[#2874F0] border-[#2874F0] text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <i className={`fa-solid ${item.icon} text-[11px]`}></i>
                      <span>{item.value}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Recipient full name"
                    className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">10-Digit Mobile *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pincode (6 digits) *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={pincode}
                      onChange={(e) => handlePincodeChange(e.target.value)}
                      placeholder="110039"
                      className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm font-mono font-semibold focus:bg-white focus:border-[#2874F0] focus:outline-none"
                    />
                    {pinLoading && (
                      <i className="fa-solid fa-spinner fa-spin text-[#2874F0] text-xs absolute right-3 top-3"></i>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City / District *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="New Delhi"
                    className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
              </div>

              {pinInfo && (
                <p className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5">
                  <i className="fa-solid fa-circle-check"></i>
                  <span>{pinInfo}</span>
                </p>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  House / Flat No., Building, Street *
                </label>
                <input
                  type="text"
                  required
                  value={houseStreet}
                  onChange={(e) => setHouseStreet(e.target.value)}
                  placeholder="House No. 42, Main Market Road"
                  className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Area / Landmark
                  </label>
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="Bawana / Near Metro"
                    className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    placeholder="Delhi"
                    className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-[#2874F0] focus:outline-none"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 accent-[#2874F0] rounded"
                />
                <span>Make this my default delivery address</span>
              </label>

              <div className="flex items-center gap-2 pt-2">
                {addresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                    }}
                    className="px-4 h-10 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 h-10 rounded-lg bg-[#FB641B] hover:bg-[#e55a14] text-white text-xs font-extrabold uppercase tracking-wide transition disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Address' : 'Save & Use Address'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <button
                type="button"
                onClick={openAddForm}
                className="w-full py-3 px-4 rounded-lg border border-dashed border-[#2874F0] bg-blue-50/50 hover:bg-blue-50 text-[#2874F0] text-xs font-extrabold flex items-center justify-center gap-2 transition"
              >
                <i className="fa-solid fa-plus"></i>
                <span>ADD A NEW ADDRESS</span>
              </button>

              <div className="space-y-2.5">
                {addresses.map((addr) => {
                  const isSelected = selectedAddressId === addr.id;
                  return (
                    <div
                      key={addr.id}
                      className={`p-3.5 rounded-lg border transition ${
                        isSelected
                          ? 'border-[#2874F0] bg-blue-50/40 ring-1 ring-[#2874F0]/20'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-extrabold uppercase tracking-wider">
                              {addr.label}
                            </span>
                            <span className="text-sm font-bold text-slate-900">{addr.name}</span>
                            <span className="text-xs font-semibold text-slate-600">{addr.phone}</span>
                            {addr.isDefault && (
                              <span className="text-[10px] font-bold text-emerald-700">
                                · Default
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                            {formatSavedAddressLine(addr)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-3 text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => openEditForm(addr)}
                            className="text-[#2874F0] hover:underline"
                          >
                            Edit
                          </button>
                          {!addr.isDefault && (
                            <button
                              type="button"
                              onClick={() => handleSetDefault(addr.id)}
                              className="text-slate-600 hover:text-slate-900"
                            >
                              Set Default
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(addr.id)}
                            className="text-rose-600 hover:underline"
                          >
                            Delete
                          </button>
                        </div>

                        {onSelectAddress && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectAddress(addr);
                              onClose();
                            }}
                            className={`px-3.5 py-1.5 rounded text-xs font-extrabold transition ${
                              isSelected
                                ? 'bg-[#2874F0] text-white'
                                : 'bg-[#FB641B] hover:bg-[#e55a14] text-white'
                            }`}
                          >
                            {isSelected ? 'Selected' : 'Deliver Here'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
