import React from 'react';
import { SchoolInfo, Student } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { toBengaliNumber, toBengaliRoll } from '../utils/bengali';

export interface ReceiptItem {
  serialBn: string;
  nameBn: string;
  amount: number;
}

export interface PrintableReceiptData {
  classNameBn: string;
  items: ReceiptItem[];
  grandTotal: number;
  grandTotalWords: string;
}

export interface PrintableReceiptLayoutProps {
  schoolInfo: SchoolInfo;
  student: Student | null;
  data: PrintableReceiptData;
  voucherTitle: string;
  copyLabel: string;
  isBlankAmounts?: boolean;
  isCompact?: boolean;
  isSingleReceiptFullA4?: boolean;
  customLogoUrl?: string;
  principalSignatureUrl?: string;
  guardianSignatureUrl?: string;
}

/**
 * Single Receipt Slip Layout (Supports both Split A4 side-by-side & Full A4 Centered)
 * Features:
 * - Toggleable between 2-on-A4 Landscape and Single Full A4 Portrait Centered
 * - Uses light, thin dashed lines for fill-in fields instead of heavy solid borders for maximum readability
 * - Logo positioned on the LEFT side with custom uploaded Base64 logo support
 * - Digital PNG signature & hand-signing clearance
 */
export const SingleReceiptSlip: React.FC<PrintableReceiptLayoutProps> = ({
  schoolInfo,
  student,
  data,
  voucherTitle,
  copyLabel,
  isBlankAmounts = true,
  isCompact = false,
  isSingleReceiptFullA4 = false,
  customLogoUrl,
  principalSignatureUrl,
  guardianSignatureUrl,
}) => {
  const isBlankStudent = !student;
  const hideAmounts = isBlankAmounts || data.grandTotal === 0;
  const activeLogo = customLogoUrl || schoolInfo.logoUrl;
  const activePrincipalSig = principalSignatureUrl || schoolInfo.principalSignatureUrl;

  return (
    <div
      className={`official-voucher-slip bg-white text-black flex flex-col justify-between select-none relative box-border border-2 border-black rounded-xs w-full ${
        isSingleReceiptFullA4
          ? 'p-5 sm:p-6 text-sm max-w-[190mm] mx-auto'
          : isCompact
          ? 'p-1.5 text-[10px]'
          : 'p-2 text-xs'
      }`}
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div className="flex-1 flex flex-col">
        {/* School Header - Logo strictly on LEFT side, prominent and clear */}
        <div className={`relative flex items-center border-b-2 border-black ${isSingleReceiptFullA4 ? 'pb-2 mb-2' : 'pb-0.5 mb-1'}`}>
          {/* Logo on Left */}
          <div className="shrink-0 mr-2.5 flex items-center justify-center">
            <SchoolLogo
              customLogoUrl={activeLogo}
              size={isSingleReceiptFullA4 ? 76 : isCompact ? 36 : 52}
              className="rounded-lg object-contain bg-white border border-slate-300 p-0.5"
            />
          </div>
          {/* Centered School Information (counter-balanced with right padding) */}
          <div className={`flex-1 text-center ${isSingleReceiptFullA4 ? 'pr-20' : 'pr-14'}`}>
            <h1 className={`font-bold font-serif text-black leading-tight tracking-tight ${isSingleReceiptFullA4 ? 'text-xl sm:text-2xl' : 'text-[15px]'}`}>
              {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
            </h1>
            <p className={`${isSingleReceiptFullA4 ? 'text-xs' : 'text-[9.5px]'} font-semibold text-slate-800 leading-tight mt-0.5`}>
              {schoolInfo.established || 'স্থাপিত: ২০১৮ ইং'}
            </p>
            <p className={`${isSingleReceiptFullA4 ? 'text-[11px]' : 'text-[8.5px]'} text-slate-700 leading-tight mt-0.5`}>
              {schoolInfo.address || 'দক্ষিণগাঁও, গনি মার্কেট, সনমানিয়া, কাপাসিয়া, গাজীপুর।'}
            </p>
          </div>
        </div>

        {/* Voucher Title Badge */}
        <div className="text-center my-0.5">
          <div className={`inline-block border-2 border-black rounded font-bold tracking-wide bg-white text-black ${
            isSingleReceiptFullA4 ? 'px-5 py-1 text-sm' : 'px-3 py-0.5 text-[10.5px]'
          }`}>
            {voucherTitle}
          </div>
        </div>

        {/* Student Meta Details with Light, Thin Dashed Lines for Fill-in */}
        <div className={`space-y-1 ${isSingleReceiptFullA4 ? 'mb-2 text-xs sm:text-sm' : 'mb-1.5 text-[11px]'}`}>
          {/* Row 1: নাম & শ্রেণি */}
          <div className="grid grid-cols-12 gap-2 items-baseline">
            <div className="col-span-7 flex items-baseline overflow-hidden">
              <span className="font-bold whitespace-nowrap text-black">নাম:</span>
              {!isBlankStudent && student ? (
                <span className={`ml-1 font-bold text-black whitespace-nowrap truncate ${isSingleReceiptFullA4 ? 'text-sm' : 'text-[12px]'}`}>
                  {student.nameBn}
                </span>
              ) : null}
              <span
                className="flex-1 ml-1 min-w-[20px]"
                style={{
                  borderBottom: '1.5px dashed #94a3b8',
                  height: '1px',
                  alignSelf: 'baseline',
                }}
              />
            </div>
            <div className="col-span-5 flex items-baseline overflow-hidden">
              <span className="font-bold whitespace-nowrap text-black">শ্রেণি:</span>
              <span className={`ml-1 font-bold text-black whitespace-nowrap truncate ${isSingleReceiptFullA4 ? 'text-sm' : 'text-[12px]'}`}>
                {data.classNameBn}
              </span>
              <span
                className="flex-1 ml-1 min-w-[15px]"
                style={{
                  borderBottom: '1.5px dashed #94a3b8',
                  height: '1px',
                  alignSelf: 'baseline',
                }}
              />
            </div>
          </div>

          {/* Row 2: শাখা & রোল */}
          <div className="grid grid-cols-12 gap-2 items-baseline">
            <div className="col-span-7 flex items-baseline overflow-hidden">
              <span className="font-bold whitespace-nowrap text-black">শাখা:</span>
              {!isBlankStudent && student ? (
                <span className={`ml-1 font-bold text-black whitespace-nowrap ${isSingleReceiptFullA4 ? 'text-sm' : 'text-[12px]'}`}>
                  {student.section || 'ক'}
                </span>
              ) : null}
              <span
                className="flex-1 ml-1 min-w-[20px]"
                style={{
                  borderBottom: '1.5px dashed #94a3b8',
                  height: '1px',
                  alignSelf: 'baseline',
                }}
              />
            </div>
            <div className="col-span-5 flex items-baseline overflow-hidden">
              <span className="font-bold whitespace-nowrap text-black">রোল:</span>
              {!isBlankStudent && student ? (
                <span className={`ml-1 font-bold text-black whitespace-nowrap font-mono ${isSingleReceiptFullA4 ? 'text-sm' : 'text-[12px]'}`}>
                  {toBengaliRoll(student.roll)}
                </span>
              ) : null}
              <span
                className="flex-1 ml-1 min-w-[15px]"
                style={{
                  borderBottom: '1.5px dashed #94a3b8',
                  height: '1px',
                  alignSelf: 'baseline',
                }}
              />
            </div>
          </div>
        </div>

        {/* 8-Row Breakdown Table with Light Thin Dashed Lines for Fill-in Fields */}
        <table className={`w-full border-collapse border-2 border-black ${isSingleReceiptFullA4 ? 'text-xs my-2' : 'text-[11px] mb-1'}`}>
          <thead>
            <tr className="border-b-2 border-black font-bold bg-slate-100">
              <th className={`border-r border-dashed border-slate-300 text-center font-bold ${isSingleReceiptFullA4 ? 'py-1.5 px-2 w-10' : 'py-0.5 px-1 w-7'}`}>
                ক্র.
              </th>
              <th className={`border-r border-dashed border-slate-300 text-center font-bold ${isSingleReceiptFullA4 ? 'py-1.5 px-3' : 'py-0.5 px-2'}`}>
                বিবরণ
              </th>
              <th className={`text-center font-bold ${isSingleReceiptFullA4 ? 'py-1.5 px-3 w-32' : 'py-0.5 px-2 w-24'}`}>
                টাকা
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx} className="border-b border-dashed border-slate-300">
                <td className={`border-r border-dashed border-slate-300 text-center font-semibold ${isSingleReceiptFullA4 ? 'py-1.5 px-2' : 'py-0.5 px-1'}`}>
                  {item.serialBn}
                </td>
                <td className={`border-r border-dashed border-slate-300 text-left font-semibold ${isSingleReceiptFullA4 ? 'py-1.5 px-3' : 'py-0.5 px-2'}`}>
                  {item.nameBn}
                </td>
                <td className={`text-right font-mono font-bold ${isSingleReceiptFullA4 ? 'py-1.5 px-3' : 'py-0.5 px-2'}`}>
                  {!hideAmounts && item.amount > 0 ? `${toBengaliNumber(item.amount)}/-` : ''}
                </td>
              </tr>
            ))}
            {/* Grand Total Row */}
            <tr className="border-t-2 border-black font-bold bg-slate-50">
              <td colSpan={2} className={`border-r border-dashed border-slate-300 text-right pr-3 font-bold ${isSingleReceiptFullA4 ? 'py-2 text-sm' : 'py-1 text-xs'}`}>
                সর্বমোট টাকা =
              </td>
              <td className={`text-right font-bold font-mono ${isSingleReceiptFullA4 ? 'py-2 px-3 text-sm' : 'py-1 px-2 text-xs'}`}>
                {!hideAmounts && data.grandTotal > 0 ? `${toBengaliNumber(data.grandTotal)}/-` : <span className="text-transparent select-none">&nbsp;</span>}
              </td>
            </tr>
          </tbody>
        </table>

        {/* In Words with Light, Thin Dashed Lines */}
        <div className={`flex items-baseline overflow-hidden ${isSingleReceiptFullA4 ? 'text-xs my-2' : 'text-[11px] my-1'}`}>
          <span className="font-bold whitespace-nowrap text-black">কথায়:</span>
          {!hideAmounts && data.grandTotalWords ? (
            <span className={`ml-1.5 font-bold text-black whitespace-nowrap truncate ${isSingleReceiptFullA4 ? 'text-xs' : 'text-[11px]'}`}>
              {data.grandTotalWords}
            </span>
          ) : null}
          <span
            className="flex-1 ml-1.5 min-w-[20px]"
            style={{
              borderBottom: '1.5px dashed #94a3b8',
              height: '1px',
              alignSelf: 'baseline',
            }}
          />
        </div>
      </div>

      {/* Footer: Signatures & Copy Label with Digital Signature support */}
      <div className={`${isSingleReceiptFullA4 ? 'pt-4 pb-3 px-2' : 'pt-1.5 pb-1 px-1'}`}>
        <div className={`flex justify-between items-end px-2 ${isSingleReceiptFullA4 ? 'text-xs' : 'text-[10px]'}`}>
          {/* Guardian Signature */}
          <div className={`text-center ${isSingleReceiptFullA4 ? 'w-40' : 'w-32'} flex flex-col items-center`}>
            <div
              className={`${isSingleReceiptFullA4 ? 'h-11' : 'h-7'} flex items-end justify-center mb-0.5 w-full`}
              style={{
                height: isSingleReceiptFullA4 ? '40px' : '26px',
                maxHeight: isSingleReceiptFullA4 ? '40px' : '26px',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {guardianSignatureUrl ? (
                <img
                  src={guardianSignatureUrl}
                  alt="অভিভাবক স্বাক্ষর"
                  style={{
                    maxHeight: isSingleReceiptFullA4 ? '34px' : '22px',
                    maxWidth: isSingleReceiptFullA4 ? '120px' : '85px',
                    height: 'auto',
                    width: 'auto',
                    objectFit: 'contain',
                    display: 'block',
                    margin: '0 auto',
                  }}
                  className={`${isSingleReceiptFullA4 ? 'h-10 max-h-10' : 'h-6 max-h-6'} object-contain`}
                />
              ) : null}
            </div>
            <div className="border-t-2 border-black mb-0.5 w-full" style={{ borderTop: '2px solid #000000', width: '100%', marginBottom: '2px' }} />
            <span className={`font-bold text-black whitespace-nowrap ${isSingleReceiptFullA4 ? 'text-xs' : 'text-[10px]'}`}>
              অভিভাবকের স্বাক্ষর
            </span>
          </div>

          {/* Copy Label */}
          <div className="text-center pb-0.5">
            <span className={`font-bold text-black tracking-wider inline-block border border-black rounded px-2 py-0.5 bg-slate-50 ${isSingleReceiptFullA4 ? 'text-xs' : 'text-[9.5px]'}`}>
              {copyLabel}
            </span>
          </div>

          {/* Office Assistant / Principal Signature */}
          <div className={`text-center ${isSingleReceiptFullA4 ? 'w-48' : 'w-40'} flex flex-col items-center`}>
            <div
              className={`${isSingleReceiptFullA4 ? 'h-11' : 'h-7'} flex items-end justify-center mb-0.5 w-full`}
              style={{
                height: isSingleReceiptFullA4 ? '40px' : '26px',
                maxHeight: isSingleReceiptFullA4 ? '40px' : '26px',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {activePrincipalSig ? (
                <img
                  src={activePrincipalSig}
                  alt="প্রিন্সিপাল স্বাক্ষর"
                  style={{
                    maxHeight: isSingleReceiptFullA4 ? '34px' : '22px',
                    maxWidth: isSingleReceiptFullA4 ? '120px' : '85px',
                    height: 'auto',
                    width: 'auto',
                    objectFit: 'contain',
                    display: 'block',
                    margin: '0 auto',
                  }}
                  className={`${isSingleReceiptFullA4 ? 'h-10 max-h-10' : 'h-6 max-h-6'} object-contain`}
                />
              ) : null}
            </div>
            <div className="border-t-2 border-black mb-0.5 w-full" style={{ borderTop: '2px solid #000000', width: '100%', marginBottom: '2px' }} />
            <span className={`font-bold text-black whitespace-nowrap ${isSingleReceiptFullA4 ? 'text-xs' : 'text-[10px]'}`}>
              অফিস সহকারী / প্রিন্সিপাল
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
