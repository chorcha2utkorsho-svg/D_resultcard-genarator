import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { SchoolInfo, Student } from '../types';
import { toBengaliRoll, toBengaliNumber } from '../utils/bengali';
import { SchoolLogo } from './SchoolLogo';
import { User, ShieldCheck, Phone, Heart, Camera, CheckCircle2 } from 'lucide-react';

export interface StudentIDCardSlipProps {
  student: Student;
  classNameBn: string;
  schoolInfo: SchoolInfo;
  side?: 'front' | 'back';
  orientation?: 'portrait' | 'landscape';
  customLogoUrl?: string;
  principalSignatureUrl?: string;
  academicYear?: string;
  onPhotoUpload?: (studentId: string, role: 'student' | 'father' | 'mother', base64: string) => void;
}

export const StudentIDCardSlip: React.FC<StudentIDCardSlipProps> = ({
  student,
  classNameBn,
  schoolInfo,
  side = 'front',
  orientation = 'portrait',
  customLogoUrl,
  principalSignatureUrl,
  academicYear = '২০২৬',
  onPhotoUpload,
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const studentFileRef = useRef<HTMLInputElement>(null);
  const fatherFileRef = useRef<HTMLInputElement>(null);
  const motherFileRef = useRef<HTMLInputElement>(null);

  const activeLogo = customLogoUrl || schoolInfo.logoUrl;
  const activePrincipalSig = principalSignatureUrl || schoolInfo.principalSignatureUrl;
  const qrPayload =
    student.securityQrCode ||
    `DLIKON-SEC-${(student.classId || 'CLS').toUpperCase()}-${student.roll}-${student.id.slice(-4).toUpperCase()}`;

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(qrPayload, {
      width: 180,
      margin: 1,
      color: {
        dark: '#091e42',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (isMounted) setQrCodeDataUrl(url);
      })
      .catch((err) => console.warn('QR code generation failed', err));

    return () => {
      isMounted = false;
    };
  }, [qrPayload]);

  const handleFileChange = (
    role: 'student' | 'father' | 'mother',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !onPhotoUpload) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        onPhotoUpload(student.id, role, base64);
      }
    };
    reader.readAsDataURL(file);
    // Reset input value to allow re-uploading same file if desired
    e.target.value = '';
  };

  // =========================================================================
  // 1. PORTRAIT ORIENTATION (ভার্টিক্যাল - ৫৪ মিমি × ৮৫.৬ মিমি) - STANDARD CR80
  // =========================================================================
  if (orientation === 'portrait') {
    // -----------------------------------------------------------------------
    // PORTRAIT - BACK SIDE (ওপিঠ)
    // -----------------------------------------------------------------------
    if (side === 'back') {
      return (
        <div
          className="student-id-card id-card-portrait bg-white text-slate-900 border-2 border-[#091e42] rounded-xl flex flex-col justify-between select-none relative box-border overflow-hidden shadow-md print:shadow-none print:border-black"
          style={{
            fontFamily: "'Kalpurush', 'Hind Siliguri', sans-serif",
            width: '230px',
            maxWidth: '230px',
            height: '365px',
            maxHeight: '365px',
            boxSizing: 'border-box',
            backgroundColor: '#ffffff',
            position: 'relative',
          }}
        >
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #091e42 0%, #0f2b61 100%)',
              color: '#ffffff',
              padding: '6px 8px 5px',
              textAlign: 'center',
              borderBottom: '2px solid #d97706',
            }}
          >
            <div className="flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-bold text-white tracking-wide">
                অভিভাবক ও নিরাপত্তা তথ্য
              </span>
            </div>
            <div className="text-[7.5px] text-amber-300 font-bold uppercase tracking-wider">
              {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
            </div>
          </div>

          {/* Father Details */}
          <div className="px-2.5 py-1.5 space-y-2 flex-1">
            {/* Father Section */}
            <div className="border border-slate-300 rounded-lg p-1.5 bg-slate-50/90 space-y-1">
              <div className="flex items-center justify-between pb-0.5 border-b border-slate-200">
                <span className="text-[8px] font-bold text-indigo-950 uppercase">
                  পিতার পরিচিতি (Father)
                </span>
                <span className="text-[7px] text-slate-500 font-mono">
                  {student.fatherNid ? 'NID Verified' : ''}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div
                  onClick={() => onPhotoUpload && fatherFileRef.current?.click()}
                  title="পিতার ছবি আপলোড করতে ক্লিক করুন"
                  className="w-9 h-11 rounded border border-indigo-900 bg-white overflow-hidden shrink-0 flex items-center justify-center relative cursor-pointer shadow-2xs group"
                >
                  {student.fatherAvatarUrl ? (
                    <img src={student.fatherAvatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-slate-400">
                      <User className="w-5 h-5 mx-auto text-slate-300" />
                      <span className="text-[6.5px] font-bold block text-slate-500">ছবি নেই</span>
                    </div>
                  )}
                  {onPhotoUpload && (
                    <div className="no-print absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[7px] font-bold transition">
                      আপলোড
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 text-[8px] leading-tight space-y-0.5">
                  <div className="font-bold text-indigo-950 text-[9px] truncate">
                    {student.fatherNameBn || student.fatherName || 'পিতার নাম নেই'}
                  </div>
                  <div className="text-slate-500 font-sans text-[7.5px] truncate">
                    {student.fatherNameEn || 'Father'}
                  </div>
                  <div className="text-slate-700">
                    <span className="text-slate-500 font-semibold">NID:</span>{' '}
                    <span className="font-mono font-bold">{student.fatherNid || '-'}</span>
                  </div>
                  <div className="text-slate-700">
                    <span className="text-slate-500 font-semibold">মোবাইল:</span>{' '}
                    <span className="font-mono">{student.fatherPhone || student.guardianPhone || '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Mother Section */}
            <div className="border border-slate-300 rounded-lg p-1.5 bg-slate-50/90 space-y-1">
              <div className="flex items-center justify-between pb-0.5 border-b border-slate-200">
                <span className="text-[8px] font-bold text-rose-950 uppercase">
                  মাতার পরিচিতি (Mother)
                </span>
                <span className="text-[7px] text-slate-500 font-mono">
                  {student.motherNid ? 'NID Verified' : ''}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <div
                  onClick={() => onPhotoUpload && motherFileRef.current?.click()}
                  title="মাতার ছবি আপলোড করতে ক্লিক করুন"
                  className="w-9 h-11 rounded border border-rose-900 bg-white overflow-hidden shrink-0 flex items-center justify-center relative cursor-pointer shadow-2xs group"
                >
                  {student.motherAvatarUrl ? (
                    <img src={student.motherAvatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-slate-400">
                      <Heart className="w-5 h-5 mx-auto text-rose-300" />
                      <span className="text-[6.5px] font-bold block text-slate-500">ছবি নেই</span>
                    </div>
                  )}
                  {onPhotoUpload && (
                    <div className="no-print absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[7px] font-bold transition">
                      আপলোড
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 text-[8px] leading-tight space-y-0.5">
                  <div className="font-bold text-rose-950 text-[9px] truncate">
                    {student.motherNameBn || student.motherName || 'মাতার নাম নেই'}
                  </div>
                  <div className="text-slate-500 font-sans text-[7.5px] truncate">
                    {student.motherNameEn || 'Mother'}
                  </div>
                  <div className="text-slate-700">
                    <span className="text-slate-500 font-semibold">NID:</span>{' '}
                    <span className="font-mono font-bold">{student.motherNid || '-'}</span>
                  </div>
                  <div className="text-slate-700">
                    <span className="text-slate-500 font-semibold">মোবাইল:</span>{' '}
                    <span className="font-mono">{student.motherPhone || '-'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Address & Emergency Helpline */}
            <div className="border border-slate-200 rounded-lg p-1.5 bg-slate-100/80 text-[7.5px] space-y-1">
              <div>
                <span className="font-bold text-slate-800">ঠিকানা:</span>{' '}
                <span className="text-slate-600">
                  {student.presentAddress || 'দক্ষিণগাঁও, সনমানিয়া, কাপাসিয়া, গাজীপুর।'}
                </span>
              </div>
              <div className="flex items-center justify-between font-bold text-indigo-950 pt-0.5 border-t border-slate-200">
                <span className="flex items-center gap-1">
                  <Phone className="w-2.5 h-2.5 text-indigo-600" />
                  <span>জরুরি: {toBengaliNumber(student.guardianPhone || student.fatherPhone || schoolInfo.phone || '')}</span>
                </span>
                <span className="text-emerald-700">সক্রিয় গেটপাস</span>
              </div>
            </div>
          </div>

          {/* Bottom Security Bar */}
          <div
            style={{
              backgroundColor: '#091e42',
              color: '#ffffff',
              padding: '3px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '7px',
            }}
          >
            <span className="text-slate-300 truncate max-w-[140px]">
              কার্ডটি পাওয়া গেলে বিদ্যালয়ে জমা দিন
            </span>
            <span className="font-mono font-bold text-amber-300">
              ID: {student.id.slice(-6).toUpperCase()}
            </span>
          </div>

          {/* Hidden inputs for uploading parent photos */}
          {onPhotoUpload && (
            <>
              <input
                ref={fatherFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange('father', e)}
              />
              <input
                ref={motherFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange('mother', e)}
              />
            </>
          )}
        </div>
      );
    }

    // -----------------------------------------------------------------------
    // PORTRAIT - FRONT SIDE (এপিঠ) - STUDENT CONFIDENT PHOTO & SMART QR
    // -----------------------------------------------------------------------
    return (
      <div
        className="student-id-card id-card-portrait bg-white text-slate-900 border-2 border-[#091e42] rounded-xl flex flex-col justify-between select-none relative box-border overflow-hidden shadow-md print:shadow-none print:border-black"
        style={{
          fontFamily: "'Kalpurush', 'Hind Siliguri', sans-serif",
          width: '230px',
          maxWidth: '230px',
          height: '365px',
          maxHeight: '365px',
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          position: 'relative',
        }}
      >
        {/* Header Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #091e42 0%, #0f2b61 60%, #091e42 100%)',
            color: '#ffffff',
            padding: '6px 8px 5px',
            borderBottom: '2.5px solid #d97706',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          <div className="flex items-center justify-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white border border-amber-400 p-0.5 flex items-center justify-center shrink-0 shadow-sm">
              {activeLogo ? (
                <img src={activeLogo} alt="" className="w-full h-full object-contain" />
              ) : (
                <SchoolLogo size={24} />
              )}
            </div>
            <div className="text-left flex-1 min-w-0">
              <h2 className="text-[11px] font-black text-white truncate tracking-wide font-serif leading-tight">
                {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
              </h2>
              <div className="text-[7.5px] font-bold text-amber-300 font-sans tracking-wider uppercase truncate">
                D-Likon Model Academy
              </div>
            </div>
            <span className="bg-amber-400 text-slate-950 font-black text-[7px] px-1 py-0.2 rounded uppercase tracking-wider shrink-0">
              ID
            </span>
          </div>
          <div className="text-[6.5px] text-slate-300 truncate mt-0.5">
            {schoolInfo.address || 'দক্ষিণগাঁও, সনমানিয়া, কাপাসিয়া, গাজীপুর।'}
          </div>
        </div>

        {/* Body Section: Photo, Identity Details, QR Code */}
        <div className="p-2 flex-1 flex flex-col items-center justify-between space-y-1">
          {/* Centered Confident Student Portrait Photo */}
          <div className="flex flex-col items-center">
            <div
              onClick={() => onPhotoUpload && studentFileRef.current?.click()}
              title="শিক্ষার্থীর ছবি পরিবর্তন করতে ক্লিক করুন"
              className="w-[74px] h-[92px] rounded-lg border-2 border-[#091e42] bg-slate-100 flex items-center justify-center overflow-hidden relative shadow-sm cursor-pointer group"
            >
              {student.avatarUrl ? (
                <img
                  src={student.avatarUrl}
                  alt={student.nameBn}
                  className="w-full h-full object-cover block"
                />
              ) : (
                <div className="text-center p-1 text-slate-400 flex flex-col items-center justify-center">
                  <User className="w-8 h-8 text-slate-400" />
                  <span className="text-[7.5px] font-bold text-slate-600 block mt-0.5">ছবি নেই</span>
                  <span className="text-[6.5px] text-indigo-700 underline font-bold mt-0.2">আপলোড</span>
                </div>
              )}

              {onPhotoUpload && (
                <div className="no-print absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition duration-150">
                  <Camera className="w-4 h-4 text-amber-300" />
                  <span className="text-[7px] font-bold mt-0.5">ছবি পরিবর্তন</span>
                </div>
              )}
            </div>

            {/* Quick Upload Button directly below photo */}
            {onPhotoUpload && (
              <button
                type="button"
                onClick={() => studentFileRef.current?.click()}
                className="no-print mt-1 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[8px] font-bold flex items-center gap-1 shadow-2xs transition cursor-pointer"
                title="ছবি আপলোড করতে ক্লিক করুন"
              >
                <Camera className="w-2.5 h-2.5" />
                <span>{student.avatarUrl ? 'ছবি পরিবর্তন' : 'ছবি নির্বাচন'}</span>
              </button>
            )}
          </div>

          {/* Student Name */}
          <div className="text-center w-full px-1">
            <h3 className="font-extrabold text-[#091e42] text-[12px] truncate leading-tight font-serif">
              {student.nameBn}
            </h3>
            <div className="text-slate-500 text-[8px] font-sans font-medium truncate">
              {student.nameEn || 'Student'}
            </div>
          </div>

          {/* Academic Dossier Badges Grid */}
          <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 space-y-1 text-[8px]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-slate-500 font-semibold">শ্রেণি:</span>{' '}
                <strong className="text-slate-900">{classNameBn}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-semibold">শাখা:</span>{' '}
                <strong className="text-slate-900">{student.section || 'ক'}</strong>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-slate-500 font-semibold">রোল:</span>
                <span className="bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded font-bold text-slate-950 font-mono text-[8.5px]">
                  {toBengaliRoll(student.roll)}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-slate-500 font-semibold">গ্রুপ:</span>
                <span className="bg-rose-50 border border-rose-300 px-1 py-0.2 rounded font-bold text-rose-700 text-[8px]">
                  {student.bloodGroup || 'A+'}
                </span>
              </div>
            </div>

            <div className="text-[7.5px] text-slate-700 truncate pt-0.5 border-t border-slate-200">
              <span className="text-slate-500 font-semibold">নিবন্ধন:</span>{' '}
              <span className="font-mono font-bold text-indigo-900">
                {student.birthRegNo || '১৭ ডিজিট অপেক্ষমাণ'}
              </span>
            </div>
          </div>

          {/* Scannable Real QR Code & Seal */}
          <div className="flex items-center justify-between w-full px-2 pt-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-[44px] h-[44px] bg-white p-0.5 rounded border border-indigo-900 flex items-center justify-center shadow-2xs">
                {qrCodeDataUrl ? (
                  <img src={qrCodeDataUrl} alt="QR Code" className="w-full h-full object-contain" />
                ) : (
                  <div className="text-[6px] text-slate-400">QR</div>
                )}
              </div>
              <div className="text-left text-[7px] text-slate-500 leading-tight">
                <div className="font-bold text-indigo-950 font-mono">
                  {student.securityQrCode ? student.securityQrCode.slice(0, 8) : `ID:${student.roll}`}
                </div>
                <div>ডিজিটাল গেটপাস</div>
              </div>
            </div>

            {/* Principal Signature */}
            <div className="flex flex-col items-center">
              <div className="h-4 flex items-center">
                {activePrincipalSig ? (
                  <img src={activePrincipalSig} alt="Signature" className="max-h-3.5 max-w-[48px] object-contain" />
                ) : (
                  <div className="w-11 border-b border-dotted border-slate-700" />
                )}
              </div>
              <span className="text-[6.5px] font-bold text-[#091e42]">
                প্রধান শিক্ষক
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Motto Strip */}
        <div
          style={{
            borderTop: '1px solid #cbd5e1',
            padding: '2.5px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
            fontSize: '7px',
            color: '#475569',
            fontWeight: 'bold',
          }}
        >
          <span>শিক্ষা • মূল্যবোধ • সাফল্য</span>
          <span className="text-indigo-900 font-sans">মেয়াদ: {academicYear}</span>
        </div>

        {/* Hidden input for uploading student photo */}
        {onPhotoUpload && (
          <input
            ref={studentFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFileChange('student', e)}
          />
        )}
      </div>
    );
  }

  // =========================================================================
  // 2. LANDSCAPE ORIENTATION (আড়াআড়ি - ৮৫.৬ মিমি × ৫৪ মিমি)
  // =========================================================================
  if (side === 'back') {
    return (
      <div
        className="student-id-card id-card-landscape bg-white text-slate-900 border-2 border-[#091e42] rounded-xl flex flex-col justify-between select-none relative box-border overflow-hidden shadow-md print:shadow-none print:border-black"
        style={{
          fontFamily: "'Kalpurush', 'Hind Siliguri', sans-serif",
          width: '320px',
          maxWidth: '320px',
          height: '205px',
          maxHeight: '205px',
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          position: 'relative',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #091e42 0%, #0f2b61 100%)',
            color: '#ffffff',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '2px solid #d97706',
          }}
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#ffffff' }}>
              পিতা-মাতার ছবিসহ পরিচয় ও নিরাপত্তা তথ্য
            </span>
          </div>
          <span style={{ fontSize: '8px', color: '#fde047', fontWeight: 'bold' }}>
            {schoolInfo.name || 'ডি-লিকন একাডেমি'}
          </span>
        </div>

        <div className="p-2 grid grid-cols-2 gap-2 flex-1">
          {/* Father */}
          <div className="border border-slate-300 rounded-lg p-1.5 bg-slate-50/80 flex items-start gap-1.5">
            <div
              onClick={() => onPhotoUpload && fatherFileRef.current?.click()}
              className="w-10 h-13 rounded border border-indigo-900 bg-white overflow-hidden shrink-0 flex items-center justify-center relative cursor-pointer shadow-2xs"
            >
              {student.fatherAvatarUrl ? (
                <img src={student.fatherAvatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-slate-400 p-0.5">
                  <User className="w-4 h-4 mx-auto text-slate-300" />
                  <span className="text-[6.5px] font-bold block text-slate-500">পিতার ছবি</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 text-[8px] leading-tight space-y-0.5">
              <div className="font-bold text-indigo-950 text-[8.5px] truncate">
                {student.fatherNameBn || student.fatherName || 'পিতার নাম নেই'}
              </div>
              <div className="text-slate-700">
                <span className="text-slate-500 font-semibold">NID:</span>{' '}
                <span className="font-mono">{student.fatherNid || '-'}</span>
              </div>
              <div className="text-slate-700">
                <span className="text-slate-500 font-semibold">মোবাইল:</span>{' '}
                <span className="font-mono">{student.fatherPhone || student.guardianPhone || '-'}</span>
              </div>
            </div>
          </div>

          {/* Mother */}
          <div className="border border-slate-300 rounded-lg p-1.5 bg-slate-50/80 flex items-start gap-1.5">
            <div
              onClick={() => onPhotoUpload && motherFileRef.current?.click()}
              className="w-10 h-13 rounded border border-rose-900 bg-white overflow-hidden shrink-0 flex items-center justify-center relative cursor-pointer shadow-2xs"
            >
              {student.motherAvatarUrl ? (
                <img src={student.motherAvatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-slate-400 p-0.5">
                  <Heart className="w-4 h-4 mx-auto text-rose-300" />
                  <span className="text-[6.5px] font-bold block text-slate-500">মাতার ছবি</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 text-[8px] leading-tight space-y-0.5">
              <div className="font-bold text-rose-950 text-[8.5px] truncate">
                {student.motherNameBn || student.motherName || 'মাতার নাম নেই'}
              </div>
              <div className="text-slate-700">
                <span className="text-slate-500 font-semibold">NID:</span>{' '}
                <span className="font-mono">{student.motherNid || '-'}</span>
              </div>
              <div className="text-slate-700">
                <span className="text-slate-500 font-semibold">মোবাইল:</span>{' '}
                <span className="font-mono">{student.motherPhone || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-2 pb-1 text-[7.5px] text-slate-700 flex items-center justify-between bg-slate-100 border-t border-slate-200">
          <span className="truncate max-w-[200px]">ঠিকানা: {student.presentAddress || 'কাপাসিয়া, গাজীপুর।'}</span>
          <span className="font-bold font-mono">Helpline: {schoolInfo.phone || '01313-159459'}</span>
        </div>

        {/* Hidden inputs */}
        {onPhotoUpload && (
          <>
            <input
              ref={fatherFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange('father', e)}
            />
            <input
              ref={motherFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange('mother', e)}
            />
          </>
        )}
      </div>
    );
  }

  // LANDSCAPE - FRONT SIDE
  return (
    <div
      className="student-id-card id-card-landscape bg-white text-slate-900 border-2 border-[#091e42] rounded-xl flex flex-col justify-between select-none relative box-border overflow-hidden shadow-md print:shadow-none print:border-black"
      style={{
        fontFamily: "'Kalpurush', 'Hind Siliguri', sans-serif",
        width: '320px',
        maxWidth: '320px',
        height: '205px',
        maxHeight: '205px',
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        position: 'relative',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #091e42 0%, #0d2866 50%, #091e42 100%)',
          color: '#ffffff',
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          borderBottom: '2px solid #d97706',
        }}
      >
        <div className="w-7 h-7 rounded-full bg-white p-0.5 flex items-center justify-center shrink-0">
          {activeLogo ? (
            <img src={activeLogo} alt="" className="w-full h-full object-contain" />
          ) : (
            <SchoolLogo size={24} />
          )}
        </div>
        <div className="flex-1 min-w-0 leading-tight">
          <h2 className="text-[11px] font-black text-white truncate font-serif">
            {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
          </h2>
          <div className="text-[7.5px] font-bold text-amber-300 font-sans truncate">
            D-Likon Model Academy
          </div>
        </div>
        <span className="bg-amber-400 text-slate-950 font-black text-[7px] px-1 py-0.2 rounded uppercase">
          ID CARD
        </span>
      </div>

      <div className="p-2 flex items-center gap-2 flex-1">
        <div className="flex flex-col items-center shrink-0">
          <div
            onClick={() => onPhotoUpload && studentFileRef.current?.click()}
            className="w-[58px] h-[72px] rounded border-2 border-[#091e42] bg-slate-50 flex items-center justify-center overflow-hidden relative shadow-xs cursor-pointer"
          >
            {student.avatarUrl ? (
              <img src={student.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center p-1 text-slate-400">
                <User className="w-6 h-6 mx-auto" />
                <span className="text-[7px] font-bold block text-slate-500">ছবি নেই</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => studentFileRef.current?.click()}
            className="no-print mt-0.5 text-[7px] text-indigo-700 underline font-bold"
          >
            ছবি আপলোড
          </button>
        </div>

        <div className="flex-1 min-w-0 space-y-0.5 text-[8.5px]">
          <div className="font-extrabold text-[#091e42] text-[11px] truncate">
            {student.nameBn}
          </div>
          <div className="grid grid-cols-2 gap-1 text-[8px]">
            <div>শ্রেণি: <strong>{classNameBn}</strong></div>
            <div>শাখা: <strong>{student.section || 'ক'}</strong></div>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[8px]">
            <div>রোল: <strong className="font-mono bg-amber-100 px-1 rounded">{toBengaliRoll(student.roll)}</strong></div>
            <div>গ্রুপ: <strong className="text-rose-700">{student.bloodGroup || 'A+'}</strong></div>
          </div>
          <div className="text-[7.5px] text-slate-700 truncate">
            নিবন্ধন: <span className="font-mono font-bold text-indigo-900">{student.birthRegNo || '-'}</span>
          </div>
        </div>

        <div className="flex flex-col items-center shrink-0">
          <div className="w-[48px] h-[48px] bg-white p-0.5 rounded border border-indigo-900 flex items-center justify-center">
            {qrCodeDataUrl ? (
              <img src={qrCodeDataUrl} alt="QR" className="w-full h-full object-contain" />
            ) : (
              <div className="text-[6px]">QR</div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 px-2 py-0.5 bg-slate-50 text-[7px] flex items-center justify-between text-slate-600 font-bold">
        <span>শিক্ষা • মূল্যবোধ • সাফল্য</span>
        <span>মেয়াদ: {academicYear}</span>
      </div>

      {onPhotoUpload && (
        <input
          ref={studentFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileChange('student', e)}
        />
      )}
    </div>
  );
};
