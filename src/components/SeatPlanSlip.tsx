import React, { useRef } from 'react';
import { Camera, User } from 'lucide-react';
import { SchoolInfo, Student } from '../types';
import { toBengaliRoll, toBengaliNumber } from '../utils/bengali';

export interface SeatPlanSlipProps {
  student: Student;
  classNameBn: string;
  examName: string;
  schoolInfo: SchoolInfo;
  roomNo?: string;
  seatNo?: string;
  onPhotoUpload?: (studentId: string, base64: string) => void;
  customLogoUrl?: string;
  principalSignatureUrl?: string;
}

export const SeatPlanSlip: React.FC<SeatPlanSlipProps> = ({
  student,
  classNameBn,
  examName,
  schoolInfo,
  roomNo = '১০১',
  seatNo,
  onPhotoUpload,
  customLogoUrl,
  principalSignatureUrl,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeLogo = customLogoUrl || schoolInfo.logoUrl;
  const activePrincipalSig = principalSignatureUrl || schoolInfo.principalSignatureUrl;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onPhotoUpload) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        onPhotoUpload(student.id, base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const calculatedSeatNo = seatNo || `B-${student.roll}`;

  return (
    <div
      className="seat-plan-slip bg-white text-black border-[1.5px] border-black rounded-xs p-1.5 flex flex-col justify-between select-none relative box-border"
      style={{
        fontFamily: "'Kalpurush', 'Hind Siliguri', 'SolaimanLipi', sans-serif",
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '5px 7px',
        border: '1.5px solid #000000',
        borderRadius: '3px',
        backgroundColor: '#ffffff',
      }}
    >
      {/* Top Header Row: Logo (Left) + Center-Aligned Header Texts (Middle) + Photo Box (Top-Right) */}
      <div
        className="seat-plan-header-row flex items-start justify-between pb-1 border-b border-black"
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          boxSizing: 'border-box',
          borderBottom: '1px solid #000000',
          paddingBottom: '3px',
        }}
      >
        {/* Left: School Logo */}
        <div
          className="shrink-0 flex items-center justify-center mr-1"
          style={{ width: '28px', minWidth: '28px', maxWidth: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {activeLogo ? (
            <img
              src={activeLogo}
              alt="Logo"
              className="school-logo-img w-6 h-6 object-contain rounded-full block"
              style={{ width: '26px', height: '26px', objectFit: 'contain', borderRadius: '50%', display: 'block' }}
            />
          ) : (
            <div
              className="w-6 h-6 rounded-full bg-slate-900 text-amber-300 font-bold flex items-center justify-center text-[9px]"
              style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#0f172a', color: '#fde047', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}
            >
              ডি
            </div>
          )}
        </div>

        {/* Center: Middle-Aligned Header Texts */}
        <div
          className="flex-1 min-w-0 text-center px-1 leading-tight flex flex-col items-center justify-center"
          style={{ flex: '1 1 auto', textAlign: 'center', padding: '0 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
        >
          {/* Line 1: School Name */}
          <h3
            className="font-bold text-[11.5px] text-black truncate tracking-tight leading-none"
            style={{ fontWeight: 'bold', fontSize: '11.5px', color: '#000000', margin: 0, lineHeight: 1.1, whiteSpace: 'nowrap' }}
          >
            {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
          </h3>

          {/* Line 2: Directly following is Exam Name */}
          <div
            className="font-bold text-[10px] text-black leading-tight mt-0.5 truncate max-w-full"
            style={{ fontWeight: 'bold', fontSize: '10px', color: '#1e1b4b', marginTop: '2px', lineHeight: 1.1, whiteSpace: 'nowrap' }}
          >
            {examName || '২য় মিডটার্ম (বার্ষিক) পরীক্ষা - ২০২৬ইং'}
          </div>

          {/* Line 3: Seat Plan Badge & Address (Single Line) */}
          <div
            className="flex items-center justify-center gap-1 mt-0.5 max-w-full overflow-hidden"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '2px', whiteSpace: 'nowrap' }}
          >
            <span
              className="inline-block bg-black text-white text-[7px] font-bold px-1.5 py-0.2 rounded-xs tracking-wider shrink-0"
              style={{ backgroundColor: '#000000', color: '#ffffff', fontSize: '7px', fontWeight: 'bold', padding: '1px 5px', borderRadius: '2px', letterSpacing: '0.5px' }}
            >
              আসন বিন্যাস
            </span>
            <span
              className="text-[6.5px] text-slate-700 truncate"
              style={{ fontSize: '6.5px', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}
            >
              {schoolInfo.address || 'দক্ষিণগাঁও, গণি মার্কেট, কাপাসিয়া, গাজীপুর।'}
            </span>
          </div>
        </div>

        {/* Top-Right: Student Passport Photo Box */}
        <div
          className="seat-plan-photo-container shrink-0 flex flex-col items-center justify-center ml-1"
          style={{ width: '44px', minWidth: '44px', maxWidth: '44px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={() => fileInputRef.current?.click()}
            className="student-photo-box group relative cursor-pointer border border-black rounded-xs overflow-hidden bg-slate-50 hover:border-indigo-600 transition"
            style={{
              width: '42px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxSizing: 'border-box',
              border: '1.2px solid #000000',
              borderRadius: '2px',
              backgroundColor: '#f8fafc',
              overflow: 'hidden',
              position: 'relative',
            }}
            title="ছবি পরিবর্তন বা আপলোড করতে ক্লিক করুন"
          >
            {student.avatarUrl ? (
              <img
                src={student.avatarUrl}
                alt={student.nameBn}
                className="student-photo-img w-full h-full object-cover block"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div
                className="flex flex-col items-center justify-center p-0.5 text-slate-400 group-hover:text-indigo-600 transition"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px' }}
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span style={{ fontSize: '6.5px', fontWeight: 'bold', color: '#64748b', marginTop: '1px', lineHeight: 1 }}>ছবি নেই</span>
              </div>
            )}

            {/* Hover Camera Overlay for screen interaction only */}
            <div className="no-print absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white">
              <Camera className="w-3 h-3" />
            </div>
          </div>

          <span
            className="text-[6px] text-slate-600 font-semibold mt-0.5 leading-none whitespace-nowrap"
            style={{ fontSize: '6.5px', whiteSpace: 'nowrap', marginTop: '2px', color: '#475569', fontWeight: 600, lineHeight: 1 }}
          >
            শিক্ষার্থীর ছবি
          </span>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            style={{
              display: 'none',
              visibility: 'hidden',
              position: 'absolute',
              width: 0,
              height: 0,
              opacity: 0,
              pointerEvents: 'none',
            }}
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Middle Section: Full-Width Standard Student Information (NO শাখা) */}
      <div
        className="seat-plan-student-body flex-1 flex flex-col justify-center space-y-1 text-[9.5px] leading-tight my-1 px-0.5"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '3px',
          margin: '3px 0',
          padding: '0 2px',
          flex: '1 1 auto',
        }}
      >
        {/* Row 1: Student Name */}
        <div
          className="flex items-baseline overflow-hidden whitespace-nowrap"
          style={{ display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap', overflow: 'hidden' }}
        >
          <span style={{ fontWeight: 'bold', color: '#000000', fontSize: '9.5px', flexShrink: 0 }}>নাম:</span>
          <span style={{ fontWeight: 'bold', color: '#000000', marginLeft: '6px', fontSize: '11.5px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {student.nameBn}
          </span>
        </div>

        {/* Row 2: Class */}
        <div
          className="flex items-baseline overflow-hidden whitespace-nowrap text-[9px]"
          style={{ display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap', overflow: 'hidden' }}
        >
          <span style={{ fontWeight: 'bold', color: '#000000', fontSize: '9px', flexShrink: 0 }}>শ্রেণি:</span>
          <span style={{ fontWeight: '600', color: '#000000', marginLeft: '6px', fontSize: '9.5px' }}>
            {classNameBn}
          </span>
        </div>

        {/* Row 3: Roll No (Highlighted) & ID (Side-by-Side) */}
        <div
          className="flex items-center justify-between pt-0.5"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: '1px' }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 'bold', color: '#000000', fontSize: '9.5px' }}>রোল নং:</span>
            <span
              className="student-roll-badge"
              style={{
                fontWeight: 900,
                color: '#000000',
                fontSize: '13px',
                marginLeft: '6px',
                backgroundColor: '#fef08a',
                padding: '1px 6px',
                borderRadius: '2px',
                border: '1px solid #facc15',
                lineHeight: 1,
                display: 'inline-block',
                fontFamily: "'Kalpurush', 'Hind Siliguri', sans-serif",
              }}
            >
              {toBengaliRoll(student.roll)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', fontSize: '8.5px', color: '#334155' }}>
            <span style={{ fontWeight: 'bold' }}>আইডি:</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 600, marginLeft: '3px', color: '#000000' }}>
              {student.id.replace('std_', '').slice(0, 6)}
            </span>
          </div>
        </div>

        {/* Row 4: Room No & Seat / Bench No (Highlighted Box) */}
        <div
          className="room-seat-box"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '3px',
            padding: '2px 6px',
            marginTop: '2px',
            fontSize: '8.5px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 'bold', color: '#334155' }}>কক্ষ নং:</span>
            <span style={{ fontWeight: 'bold', color: '#000000', marginLeft: '4px' }}>
              {roomNo}
            </span>
          </div>
          <div style={{ height: '10px', width: '1px', backgroundColor: '#cbd5e1', margin: '0 4px' }} />
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 'bold', color: '#334155' }}>আসন নং:</span>
            <span style={{ fontWeight: 'bold', color: '#312e81', marginLeft: '4px' }}>
              {calculatedSeatNo}
            </span>
          </div>
        </div>
      </div>

      {/* Footer: Year & Principal Signature (Always fully preserved) */}
      <div
        className="seat-plan-footer-row flex items-end justify-between text-[8px] leading-tight px-0.5 pt-1 border-t border-black"
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          width: '100%',
          borderTop: '1px solid #000000',
          paddingTop: '3px',
          marginTop: '2px',
          fontSize: '8px',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ color: '#334155' }}>
          <span>শিক্ষাবর্ষ: <strong style={{ color: '#000000' }}>{student.academicYear || '২০২৬'}</strong></span>
        </div>

        {/* Principal Signature */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '85px' }}>
          <div style={{ height: '14px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '2px', width: '100%' }}>
            {activePrincipalSig ? (
              <img
                src={activePrincipalSig}
                alt="অধ্যক্ষের স্বাক্ষর"
                className="principal-sig-img"
                style={{ maxHeight: '14px', maxWidth: '55px', objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <div style={{ width: '55px', borderBottom: '1px dashed #000000', marginBottom: '2px' }} />
            )}
          </div>
          <span style={{ fontWeight: 'bold', color: '#000000', fontSize: '7.5px', lineHeight: 1, whiteSpace: 'nowrap' }}>
            অধ্যক্ষ / পরীক্ষা নিয়ন্ত্রক
          </span>
        </div>
      </div>
    </div>
  );
};
