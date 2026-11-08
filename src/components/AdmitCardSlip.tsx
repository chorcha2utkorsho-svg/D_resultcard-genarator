import React, { useRef } from 'react';
import { SchoolInfo, Student } from '../types';
import { toBengaliRoll, toBengaliNumber } from '../utils/bengali';
import { SchoolLogo } from './SchoolLogo';
import { Camera, User, ShieldCheck, Award, CheckCircle2 } from 'lucide-react';

export interface AdmitCardSlipProps {
  student: Student;
  classNameBn: string;
  examName: string;
  schoolInfo: SchoolInfo;
  side?: 'front' | 'back';
  customLogoUrl?: string;
  principalSignatureUrl?: string;
  classTeacherSignatureUrl?: string;
  examMotto?: string;
  roomNo?: string;
  onPhotoUpload?: (studentId: string, base64: string) => void;
}

export const AdmitCardSlip: React.FC<AdmitCardSlipProps> = ({
  student,
  classNameBn,
  examName,
  schoolInfo,
  side = 'front',
  customLogoUrl,
  principalSignatureUrl,
  classTeacherSignatureUrl,
  examMotto = 'শিক্ষা • মূল্যবোধ • সাফল্য',
  roomNo = '১০১',
  onPhotoUpload,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeLogo = customLogoUrl || schoolInfo.logoUrl;
  const activePrincipalSig = principalSignatureUrl || schoolInfo.principalSignatureUrl;
  const studentSeat = `B-${student.roll}`;
  const studentIdDisplay = student.id.replace('std_', '').slice(0, 6);

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

  // 8 Standard Examination Rules (Formal, Academic Bengali)
  const instructions = [
    'পরীক্ষা শুরু হওয়ার অন্তত ১৫ মিনিট পূর্বে পরীক্ষার্থীকে নিজ নিজ নির্ধারিত আসনে উপস্থিত হতে হবে।',
    'এই প্রবেশপত্র (Admit Card) ব্যতিত কোনো শিক্ষার্থীকে পরীক্ষা কক্ষে প্রবেশ করতে দেওয়া হবে না।',
    'পরীক্ষার হলে প্রয়োজনীয় কলম, পেন্সিল, স্কেল, ইরেজার ও জ্যামিতি বক্স ব্যতীত কোনো বই বা অননুমোদিত কাগজ আনা সম্পূর্ণ নিষিদ্ধ।',
    'উত্তরপত্রের কভার পৃষ্ঠায় রোল নম্বর, শ্রেণি ও অন্যান্য তথ্য নির্ভুলভাবে লিখতে হবে। কোনো কাটাকাটি করা যাবে না।',
    'পরীক্ষা চলাকালীন যেকোনো প্রকার অসদুপায় অবলম্বন, শৃঙ্খলা ভঙ্গ বা অপরের সাথে কথা বলা কঠোরভাবে নিষিদ্ধ।',
    'পরীক্ষা শেষ না হওয়া পর্যন্ত পরিদর্শকের অনুমতি ছাড়া কোনো অবস্থাতেই পরীক্ষা কক্ষ ত্যাগ করা যাবে না।',
    'ঘণ্টা পড়ার সাথে সাথে লেখা বন্ধ করে উত্তরপত্র পরিদর্শকের নিকট জমা দিয়ে সুশৃঙ্খলভাবে কক্ষ ত্যাগ করতে হবে।',
    'প্রবেশপত্রটি যত্নসহকারে সংরক্ষণ করতে হবে; হারিয়ে গেলে অবিলম্বে কর্তৃপক্ষকে অবহিত করতে হবে।',
  ];

  // ==========================================
  // BACK SIDE (ওপিঠ) - WORLD CLASS ACADEMIC RULES
  // ==========================================
  if (side === 'back') {
    return (
      <div
        className="admit-card-slip admit-card-back bg-white text-black border-2 border-[#091e42] rounded-md flex flex-col justify-between select-none relative box-border overflow-hidden"
        style={{
          fontFamily: "'Kalpurush', 'Hind Siliguri', 'SolaimanLipi', sans-serif",
          height: '100%',
          width: '100%',
          maxHeight: '135mm',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '2px solid #091e42',
          borderRadius: '6px',
          backgroundColor: '#ffffff',
          position: 'relative',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #091e42 0%, #0f2b61 100%)',
            color: '#ffffff',
            padding: '7px 10px 6px 10px',
            textAlign: 'center',
            borderBottom: '2.5px solid #d97706',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffffff', letterSpacing: '0.3px' }}>
              {schoolInfo.name || 'ডি-লিকন মডেল একাডেমি'}
            </span>
          </div>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 'bold',
              color: '#fbbf24',
              marginTop: '1px',
              letterSpacing: '0.5px',
            }}
          >
            পরীক্ষার্থীদের জন্য সাধারণ নির্দেশনাবলী (General Examination Rules)
          </div>
        </div>

        {/* Student Quick Reference Bar */}
        <div
          style={{
            backgroundColor: '#f1f5f9',
            borderBottom: '1px solid #cbd5e1',
            padding: '3px 10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '9px',
            color: '#334155',
          }}
        >
          <span>
            শিক্ষার্থী: <strong style={{ color: '#091e42', fontSize: '9.5px' }}>{student.nameBn}</strong>
          </span>
          <span>
            শ্রেণি: <strong style={{ color: '#091e42' }}>{classNameBn}</strong> | রোল:{' '}
            <strong style={{ color: '#091e42' }}>{toBengaliRoll(student.roll)}</strong> | আইডি:{' '}
            <strong style={{ fontFamily: 'monospace', color: '#091e42' }}>{studentIdDisplay}</strong>
          </span>
        </div>

        {/* 8 Numbered Examination Rules */}
        <div
          style={{
            padding: '6px 12px',
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-around',
            gap: '2px',
          }}
        >
          {instructions.map((text, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                fontSize: '8.5px',
                lineHeight: '1.25',
                color: '#1e293b',
              }}
            >
              <span
                style={{
                  minWidth: '16px',
                  fontWeight: 'bold',
                  color: '#091e42',
                  flexShrink: 0,
                }}
              >
                {(idx + 1).toLocaleString('bn-BD')}।
              </span>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* Emergency Notice & Authority */}
        <div
          style={{
            borderTop: '1px dashed #94a3b8',
            padding: '4px 10px 3px 10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '7.5px',
            color: '#475569',
            backgroundColor: '#f8fafc',
          }}
        >
          <div>
            <span>হটলাইন: <strong>{schoolInfo.phone || '01700-000000'}</strong></span>
          </div>
          <div style={{ fontWeight: 'bold', color: '#091e42' }}>
            পরীক্ষা নিয়ন্ত্রণ কমিটি • {schoolInfo.name || 'ডি-লিকন মডেল একাডেমি'}
          </div>
        </div>

        {/* Bottom Banner */}
        <div
          style={{
            backgroundColor: '#091e42',
            color: '#ffffff',
            padding: '3px 6px',
            textAlign: 'center',
            fontSize: '7.5px',
            fontWeight: '600',
            letterSpacing: '0.3px',
          }}
        >
          সততা ও সুশৃঙ্খলতা সাফল্যের মূল সোপান • Discipline & Honesty is the Key to Success
        </div>
      </div>
    );
  }

  // ==========================================
  // FRONT SIDE (এপিঠ) - PRESTIGIOUS MASTERPIECE DESIGN
  // ==========================================
  return (
    <div
      className="admit-card-slip admit-card-front bg-white text-black border-2 border-[#091e42] rounded-md flex flex-col justify-between select-none relative box-border overflow-hidden"
      style={{
        fontFamily: "'Kalpurush', 'Hind Siliguri', 'SolaimanLipi', sans-serif",
        height: '100%',
        width: '100%',
        maxHeight: '135mm',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        border: '2px solid #091e42',
        borderRadius: '6px',
        backgroundColor: '#ffffff',
        position: 'relative',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      }}
    >
      {/* Delicate Inner Golden Framing Border */}
      <div
        style={{
          position: 'absolute',
          inset: '2px',
          border: '1px solid #d97706',
          borderRadius: '4px',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* 1. TOP HEADER SECTION: Royal Deep Navy Gradient + Gold Accents */}
      <div
        style={{
          background: 'linear-gradient(135deg, #091e42 0%, #0d2866 50%, #091e42 100%)',
          color: '#ffffff',
          padding: '7px 10px 8px 10px',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          borderBottom: '2.5px solid #d97706',
          zIndex: 3,
        }}
      >
        {/* Left: School Crest Logo with Gold Ring Frame */}
        <div
          style={{
            width: '46px',
            minWidth: '46px',
            height: '46px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginRight: '10px',
            position: 'relative',
          }}
        >
          {activeLogo ? (
            <img
              src={activeLogo}
              alt="Logo"
              style={{
                width: '44px',
                height: '44px',
                objectFit: 'contain',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                border: '2px solid #f59e0b',
                padding: '1.5px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
              }}
            />
          ) : (
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                border: '2px solid #f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
              }}
            >
              <SchoolLogo size={40} />
            </div>
          )}
        </div>

        {/* Center/Right: School Bengali Name, English Serif Name, Address & Motto */}
        <div
          style={{
            flex: '1 1 auto',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* Line 1: School Name in Bengali */}
          <h2
            style={{
              margin: 0,
              fontSize: '14.5px',
              fontWeight: 900,
              color: '#ffffff',
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              letterSpacing: '0.3px',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
            }}
          >
            {schoolInfo.name || 'ডি-লিকন মডেল একাডেমি'}
          </h2>

          {/* Line 2: English Name in Gold Serif */}
          <div
            style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#fbbf24',
              fontFamily: "'Times New Roman', Times, serif, system-ui",
              letterSpacing: '0.6px',
              marginTop: '1px',
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textTransform: 'uppercase',
            }}
          >
            D-Likon Model Academy
          </div>

          {/* Line 3: Address & Motto */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '2px',
              fontSize: '7.5px',
              color: '#e2e8f0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            <span style={{ color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {schoolInfo.address || 'দক্ষিণগাঁও, গণি মার্কেট, সনমানিয়া, কাপাসিয়া, গাজীপুর।'}
            </span>
            <span
              style={{
                color: '#fef08a',
                fontWeight: 600,
                marginLeft: '4px',
                flexShrink: 0,
              }}
            >
              ★ {examMotto} ★
            </span>
          </div>
        </div>
      </div>

      {/* 2. ADMIT CARD RIBBON BANNER */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '3px 10px',
          backgroundColor: '#f8fafc',
          borderBottom: '1px solid #cbd5e1',
          zIndex: 3,
        }}
      >
        {/* Left Pill: ADMIT CARD BADGE */}
        <div
          style={{
            backgroundColor: '#091e42',
            color: '#ffffff',
            border: '1.2px solid #d97706',
            borderRadius: '12px',
            padding: '1.5px 12px',
            fontSize: '9.5px',
            fontWeight: 'bold',
            letterSpacing: '0.5px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Award style={{ width: '10px', height: '10px', color: '#fbbf24' }} />
          <span>প্রবেশপত্র / ADMIT CARD</span>
        </div>

        {/* Right Tag: Exam Name & Academic Year */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '9.5px',
            fontWeight: 'bold',
          }}
        >
          <span style={{ color: '#091e42' }}>{examName || 'বার্ষিক পরীক্ষা - ২০২৬'}</span>
          <span
            style={{
              backgroundColor: '#091e42',
              color: '#ffffff',
              fontSize: '8px',
              padding: '1px 6px',
              borderRadius: '3px',
              fontWeight: 600,
            }}
          >
            ২০২৬
          </span>
        </div>
      </div>

      {/* 3. STUDENT IDENTITY MATRIX & STUDIO PASSPORT PHOTO SECTION */}
      <div
        style={{
          margin: '5px 8px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          zIndex: 3,
        }}
      >
        {/* Left Column: Student Details Table (Tightly Consolidated, Zero Vertical Void) */}
        <div
          style={{
            flex: '1 1 auto',
            border: '1.2px solid #091e42',
            borderRadius: '4px',
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* Subtle Background Watermark */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.06,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          >
            {activeLogo ? (
              <img
                src={activeLogo}
                alt=""
                style={{ width: '75px', height: '75px', objectFit: 'contain' }}
              />
            ) : (
              <SchoolLogo size={75} />
            )}
          </div>

          {/* Crisp, Compact Table Rows (Tightly Bound, No Gaps) */}
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
            }}
          >
            {/* Row 1: Student Name */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid #cbd5e1',
                padding: '4px 8px',
                backgroundColor: 'rgba(248, 250, 252, 0.6)',
              }}
            >
              <div style={{ width: '80px', minWidth: '80px', lineHeight: 1.1 }}>
                <div style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#091e42' }}>
                  শিক্ষার্থীর নাম:
                </div>
                <div style={{ fontSize: '7px', color: '#64748b', fontStyle: 'italic' }}>
                  Student's Name
                </div>
              </div>
              <div style={{ width: '8px', textAlign: 'center', fontWeight: 'bold', color: '#091e42' }}>:</div>
              <div
                style={{
                  flex: '1 1 auto',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#000000',
                  paddingLeft: '4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {student.nameBn}
              </div>
            </div>

            {/* Row 2: Class & Student ID Side-by-Side */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid #cbd5e1',
                padding: '4px 8px',
              }}
            >
              <div style={{ width: '80px', minWidth: '80px', lineHeight: 1.1 }}>
                <div style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#091e42' }}>
                  শ্রেণি:
                </div>
                <div style={{ fontSize: '7px', color: '#64748b', fontStyle: 'italic' }}>
                  Class
                </div>
              </div>
              <div style={{ width: '8px', textAlign: 'center', fontWeight: 'bold', color: '#091e42' }}>:</div>
              <div
                style={{
                  flex: '1 1 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingLeft: '4px',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#000000' }}>
                  {classNameBn}
                </span>
                <span style={{ fontSize: '8.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span>আইডি:</span>
                  <strong style={{ fontFamily: 'monospace', color: '#091e42' }}>{studentIdDisplay}</strong>
                </span>
              </div>
            </div>

            {/* Row 3: Roll Number (Highlighted Badge) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid #cbd5e1',
                padding: '4px 8px',
                backgroundColor: 'rgba(248, 250, 252, 0.6)',
              }}
            >
              <div style={{ width: '80px', minWidth: '80px', lineHeight: 1.1 }}>
                <div style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#091e42' }}>
                  রোল নং:
                </div>
                <div style={{ fontSize: '7px', color: '#64748b', fontStyle: 'italic' }}>
                  Roll No.
                </div>
              </div>
              <div style={{ width: '8px', textAlign: 'center', fontWeight: 'bold', color: '#091e42' }}>:</div>
              <div
                style={{
                  flex: '1 1 auto',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: '4px',
                }}
              >
                <span
                  style={{
                    backgroundColor: '#fef08a',
                    border: '1.2px solid #ca8a04',
                    padding: '1.5px 9px',
                    borderRadius: '3px',
                    fontSize: '12px',
                    fontWeight: 900,
                    color: '#000000',
                    lineHeight: 1,
                    display: 'inline-block',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
                  }}
                >
                  {toBengaliRoll(student.roll)}
                </span>
              </div>
            </div>

            {/* Row 4: Room No & Seat No in a Polished Inner Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                backgroundColor: '#f0fdf4',
              }}
            >
              <div style={{ width: '80px', minWidth: '80px', lineHeight: 1.1 }}>
                <div style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#091e42' }}>
                  কক্ষ ও আসন:
                </div>
                <div style={{ fontSize: '7px', color: '#64748b', fontStyle: 'italic' }}>
                  Room & Seat
                </div>
              </div>
              <div style={{ width: '8px', textAlign: 'center', fontWeight: 'bold', color: '#091e42' }}>:</div>
              <div
                style={{
                  flex: '1 1 auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  paddingLeft: '4px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                }}
              >
                <span style={{ color: '#047857' }}>কক্ষ: {roomNo}</span>
                <span style={{ color: '#94a3b8' }}>|</span>
                <span style={{ color: '#1e3a8a' }}>আসন: {studentSeat}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Studio Passport Photo Frame (Matched Height) */}
        <div
          style={{
            width: '68px',
            minWidth: '68px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          {/* Passport Photo Frame Container */}
          <div
            onClick={() => fileInputRef.current?.click()}
            title="ছবি পরিবর্তন বা আপলোড করতে ক্লিক করুন"
            style={{
              width: '66px',
              height: '80px',
              border: '2px solid #091e42',
              borderRadius: '4px',
              backgroundColor: '#f8fafc',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              boxSizing: 'border-box',
              cursor: onPhotoUpload ? 'pointer' : 'default',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.12)',
            }}
          >
            {student.avatarUrl ? (
              <img
                src={student.avatarUrl}
                alt={student.nameBn}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  color: '#64748b',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '3px',
                  }}
                >
                  <User style={{ width: '16px', height: '16px', color: '#64748b' }} />
                </div>
                <span
                  style={{
                    fontSize: '6.5px',
                    fontWeight: 'bold',
                    color: '#64748b',
                    lineHeight: 1,
                  }}
                >
                  ছবি নেই
                </span>
                <span
                  style={{
                    fontSize: '5.5px',
                    color: '#94a3b8',
                    marginTop: '2px',
                    lineHeight: 1,
                  }}
                >
                  (ক্লিক করুন)
                </span>
              </div>
            )}

            {/* Screen-only Camera Hover Overlay */}
            {onPhotoUpload && (
              <div
                className="no-print"
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(9, 30, 66, 0.65)',
                  opacity: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'opacity 0.15s ease-in-out',
                  color: '#ffffff',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
              >
                <Camera style={{ width: '16px', height: '16px', color: '#fbbf24' }} />
                <span style={{ fontSize: '6px', fontWeight: 'bold', marginTop: '2px' }}>আপলোড</span>
              </div>
            )}
          </div>

          {/* Under-Photo Ribbon Label */}
          <div
            style={{
              backgroundColor: '#091e42',
              color: '#ffffff',
              fontSize: '6.5px',
              fontWeight: 'bold',
              marginTop: '3px',
              padding: '1px 6px',
              borderRadius: '2px',
              textAlign: 'center',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              letterSpacing: '0.2px',
              border: '1px solid #d97706',
            }}
          >
            শিক্ষার্থীর ছবি
          </div>

          {/* Hidden File Input for Direct Upload */}
          {onPhotoUpload && (
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
          )}
        </div>
      </div>

      {/* 4. SIGNATURES & OFFICIAL VERIFICATION ROW */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          padding: '3px 16px 2px 16px',
          boxSizing: 'border-box',
          zIndex: 3,
        }}
      >
        {/* Head Teacher Signature Block */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '95px',
          }}
        >
          <div
            style={{
              height: '18px',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              marginBottom: '2px',
              width: '100%',
            }}
          >
            {activePrincipalSig ? (
              <img
                src={activePrincipalSig}
                alt="Principal Signature"
                style={{ maxHeight: '18px', maxWidth: '75px', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ width: '75px', borderBottom: '1px dotted #091e42' }} />
            )}
          </div>
          <span
            style={{
              fontSize: '8px',
              fontWeight: 'bold',
              color: '#091e42',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            প্রধান শিক্ষকের স্বাক্ষর
          </span>
        </div>

        {/* Center: Official Verification Seal */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.85,
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              border: '1.2px solid #091e42',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#091e42',
              position: 'relative',
            }}
          >
            <ShieldCheck style={{ width: '16px', height: '16px', color: '#091e42' }} />
          </div>
          <span style={{ fontSize: '6px', fontWeight: 'bold', color: '#64748b', marginTop: '1px' }}>
            VERIFIED
          </span>
        </div>

        {/* Class Teacher Signature Block */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '95px',
          }}
        >
          <div
            style={{
              height: '18px',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              marginBottom: '2px',
              width: '100%',
            }}
          >
            {classTeacherSignatureUrl ? (
              <img
                src={classTeacherSignatureUrl}
                alt="Teacher Signature"
                style={{ maxHeight: '18px', maxWidth: '75px', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ width: '75px', borderBottom: '1px dotted #091e42' }} />
            )}
          </div>
          <span
            style={{
              fontSize: '8px',
              fontWeight: 'bold',
              color: '#091e42',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            শ্রেণি শিক্ষকের স্বাক্ষর
          </span>
        </div>
      </div>

      {/* 5. BOTTOM WARNING BANNER (High-Contrast Security Ribbon) */}
      <div
        style={{
          background: 'linear-gradient(135deg, #091e42 0%, #0d2866 100%)',
          color: '#ffffff',
          padding: '3.5px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          boxSizing: 'border-box',
          borderTop: '1.5px solid #d97706',
          zIndex: 3,
        }}
      >
        <span style={{ color: '#fbbf24', fontSize: '9px', fontWeight: 'bold' }}>⚠️</span>
        <span
          style={{
            fontSize: '7.5px',
            fontWeight: 'bold',
            color: '#ffffff',
            letterSpacing: '0.2px',
            whiteSpace: 'nowrap',
          }}
        >
          <strong style={{ color: '#fde047' }}>পরীক্ষার্থীকে অবশ্যই এই কার্ড সাথে আনতে হবে</strong> / Students must bring this card
        </span>
      </div>
    </div>
  );
};
