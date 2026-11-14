import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  MoreVertical,
  PlusSquare,
  Share,
  Smartphone,
  X,
} from 'lucide-react';

interface HowToInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName?: string;
  studentShortName?: string;
  studentAvatarUrl?: string;
  portalId?: string;
  defaultPlatform?: 'android' | 'ios';
  isDeviceLocked?: boolean;
  isInstallable?: boolean;
  isInstalled?: boolean;
  onTriggerNativeInstall?: () => Promise<boolean> | void;
}

export const HowToInstallModal: React.FC<HowToInstallModalProps> = ({
  isOpen,
  onClose,
  studentName,
  studentShortName,
  studentAvatarUrl,
  portalId,
  defaultPlatform = 'android',
  isDeviceLocked = false,
  isInstallable = false,
  isInstalled = false,
  onTriggerNativeInstall,
}) => {
  const [platform, setPlatform] = useState<'android' | 'ios'>(defaultPlatform);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-install-title"
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#091e42] text-white px-5 py-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-amber-400 text-slate-950 rounded-xl shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3
                id="how-to-install-title"
                className="text-base sm:text-lg font-bold font-serif text-white truncate"
              >
                অ্যাপ ইনস্টল নির্দেশিকা (How to Install)
              </h3>
              <p className="text-xs text-slate-300 truncate">
                {studentName
                  ? `${studentName}${portalId ? ` · ${portalId}` : ''}`
                  : 'হোম স্ক্রিনে সরাসরি অ্যাপ আইকন যুক্ত করুন'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer shrink-0"
            aria-label="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Lock Confirmation + Live Passport App Icon Preview */}
          {(isDeviceLocked || studentAvatarUrl) && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#091e42] border-2 border-amber-400 overflow-hidden shrink-0 shadow-sm flex items-center justify-center">
                <img
                  src={studentAvatarUrl || '/pwa-192x192.png'}
                  alt={studentName ? `${studentName}-এর অ্যাপ আইকন` : 'অ্যাপ আইকন'}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>
                    {studentAvatarUrl
                      ? 'শিক্ষার্থীর পাসপোর্ট ছবিই স্মার্টফোনের অ্যাপ আইকন!'
                      : `${studentName || 'শিক্ষার্থীর'} ড্যাশবোর্ড স্থায়ীভাবে সেট করা হয়েছে`}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-900 leading-relaxed">
                  {isDeviceLocked
                    ? 'হোম স্ক্রিনে যুক্ত করলে আর সাইন ইন করতে হবে না। আগে অন্য আইকন থাকলে একবার নতুন করে "Add to Home screen" করলেই পাসপোর্ট ছবিটি আইকন হয়ে যাবে।'
                    : 'ইনস্টল বাটনে চাপলে শিক্ষার্থীর নাম ও পাসপোর্ট ছবি ফোনের হোম স্ক্রিনের অ্যাপ আইকন হিসেবে সেট হবে।'}
                </p>
              </div>
            </div>
          )}

          {isInstalled && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-950 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>অ্যাপটি ইতোমধ্যে আপনার ডিভাইসে সফলভাবে ইনস্টল হয়েছে!</span>
            </div>
          )}

          {/* Platform Selector Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setPlatform('android')}
              className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                platform === 'android'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Android (Chrome)
            </button>
            <button
              type="button"
              onClick={() => setPlatform('ios')}
              className={`py-2 px-3 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer ${
                platform === 'ios'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              iPhone / iPad (Safari)
            </button>
          </div>

          {/* Visual Steps: Android */}
          {platform === 'android' ? (
            <div className="space-y-3">
              {/* Step 1 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-[#091e42] text-amber-300 text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                    ১
                  </span>
                  <div className="text-xs sm:text-sm font-bold text-slate-900">
                    Chrome ব্রাউজারের উপরে ডানপাশে ৩-ডট মেনু (⋮) চাপুন
                  </div>
                </div>

                {/* Mini visual browser bar */}
                <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="font-mono truncate">d-resultcard-genarator.vercel.app</span>
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-amber-100 border border-amber-400 text-slate-900 shrink-0">
                    <MoreVertical className="w-4 h-4" />
                  </span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-[#091e42] text-amber-300 text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                    ২
                  </span>
                  <div className="text-xs sm:text-sm font-bold text-slate-900">
                    মেনু থেকে &ldquo;Add to Home screen&rdquo; বা &ldquo;Install app&rdquo; নির্বাচন করুন
                  </div>
                </div>

                {/* Mini visual menu highlight */}
                <div className="bg-white border border-slate-200 rounded-lg p-2 space-y-1 max-w-[260px] mx-auto">
                  <div className="px-2.5 py-1 text-[11px] text-slate-400">Share...</div>
                  <div className="px-2.5 py-1.5 rounded-md bg-emerald-50 border border-emerald-400 text-emerald-950 font-bold text-xs flex items-center gap-2">
                    <Download className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Add to Home screen / Install app</span>
                  </div>
                  <div className="px-2.5 py-1 text-[11px] text-slate-400">Desktop site</div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-emerald-700 text-white text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                    ৩
                  </span>
                  <div className="text-xs sm:text-sm font-bold text-slate-900">
                    &ldquo;Install&rdquo; বা &ldquo;Add&rdquo; চাপলেই হোম স্ক্রিনে অ্যাপ যুক্ত হবে
                  </div>
                </div>

                {/* Mini visual home icon */}
                <div className="flex items-center justify-center gap-3 pt-1">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-2xl bg-[#091e42] border-2 border-amber-400 flex items-center justify-center shadow-sm overflow-hidden">
                      <img
                        src={studentAvatarUrl || '/pwa-192x192.png'}
                        alt={studentName ? `${studentName} অ্যাপ আইকন` : 'ডি-লিকন অ্যাপ আইকন'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800 max-w-[80px] truncate">
                      {studentShortName || 'ডি-লিকন'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 max-w-[200px]">
                    ফোনের হোম স্ক্রিনে শিক্ষার্থীর এই আইকনে টাচ করলেই সরাসরি ড্যাশবোর্ড খুলবে।
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Visual Steps: iOS Safari */
            <div className="space-y-3">
              {/* Step 1 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-[#091e42] text-amber-300 text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                    ১
                  </span>
                  <div className="text-xs sm:text-sm font-bold text-slate-900">
                    Safari ব্রাউজারের নিচের বারে &ldquo;Share&rdquo; আইকনে ট্যাপ করুন
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg px-4 py-2 flex items-center justify-around text-slate-400">
                  <span className="text-xs">◀</span>
                  <span className="text-xs">▶</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-100 border border-sky-400 text-sky-900 font-bold text-xs">
                    <Share className="w-3.5 h-3.5" />
                    <span>Share</span>
                  </span>
                  <span className="text-xs">❐</span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-[#091e42] text-amber-300 text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                    ২
                  </span>
                  <div className="text-xs sm:text-sm font-bold text-slate-900">
                    তালিকা থেকে একটু নিচে স্ক্রল করে &ldquo;Add to Home Screen&rdquo; চাপুন
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-2 space-y-1 max-w-[260px] mx-auto">
                  <div className="px-2.5 py-1 text-[11px] text-slate-400">Copy</div>
                  <div className="px-2.5 py-1.5 rounded-md bg-sky-50 border border-sky-400 text-sky-950 font-bold text-xs flex items-center justify-between">
                    <span>Add to Home Screen</span>
                    <PlusSquare className="w-4 h-4 text-sky-700" />
                  </div>
                  <div className="px-2.5 py-1 text-[11px] text-slate-400">Add Bookmark</div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-emerald-700 text-white text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                    ৩
                  </span>
                  <div className="text-xs sm:text-sm font-bold text-slate-900">
                    উপরে ডানপাশে &ldquo;Add&rdquo; বাটনে ট্যাপ করে নিশ্চিত করুন
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 flex items-center justify-between text-xs max-w-[260px] mx-auto">
                  <span className="text-slate-500">Cancel</span>
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    {studentAvatarUrl && (
                      <img
                        src={studentAvatarUrl}
                        alt=""
                        className="w-5 h-5 rounded-md object-cover border border-amber-400"
                      />
                    )}
                    <span className="truncate max-w-[110px]">{studentShortName || 'ডি-লিকন'}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-sky-600 text-white font-bold">Add</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            {isInstallable && !isInstalled && onTriggerNativeInstall && (
              <button
                type="button"
                onClick={async () => {
                  await onTriggerNativeInstall();
                }}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>অটো ইনস্টল প্রম্পট খুলুন</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer"
            >
              বুঝেছি, বন্ধ করুন
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
