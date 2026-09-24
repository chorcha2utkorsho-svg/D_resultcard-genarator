import React from 'react';
import { CalculatedStudentResult, SchoolInfo } from '../types';
import { SchoolLogo } from './SchoolLogo';
import { toBengaliNumber, toBengaliRoll } from '../utils/bengali';

interface MarksheetCardProps {
  result: CalculatedStudentResult;
  schoolInfo: SchoolInfo;
  classNameTitle?: string;
  isPrintMode?: boolean;
}

export const MarksheetCard: React.FC<MarksheetCardProps> = ({
  result,
  schoolInfo,
  classNameTitle = '',
  isPrintMode = false,
}) => {
  const { student, subjectRows, totalFullMarks, grandTotalObtained, gpa, meritPositionBn } = result;

  return (
    <div
      className={`marksheet-page bg-white text-black font-sans box-border ${
        isPrintMode ? 'p-6 mx-auto w-full' : 'p-6 sm:p-8 rounded-lg shadow-md border border-slate-300 max-w-4xl mx-auto my-4'
      }`}
      style={{
        width: '100%',
        maxWidth: '820px',
        backgroundColor: '#ffffff',
        color: '#000000',
        minHeight: '1050px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div>
        {/* HEADER SECTION - EXACTLY LIKE ATTACHED IMAGE */}
        <div className="flex items-center justify-between pb-2">
          {/* Logo on the left */}
          <div className="flex-shrink-0 mr-3">
            <SchoolLogo customLogoUrl={schoolInfo.logoUrl} size={110} />
          </div>

          {/* School Name and Info in center */}
          <div className="flex-grow text-center">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-black mb-1 font-serif">
              {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
            </h1>
            <p className="text-sm sm:text-base font-medium text-black">
              {schoolInfo.address || 'দক্ষিণগাঁও, গণি মার্কেট, সনমানিয়া, কাপাসিয়া, গাজীপুর।'}
            </p>
            <p className="text-sm font-semibold text-black mt-0.5">
              {schoolInfo.established || 'স্থাপিত:২০১৮'}
            </p>
            <p className="text-sm font-medium text-black">
              মোবাইল নম্বর: {toBengaliNumber(schoolInfo.phone || '০১৩১৩১৫৯৪৫৯')}
            </p>
            <p className="text-sm text-black">
              ই-মেইল:-{schoolInfo.email || 'contact.dlikonmodelacademy@gmail.com'}
            </p>
          </div>
        </div>

        {/* DOUBLE BORDER LINE */}
        <div className="w-full my-2">
          <div className="h-[2px] bg-black w-full"></div>
          <div className="h-[1px] bg-black w-full mt-[2px]"></div>
        </div>

        {/* EXAM TITLE, STUDENT INFO & GRADING SCALE ROW */}
        <div className="flex flex-col sm:flex-row justify-between items-start my-4 gap-4">
          {/* Left Side: Exam and Student Details */}
          <div className="space-y-1.5 pt-1">
            <h2 className="text-xl sm:text-2xl font-bold text-black font-serif">
              {result.examTitle}- {toBengaliNumber(result.academicYear)} ইং
            </h2>
            <div className="text-base sm:text-lg font-bold text-black pt-1">
              <span>নাম: {student.nameBn}</span>
              <span className="ml-4">রোল:- {toBengaliRoll(student.roll)}</span>
              {student.section && <span className="ml-3">({student.section} শাখা)</span>}
            </div>
            <div className="text-base sm:text-lg font-bold text-black">
              শ্রেণি: {classNameTitle || 'চতুর্থ'}।
            </div>
          </div>

          {/* Right Side: Exact Grading Scale Table from Image */}
          <div className="self-end sm:self-auto flex-shrink-0">
            <table
              className="text-xs text-center border-collapse border border-black"
              style={{ width: '190px' }}
            >
              <thead>
                <tr className="bg-slate-50 font-bold border-b border-black">
                  <th className="border-r border-black py-0.5 px-1 font-semibold text-[11px]">Number</th>
                  <th className="border-r border-black py-0.5 px-1 font-semibold text-[11px]">Point</th>
                  <th className="py-0.5 px-1 font-semibold text-[11px]">GPA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black text-[11px] leading-tight">
                <tr>
                  <td className="border-r border-black py-0.5">80-100</td>
                  <td className="border-r border-black py-0.5">5.00</td>
                  <td className="py-0.5 font-bold">A+</td>
                </tr>
                <tr>
                  <td className="border-r border-black py-0.5">70-79</td>
                  <td className="border-r border-black py-0.5">4.00</td>
                  <td className="py-0.5 font-bold">A</td>
                </tr>
                <tr>
                  <td className="border-r border-black py-0.5">60-69</td>
                  <td className="border-r border-black py-0.5">3.50</td>
                  <td className="py-0.5 font-bold">A-</td>
                </tr>
                <tr>
                  <td className="border-r border-black py-0.5">50-59</td>
                  <td className="border-r border-black py-0.5">3.00</td>
                  <td className="py-0.5 font-bold">B</td>
                </tr>
                <tr>
                  <td className="border-r border-black py-0.5">40-49</td>
                  <td className="border-r border-black py-0.5">2.00</td>
                  <td className="py-0.5 font-bold">C</td>
                </tr>
                <tr>
                  <td className="border-r border-black py-0.5">33-40</td>
                  <td className="border-r border-black py-0.5">1.00</td>
                  <td className="py-0.5 font-bold">D</td>
                </tr>
                <tr>
                  <td className="border-r border-black py-0.5">0-32</td>
                  <td className="border-r border-black py-0.5">0.00</td>
                  <td className="py-0.5 font-bold">F</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* MAIN SUBJECT MARKS TABLE - EXACT COLUMNS FROM ATTACHMENT */}
        <div className="w-full my-3 overflow-x-auto">
          <table
            className="w-full text-sm border-collapse border border-black text-center"
            style={{ border: '1.5px solid black' }}
          >
            <thead>
              <tr className="border-b border-black font-bold text-xs sm:text-sm bg-slate-50">
                <th className="border-r border-black py-2 px-2 text-left w-[30%]">বিষয়</th>
                <th className="border-r border-black py-2 px-1 w-[11%]">মোট নম্বর</th>
                <th className="border-r border-black py-2 px-1 w-[11%]">প্রাপ্ত নম্বর</th>
                <th className="border-r border-black py-2 px-1 w-[12%]">প্রাপ্ত নম্বরের ৮০%</th>
                <th className="border-r border-black py-2 px-1 w-[12%]">মাসিক পরীক্ষার ২০%</th>
                <th className="border-r border-black py-2 px-1 w-[12%] font-bold">মোট প্রাপ্ত নম্বর</th>
                <th className="py-2 px-1 w-[12%]">শ্রেণি সর্বোচ্চ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black text-xs sm:text-sm">
              {subjectRows.map((row) => (
                <tr key={row.subject.id} className="hover:bg-slate-50/50">
                  <td className="border-r border-black py-1.5 px-2 text-left font-medium">
                    {row.subject.nameBn}
                  </td>
                  <td className="border-r border-black py-1.5 px-1 font-medium">
                    {toBengaliNumber(row.fullMarks)}
                  </td>
                  <td className="border-r border-black py-1.5 px-1">
                    {row.obtainedMarks !== null ? toBengaliNumber(row.obtainedMarks) : ''}
                  </td>
                  <td className="border-r border-black py-1.5 px-1">
                    {row.marks80 !== null ? toBengaliNumber(row.marks80) : ''}
                  </td>
                  <td className="border-r border-black py-1.5 px-1">
                    {row.monthly20 !== null ? toBengaliNumber(row.monthly20) : ''}
                  </td>
                  <td className="border-r border-black py-1.5 px-1 font-bold">
                    {row.totalObtained !== null ? toBengaliNumber(row.totalObtained) : ''}
                  </td>
                  <td className="py-1.5 px-1 font-medium">
                    {row.classHighest !== null ? toBengaliNumber(row.classHighest) : ''}
                  </td>
                </tr>
              ))}

              {/* TOTAL MARKS SUMMARY ROW */}
              <tr className="border-t-2 border-black font-bold bg-slate-50/70">
                <td className="border-r border-black py-2 px-2 text-left">মোট নম্বর</td>
                <td className="border-r border-black py-2 px-1">
                  {toBengaliNumber(totalFullMarks)}
                </td>
                <td className="border-r border-black py-2 px-1"></td>
                <td className="border-r border-black py-2 px-1"></td>
                <td className="border-r border-black py-2 px-1"></td>
                <td className="border-r border-black py-2 px-1 text-base">
                  {grandTotalObtained > 0 ? toBengaliNumber(grandTotalObtained) : ''}
                </td>
                <td className="py-2 px-1"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* BOTTOM SUMMARY TABLE - EXACT 3 ROWS FROM IMAGE */}
        <div className="w-full my-4">
          <table
            className="w-full text-xs sm:text-sm border-collapse border border-black"
            style={{ border: '1.5px solid black' }}
          >
            <tbody>
              {/* Row 1: Working Days, Attendance, Absence */}
              <tr className="border-b border-black">
                <td className="border-r border-black py-2 px-2 font-bold w-[18%] bg-slate-50/50">
                  মোট কার্য দিবস
                </td>
                <td className="border-r border-black py-2 px-2 text-center w-[15%] font-medium">
                  {toBengaliNumber(result.totalWorkingDays)}
                </td>
                <td className="border-r border-black py-2 px-2 font-bold w-[18%] bg-slate-50/50">
                  উপস্থিতি
                </td>
                <td className="border-r border-black py-2 px-2 text-center w-[15%] font-medium">
                  {toBengaliNumber(result.attendanceDays)}
                </td>
                <td className="border-r border-black py-2 px-2 font-bold w-[18%] bg-slate-50/50">
                  অনুপস্থিতি
                </td>
                <td className="py-2 px-2 text-center w-[16%] font-medium">
                  {toBengaliNumber(result.absenceDays)}
                </td>
              </tr>

              {/* Row 2: Total Marks, GPA, Merit */}
              <tr className="border-b border-black">
                <td className="border-r border-black py-2 px-2 font-bold bg-slate-50/50">
                  মোট নম্বর
                </td>
                <td className="border-r border-black py-2 px-2 text-center font-bold">
                  {grandTotalObtained > 0 ? toBengaliNumber(grandTotalObtained) : ''}
                </td>
                <td className="border-r border-black py-2 px-2 font-bold bg-slate-50/50">
                  জিপি এ
                </td>
                <td className="border-r border-black py-2 px-2 text-center font-bold text-sm sm:text-base">
                  {toBengaliNumber(gpa.toFixed(2))} ({result.overallGrade})
                </td>
                <td className="border-r border-black py-2 px-2 font-bold bg-slate-50/50">
                  মেধাক্রম
                </td>
                <td className="py-2 px-2 text-center font-bold text-sm sm:text-base">
                  {meritPositionBn}
                </td>
              </tr>

              {/* Row 3: Teacher's Remarks (Full Width) */}
              <tr>
                <td className="border-r border-black py-2.5 px-2 font-bold bg-slate-50/50 align-top whitespace-nowrap">
                  শিক্ষকের মন্তব্য:
                </td>
                <td colSpan={5} className="py-2.5 px-3 text-left font-serif text-sm">
                  {result.teacherRemarks || 'নিয়মিত ক্লাসে উপস্থিত থাকবে এবং লেখাপড়ায় অধিক যত্নবান হতে হবে।'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* BOTTOM SIGNATURES SECTION - 3 COLUMNS EXACTLY LIKE ATTACHMENT */}
      <div className="w-full pt-16 pb-4 mt-8">
        <div className="flex justify-between items-end text-xs sm:text-sm font-bold text-black text-center px-4">
          {/* Class Teacher Signature */}
          <div className="w-1/3 flex flex-col items-center">
            <div className="w-36 border-b border-dotted border-black mb-1"></div>
            <span>শ্রেণি শিক্ষকের স্বাক্ষর</span>
          </div>

          {/* Principal Signature */}
          <div className="w-1/3 flex flex-col items-center relative">
            {schoolInfo.principalSignatureUrl ? (
              <div className="absolute -top-12 h-14 flex items-center justify-center pointer-events-none">
                <img
                  src={schoolInfo.principalSignatureUrl}
                  alt="Principal Signature"
                  className="max-h-12 object-contain"
                />
              </div>
            ) : null}
            <div className="w-36 border-b border-dotted border-black mb-1"></div>
            <span>প্রধান শিক্ষকের স্বাক্ষর</span>
          </div>

          {/* Guardian Signature */}
          <div className="w-1/3 flex flex-col items-center">
            <div className="w-36 border-b border-dotted border-black mb-1"></div>
            <span>অভিভাবকের স্বাক্ষর</span>
          </div>
        </div>
      </div>
    </div>
  );
};
