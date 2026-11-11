import React, { useState } from 'react';
import { Smartphone, Download, CheckCircle2, Share, X, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'badge' | 'full' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'badge',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed and running as standalone app, show subtle active badge or hide
  if (isInstalled) {
    if (variant === 'banner') {
      return (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-900 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>আপনার ডিভাইসে এই অ্যাপটি সফলভাবে ইনস্টল করা রয়েছে (Standalone App Active)।</span>
        </div>
      );
    }
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    if (variant === 'banner') {
      return (
        <div className={`bg-gradient-to-r from-indigo-900 via-blue-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 shadow-md border border-indigo-700/60 flex flex-wrap items-center justify-between gap-3 ${className}`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-400 text-slate-950 rounded-xl shadow-md shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white font-serif">
                অভিভাবকদের স্মার্টফোনে অ্যাপ ইনস্টল করুন
              </h4>
              <p className="text-xs text-indigo-200 mt-0.5">
                এক ক্লিকে আপনার ফোনে অ্যাপ আইকন যুক্ত করুন। লগইন থাকা অবস্থায় সন্তান গেট দিয়ে প্রবেশ করলেই ফোনে সাথে সাথে অডিও এলার্ম বেজে উঠবে।
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={install}
            className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>স্মার্টফোনে অ্যাপ ইনস্টল করুন (Install Now)</span>
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-sm transition cursor-pointer ${className}`}
        title="স্মার্টফোনে অ্যাপ হিসেবে ইনস্টল করুন"
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>অ্যাপ ইনস্টল</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        {variant === 'banner' ? (
          <div className={`bg-gradient-to-r from-indigo-900 to-blue-950 text-white rounded-2xl p-4 shadow-md border border-indigo-700 flex flex-wrap items-center justify-between gap-3 ${className}`}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500 text-white rounded-xl shadow-md shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white font-serif">
                  আইফোন / আইপ্যাডে অ্যাপ ইনস্টল করুন
                </h4>
                <p className="text-xs text-indigo-200 mt-0.5">
                  সাফারি ব্রাউজার থেকে সরাসরি হোম স্ক্রিনে অ্যাপ যুক্ত করুন।
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSGuide(true)}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Share className="w-3.5 h-3.5" />
              <span>আইফোনে ইনস্টল নিয়ম</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowIOSGuide(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-100 hover:bg-indigo-200 text-indigo-950 text-xs font-bold transition cursor-pointer ${className}`}
            title="আইফোনে অ্যাপ ইনস্টল নির্দেশিকা"
          >
            <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
            <span>আইফোনে ইনস্টল</span>
          </button>
        )}

        {showIOSGuide && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl text-slate-800 space-y-4 border border-slate-200">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 font-serif">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  <span>আইফোন / আইপ্যাডে অ্যাপ ইনস্টল</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs leading-relaxed text-slate-600">
                <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    ১
                  </div>
                  <div>
                    সাফারি ব্রাউজারের নিচে <strong>শেয়ার (Share <Share className="w-3.5 h-3.5 inline text-indigo-600" />)</strong> বাটনে ট্যাপ করুন।
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    ২
                  </div>
                  <div>
                    মেনু থেকে একটু নিচে স্ক্রল করে <strong>হোম স্ক্রিনে যোগ করুন (Add to Home Screen <PlusSquare className="w-3.5 h-3.5 inline text-indigo-600" />)</strong> অপশন নির্বাচন করুন।
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                    ৩
                  </div>
                  <div>
                    উপরে ডানপাশে <strong>Add (যোগ করুন)</strong> চাপুন। আপনার ফোনের হোমস্ক্রিনে অ্যাপ আইকন তৈরি হয়ে যাবে!
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                বুঝেছি, বন্ধ করুন
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback banner for other browsers (instructing Chrome / Add to Home screen)
  if (variant === 'banner') {
    return (
      <div className={`bg-gradient-to-r from-indigo-950 via-slate-900 to-blue-950 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800 flex flex-wrap items-center justify-between gap-3 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-400 text-slate-950 rounded-xl shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-white font-serif">
              স্মার্টফোনে অ্যাপ হিসেবে ইনস্টল করুন
            </h4>
            <p className="text-xs text-slate-300 mt-0.5">
              ব্রাউজারের ৩ ডট মেনু (⋮) থেকে &ldquo;Add to Home screen&rdquo; অথবা &ldquo;Install App&rdquo; এ ট্যাপ করুন।
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-amber-300 bg-amber-400/10 border border-amber-400/30 px-3 py-1 rounded-xl font-bold">
            PWA Ready • ইনস্টল যোগ্য
          </span>
        </div>
      </div>
    );
  }

  return null;
};
