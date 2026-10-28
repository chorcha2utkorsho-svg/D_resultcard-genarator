import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Calendar,
  Clock,
  Plus,
  Search,
  Printer,
  Download,
  Edit2,
  Trash2,
  Send,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Users,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Info,
  Flag,
  CalendarCheck,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { AcademicCalendarEvent, CalendarEventType } from '../types';
import { toBengaliNumber } from '../utils/bengali';
import { SchoolLogo } from './SchoolLogo';

const BENGALI_MONTHS = [
  { value: 1, name: 'জানুয়ারি' },
  { value: 2, name: 'ফেব্রুয়ারি' },
  { value: 3, name: 'মার্চ' },
  { value: 4, name: 'এপ্রিল' },
  { value: 5, name: 'মে' },
  { value: 6, name: 'জুন' },
  { value: 7, name: 'জুলাই' },
  { value: 8, name: 'আগস্ট' },
  { value: 9, name: 'সেপ্টেম্বর' },
  { value: 10, name: 'অক্টোবর' },
  { value: 11, name: 'নভেম্বর' },
  { value: 12, name: 'ডিসেম্বর' },
];

const WEEKDAY_NAMES = [
  { en: 'Sat', bn: 'শনি' },
  { en: 'Sun', bn: 'রবি' },
  { en: 'Mon', bn: 'সোম' },
  { en: 'Tue', bn: 'মঙ্গল' },
  { en: 'Wed', bn: 'বুধ' },
  { en: 'Thu', bn: 'বৃহস্পতি' },
  { en: 'Fri', bn: 'শুক্র', isWeekend: true },
];

const EVENT_TYPE_LABELS: Record<CalendarEventType, { label: string; color: string; dotColor: string }> = {
  exam: { label: 'পরীক্ষা', color: 'bg-indigo-50 text-indigo-800 border-indigo-200', dotColor: 'bg-indigo-600' },
  holiday: { label: 'সরকারি ও ধর্মীয় ছুটি', color: 'bg-rose-50 text-rose-800 border-rose-200', dotColor: 'bg-rose-600' },
  event: { label: 'অনুষ্ঠান ও প্রতিযোগিতা', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', dotColor: 'bg-emerald-600' },
  meeting: { label: 'অভিভাবক সমাবেশ', color: 'bg-amber-50 text-amber-800 border-amber-200', dotColor: 'bg-amber-600' },
  result: { label: 'ফলাফল প্রকাশ', color: 'bg-sky-50 text-sky-800 border-sky-200', dotColor: 'bg-sky-600' },
  admission: { label: 'ভর্তি কার্যক্রম', color: 'bg-purple-50 text-purple-800 border-purple-200', dotColor: 'bg-purple-600' },
};

export const AcademicCalendarView: React.FC = () => {
  const {
    schoolInfo,
    calendarEvents,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    selectedYear,
    setSelectedYear,
    sendBatchSMS,
    students,
  } = useSchool();

  // View state
  const [viewMode, setViewMode] = useState<'month_grid' | 'agenda_list'>('month_grid');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Calendar date navigator state (default to September 2026 for app context)
  const [currentYear, setCurrentYear] = useState<number>(2026);
  const [currentMonth, setCurrentMonth] = useState<number>(9); // 1-12 (September)
  const [selectedDateEvents, setSelectedDateEvents] = useState<{ date: string; events: AcademicCalendarEvent[] } | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<AcademicCalendarEvent | null>(null);
  const [isMultiDay, setIsMultiDay] = useState<boolean>(false);

  // Form fields
  const [formTitle, setFormTitle] = useState<string>('');
  const [formType, setFormType] = useState<CalendarEventType>('event');
  const [formStartDate, setFormStartDate] = useState<string>('2026-09-24');
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formIsSchoolClosed, setFormIsSchoolClosed] = useState<boolean>(false);
  const [formLocation, setFormLocation] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Quick SMS notice state
  const [smsModalEvent, setSmsModalEvent] = useState<AcademicCalendarEvent | null>(null);
  const [smsSending, setSmsSending] = useState<boolean>(false);
  const [smsFeedback, setSmsFeedback] = useState<string | null>(null);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return calendarEvents
      .filter((evt) => {
        if (typeFilter !== 'all' && evt.type !== typeFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = evt.title.toLowerCase().includes(q);
          const matchDesc = evt.description?.toLowerCase().includes(q);
          const matchLoc = evt.location?.toLowerCase().includes(q);
          if (!matchTitle && !matchDesc && !matchLoc) return false;
        }
        return true;
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [calendarEvents, typeFilter, searchQuery]);

  // Calendar grid computation for currentMonth and currentYear
  const calendarGrid = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    // In BD week: Sat (0), Sun (1), Mon (2), Tue (3), Wed (4), Thu (5), Fri (6)
    // JS getDay(): Sun (0), Mon (1), Tue (2), Wed (3), Thu (4), Fri (5), Sat (6)
    const firstDayJs = new Date(currentYear, currentMonth - 1, 1).getDay();
    // Convert to Sat=0 index: (firstDayJs + 1) % 7
    const firstDaySatIndex = (firstDayJs + 1) % 7;

    const days: {
      dayNumber: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isFriday: boolean;
      isToday: boolean;
      events: AcademicCalendarEvent[];
    }[] = [];

    const monthStr = String(currentMonth).padStart(2, '0');

    // Fill previous month padding
    const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();
    for (let i = firstDaySatIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevMo = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYr = currentMonth === 1 ? currentYear - 1 : currentYear;
      const dateStr = `${prevYr}-${String(prevMo).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({
        dayNumber: dayNum,
        dateStr,
        isCurrentMonth: false,
        isFriday: false,
        isToday: false,
        events: [],
      });
    }

    // Today YYYY-MM-DD
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Fill current month days
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dateStr = `${currentYear}-${monthStr}-${String(dayNum).padStart(2, '0')}`;
      const dayOfWeekJs = new Date(currentYear, currentMonth - 1, dayNum).getDay();
      const isFriday = dayOfWeekJs === 5; // Friday
      const isToday = dateStr === todayStr || dateStr === '2026-09-24'; // app local anchor

      // Find events spanning this day
      const dayEvents = calendarEvents.filter((evt) => {
        if (!evt.endDate) {
          return evt.startDate === dateStr;
        }
        return evt.startDate <= dateStr && evt.endDate >= dateStr;
      });

      days.push({
        dayNumber: dayNum,
        dateStr,
        isCurrentMonth: true,
        isFriday,
        isToday,
        events: dayEvents,
      });
    }

    // Fill trailing days to complete 7-day grid rows (35 or 42 cells)
    const totalCells = Math.ceil(days.length / 7) * 7;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextMo = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextYr = currentMonth === 12 ? currentYear + 1 : currentYear;
      const dateStr = `${nextYr}-${String(nextMo).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dayNumber: i,
        dateStr,
        isCurrentMonth: false,
        isFriday: false,
        isToday: false,
        events: [],
      });
    }

    return days;
  }, [currentYear, currentMonth, calendarEvents]);

  // Overview metrics for the month
  const monthMetrics = useMemo(() => {
    const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const monthEvents = calendarEvents.filter(
      (e) => e.startDate.startsWith(monthStr) || (e.endDate && e.endDate.startsWith(monthStr))
    );

    const exams = monthEvents.filter((e) => e.type === 'exam').length;
    const holidays = monthEvents.filter((e) => e.type === 'holiday').length;
    const closedDays = monthEvents.filter((e) => e.isSchoolClosed).length;
    const eventsCount = monthEvents.length;

    return { total: eventsCount, exams, holidays, closedDays };
  }, [currentYear, currentMonth, calendarEvents]);

  // Navigate month
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
    setSelectedDateEvents(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
    setSelectedDateEvents(null);
  };

  // Open Add Modal
  const handleOpenAdd = (defaultDate?: string) => {
    setEditingEvent(null);
    setFormTitle('');
    setFormType('event');
    setFormStartDate(defaultDate || `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`);
    setFormEndDate('');
    setIsMultiDay(false);
    setFormDescription('');
    setFormIsSchoolClosed(false);
    setFormLocation('');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (evt: AcademicCalendarEvent) => {
    setEditingEvent(evt);
    setFormTitle(evt.title);
    setFormType(evt.type);
    setFormStartDate(evt.startDate);
    setFormEndDate(evt.endDate || '');
    setIsMultiDay(!!evt.endDate);
    setFormDescription(evt.description || '');
    setFormIsSchoolClosed(evt.isSchoolClosed);
    setFormLocation(evt.location || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Save Event (Add or Update)
  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('অনুগ্রহ করে ইভেন্টের শিরোনাম লিখুন।');
      return;
    }
    if (!formStartDate) {
      setFormError('অনুগ্রহ করে শুরুর তারিখ নির্ধারণ করুন।');
      return;
    }
    if (isMultiDay && formEndDate && formEndDate < formStartDate) {
      setFormError('সমাপ্তির তারিখ শুরুর তারিখের পূর্বের হতে পারে না।');
      return;
    }

    if (editingEvent) {
      updateCalendarEvent({
        ...editingEvent,
        title: formTitle.trim(),
        type: formType,
        startDate: formStartDate,
        endDate: isMultiDay && formEndDate ? formEndDate : undefined,
        description: formDescription.trim(),
        isSchoolClosed: formIsSchoolClosed,
        location: formLocation.trim() || undefined,
        academicYear: selectedYear,
      });
    } else {
      addCalendarEvent({
        title: formTitle.trim(),
        type: formType,
        startDate: formStartDate,
        endDate: isMultiDay && formEndDate ? formEndDate : undefined,
        description: formDescription.trim(),
        isSchoolClosed: formIsSchoolClosed,
        location: formLocation.trim() || undefined,
        academicYear: selectedYear,
      });
    }

    setIsModalOpen(false);
    setSelectedDateEvents(null);
  };

  // Delete event with confirmation
  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`আপনি কি "${title}" ইভেন্টটি মুছে ফেলতে চান?`)) {
      deleteCalendarEvent(id);
      if (selectedDateEvents) {
        setSelectedDateEvents({
          date: selectedDateEvents.date,
          events: selectedDateEvents.events.filter((e) => e.id !== id),
        });
      }
    }
  };

  // Broadcast Notice SMS to guardians
  const handleSendNoticeSMS = async () => {
    if (!smsModalEvent) return;
    setSmsSending(true);
    setSmsFeedback(null);

    const validStudents = students.filter((s) => s.guardianPhone && s.guardianPhone.trim().length >= 10);
    const dateText = smsModalEvent.endDate
      ? `${smsModalEvent.startDate} হতে ${smsModalEvent.endDate}`
      : smsModalEvent.startDate;

    const noticeText = `${schoolInfo.name}: সম্মানিত অভিভাবক, ${smsModalEvent.title} সংক্রান্ত বিজ্ঞপ্তি। তারিখ: ${dateText}। ${
      smsModalEvent.isSchoolClosed ? 'উক্ত সময়ে বিদ্যালয়ের নিয়মিত ক্লাস বন্ধ থাকবে।' : ''
    } বিস্তারিত জানতে বিদ্যালয়ে যোগাযোগ করুন। - প্রধান শিক্ষক।`;

    const smsItems = validStudents.slice(0, 50).map((std) => ({
      phone: std.guardianPhone!,
      text: noticeText,
      recipientName: `${std.nameBn} (অভিভাবক)`,
      roll: std.roll,
    }));

    try {
      const res = await sendBatchSMS(smsItems, 'notice');
      setSmsFeedback(`সফলভাবে ${toBengaliNumber(res.sentCount)} জন অভিভাবককে এসএমএস নোটিশ পাঠানো হয়েছে!`);
      setTimeout(() => {
        setSmsModalEvent(null);
        setSmsFeedback(null);
      }, 2500);
    } catch {
      setSmsFeedback('এসএমএস প্রেরণে ত্রুটি ঘটেছে।');
    } finally {
      setSmsSending(false);
    }
  };

  // Export Academic Calendar as CSV
  const handleExportCSV = () => {
    const header = ['শিরোনাম', 'ধরন', 'শুরুর তারিখ', 'সমাপ্তির তারিখ', 'স্কুল বন্ধ', 'স্থান', 'বিবরণ'];
    const rows = filteredEvents.map((evt) => [
      `"${evt.title.replace(/"/g, '""')}"`,
      EVENT_TYPE_LABELS[evt.type]?.label || evt.type,
      evt.startDate,
      evt.endDate || '',
      evt.isSchoolClosed ? 'হ্যাঁ' : 'না',
      `"${(evt.location || '').replace(/"/g, '""')}"`,
      `"${(evt.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [header.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `academic_calendar_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="no-print bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md">
              <CalendarDays className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 font-serif">
                  একাডেমিক ক্যালেন্ডার ও বার্ষিক সময়সূচি
                </h1>
                <span className="text-xs text-slate-500 font-medium">· শিক্ষাবর্ষ {selectedYear}</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500">
                পরীক্ষার তারিখ, সরকারি ও ধর্মীয় ছুটি, ফলাফল প্রকাশ এবং প্রাতিষ্ঠানিক অনুষ্ঠানসূচির সমন্বিত ক্যালেন্ডার
              </p>
            </div>
          </div>

          {/* Action Buttons & View Mode */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('month_grid')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center ${
                  viewMode === 'month_grid'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 mr-1.5" />
                মাসিক গ্রিড
              </button>
              <button
                type="button"
                onClick={() => setViewMode('agenda_list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center ${
                  viewMode === 'agenda_list'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5 mr-1.5" />
                সময়সূচি তালিকা
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition flex items-center"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              এক্সপোর্ট
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition flex items-center"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              প্রিন্ট
            </button>

            <button
              type="button"
              onClick={() => handleOpenAdd()}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition flex items-center"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              নতুন ইভেন্ট যোগ করুন
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Event Type Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center">
              <Filter className="w-3.5 h-3.5 mr-1" /> ফিল্টার:
            </span>
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                typeFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              সকল ({toBengaliNumber(calendarEvents.length)})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('exam')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                typeFilter === 'exam'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }`}
            >
              পরীক্ষা ({toBengaliNumber(calendarEvents.filter((e) => e.type === 'exam').length)})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('holiday')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                typeFilter === 'holiday'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              ছুটি ({toBengaliNumber(calendarEvents.filter((e) => e.type === 'holiday').length)})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('event')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                typeFilter === 'event'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              অনুষ্ঠান ({toBengaliNumber(calendarEvents.filter((e) => e.type === 'event').length)})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('meeting')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                typeFilter === 'meeting'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              সমাবেশ ({toBengaliNumber(calendarEvents.filter((e) => e.type === 'meeting').length)})
            </button>
            <button
              type="button"
              onClick={() => setTypeFilter('result')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                typeFilter === 'result'
                  ? 'bg-sky-600 text-white'
                  : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
              }`}
            >
              ফলাফল ({toBengaliNumber(calendarEvents.filter((e) => e.type === 'result').length)})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="ইভেন্ট বা বিষয় দিয়ে খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: MONTHLY CALENDAR GRID */}
      {/* ========================================================================= */}
      {viewMode === 'month_grid' && (
        <div className="space-y-6">
          {/* Month Controller Bar */}
          <div className="no-print bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                title="পূর্ববর্তী মাস"
                className="p-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center space-x-2">
                <select
                  value={currentMonth}
                  onChange={(e) => {
                    setCurrentMonth(parseInt(e.target.value, 10));
                    setSelectedDateEvents(null);
                  }}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {BENGALI_MONTHS.map((mo) => (
                    <option key={mo.value} value={mo.value}>
                      {mo.name}
                    </option>
                  ))}
                </select>

                <select
                  value={currentYear}
                  onChange={(e) => {
                    setCurrentYear(parseInt(e.target.value, 10));
                    setSelectedDateEvents(null);
                  }}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value={2026}>২০২৬</option>
                  <option value={2025}>২০২৫</option>
                  <option value={2027}>২০২৭</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                title="পরবর্তী মাস"
                className="p-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setCurrentYear(now.getFullYear());
                  setCurrentMonth(now.getMonth() + 1);
                  setSelectedDateEvents(null);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition"
              >
                চলতি মাস
              </button>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center space-x-4 text-xs">
              <span className="text-slate-600">
                এই মাসে ইভেন্ট: <strong className="text-slate-900">{toBengaliNumber(monthMetrics.total)} টি</strong>
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="text-indigo-700">
                পরীক্ষা: <strong>{toBengaliNumber(monthMetrics.exams)} টি</strong>
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="text-rose-700">
                ছুটি / বন্ধ: <strong>{toBengaliNumber(monthMetrics.closedDays)} দিন</strong>
              </span>
            </div>
          </div>

          {/* Main Calendar Grid */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Weekday Header */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center">
              {WEEKDAY_NAMES.map((day) => (
                <div
                  key={day.en}
                  className={`py-3 px-2 text-xs font-bold ${
                    day.isWeekend ? 'text-rose-600 bg-rose-50/50' : 'text-slate-700'
                  }`}
                >
                  <span>{day.bn}</span>
                  <span className="text-[10px] text-slate-400 block font-normal">{day.en}</span>
                </div>
              ))}
            </div>

            {/* Month Day Cells */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 border-b border-slate-100">
              {calendarGrid.map((day, idx) => {
                const hasEvents = day.events.length > 0;
                const hasHoliday = day.events.some((e) => e.type === 'holiday' || e.isSchoolClosed);
                const hasExam = day.events.some((e) => e.type === 'exam');

                return (
                  <div
                    key={`${day.dateStr}-${idx}`}
                    onClick={() => {
                      if (day.isCurrentMonth) {
                        setSelectedDateEvents({ date: day.dateStr, events: day.events });
                      }
                    }}
                    className={`min-h-[110px] p-1.5 sm:p-2.5 transition flex flex-col justify-between cursor-pointer group ${
                      !day.isCurrentMonth
                        ? 'bg-slate-50/50 text-slate-300'
                        : day.isToday
                        ? 'bg-amber-50/40 ring-2 ring-inset ring-amber-400'
                        : day.isFriday
                        ? 'bg-rose-50/20 hover:bg-rose-50/40'
                        : hasHoliday
                        ? 'bg-rose-50/30 hover:bg-rose-50/50'
                        : hasExam
                        ? 'bg-indigo-50/30 hover:bg-indigo-50/50'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    {/* Top Row: Date Number */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                          day.isToday
                            ? 'bg-amber-500 text-slate-950 font-black'
                            : day.isFriday
                            ? 'text-rose-600'
                            : day.isCurrentMonth
                            ? 'text-slate-700'
                            : 'text-slate-300'
                        }`}
                      >
                        {toBengaliNumber(day.dayNumber)}
                      </span>

                      {day.isCurrentMonth && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAdd(day.dateStr);
                          }}
                          title="এই তারিখে ইভেন্ট যোগ করুন"
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded text-slate-500 text-xs transition"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Middle: Event Chips */}
                    <div className="space-y-1 my-1 flex-1 overflow-hidden">
                      {day.events.slice(0, 2).map((evt) => (
                        <div
                          key={evt.id}
                          title={`${evt.title} (${EVENT_TYPE_LABELS[evt.type]?.label || evt.type})`}
                          className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium flex items-center border ${
                            EVENT_TYPE_LABELS[evt.type]?.color || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1 flex-shrink-0 ${
                              EVENT_TYPE_LABELS[evt.type]?.dotColor || 'bg-slate-500'
                            }`}
                          />
                          <span className="truncate">{evt.title}</span>
                        </div>
                      ))}

                      {day.events.length > 2 && (
                        <div className="text-[10px] font-bold text-indigo-600 pl-1">
                          +{toBengaliNumber(day.events.length - 2)} আরও...
                        </div>
                      )}
                    </div>

                    {/* Bottom: Holiday / Weekend Indicator */}
                    <div className="text-[9px] text-right">
                      {day.isFriday && day.isCurrentMonth && (
                        <span className="text-rose-400 font-medium">সাপ্তাহিক ছুটি</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Date Detail Drawer / Box */}
          {selectedDateEvents && (
            <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 animate-fade-in space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <CalendarCheck className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                    তারিখ: {selectedDateEvents.date} — ইভেন্ট ও সময়সূচি ({toBengaliNumber(selectedDateEvents.events.length)} টি)
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleOpenAdd(selectedDateEvents.date)}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    ইভেন্ট যোগ
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDateEvents(null)}
                    className="text-slate-400 hover:text-slate-700 text-sm font-bold px-2 py-1"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {selectedDateEvents.events.length === 0 ? (
                <p className="text-xs text-slate-500 py-3">এই তারিখে কোনো নির্ধারিত পরীক্ষা বা ছুটির ইভেন্ট নেই।</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedDateEvents.events.map((evt) => (
                    <div
                      key={evt.id}
                      className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-slate-900 text-sm">{evt.title}</h4>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                              EVENT_TYPE_LABELS[evt.type]?.color || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {EVENT_TYPE_LABELS[evt.type]?.label || evt.type}
                          </span>
                        </div>

                        {evt.isSchoolClosed && (
                          <div className="flex items-center text-rose-600 text-xs font-bold">
                            <AlertCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                            বিদ্যালয় বন্ধ / পাঠদান স্থগিত
                          </div>
                        )}

                        {evt.description && <p className="text-xs text-slate-600">{evt.description}</p>}
                        {evt.location && (
                          <div className="flex items-center text-[11px] text-slate-500">
                            <MapPin className="w-3 h-3 mr-1" />
                            {evt.location}
                          </div>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-400 text-[11px]">
                          {evt.endDate ? `${evt.startDate} হতে ${evt.endDate}` : evt.startDate}
                        </span>
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => setSmsModalEvent(evt)}
                            title="অভিভাবকদের নোটিশ এসএমএস পাঠান"
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(evt)}
                            title="সম্পাদনা"
                            className="p-1.5 hover:bg-slate-100 rounded text-indigo-600"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(evt.id, evt.title)}
                            title="মুছুন"
                            className="p-1.5 hover:bg-slate-100 rounded text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: AGENDA / LIST VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'agenda_list' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">
                বার্ষিক শিক্ষাপঞ্জি ও সময়সূচি তালিকা ({toBengaliNumber(filteredEvents.length)} টি ইভেন্ট)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => handleOpenAdd()}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              নতুন ইভেন্ট
            </button>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              কোনো ইভেন্ট পাওয়া যায়নি। &quot;নতুন ইভেন্ট যোগ করুন&quot; বাটনে ক্লিক করে ইভেন্ট তৈরি করুন।
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredEvents.map((evt) => {
                const isMulti = !!evt.endDate;
                return (
                  <div key={evt.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Date badge & Info */}
                    <div className="flex items-start space-x-4">
                      {/* Date Block */}
                      <div className="w-20 text-center bg-slate-100 p-2 rounded-xl border border-slate-200 flex-shrink-0">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          {evt.startDate.substring(0, 7)}
                        </span>
                        <span className="text-xl font-black text-slate-900 font-mono block">
                          {toBengaliNumber(parseInt(evt.startDate.split('-')[2], 10))}
                        </span>
                        {isMulti && (
                          <span className="text-[9px] font-bold text-indigo-600 block border-t border-slate-200 mt-1 pt-0.5">
                            হতে {toBengaliNumber(parseInt(evt.endDate!.split('-')[2], 10))}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-base">{evt.title}</h4>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                              EVENT_TYPE_LABELS[evt.type]?.color || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {EVENT_TYPE_LABELS[evt.type]?.label || evt.type}
                          </span>
                          {evt.isSchoolClosed && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 flex items-center">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              স্কুল বন্ধ
                            </span>
                          )}
                        </div>

                        {evt.description && (
                          <p className="text-xs text-slate-600 max-w-2xl">{evt.description}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                          <span>
                            তারিখ: <strong>{evt.startDate}</strong> {evt.endDate ? `হতে ${evt.endDate}` : ''}
                          </span>
                          {evt.location && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="flex items-center">
                                <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                {evt.location}
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>শিক্ষাবর্ষ: {evt.academicYear}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center space-x-2 self-end md:self-center">
                      <button
                        type="button"
                        onClick={() => setSmsModalEvent(evt)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center"
                        title="অভিভাবকদের এসএমএস নোটিশ পাঠান"
                      >
                        <Send className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                        এসএমএস নোটিশ
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(evt)}
                        className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg transition"
                        title="সম্পাদনা"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(evt.id, evt.title)}
                        className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition"
                        title="মুছুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PRINTABLE OFFICIAL ACADEMIC CALENDAR SHEET */}
      {/* ========================================================================= */}
      <div className="hidden print:block bg-white p-6">
        <div className="text-center pb-4 mb-4 border-b-2 border-slate-800">
          <div className="flex items-center justify-center space-x-3 mb-1">
            <SchoolLogo customLogoUrl={schoolInfo.logoUrl} size={48} />
            <div>
              <h2 className="text-2xl font-black text-slate-900 font-serif">{schoolInfo.name}</h2>
              <p className="text-xs text-slate-600">{schoolInfo.address}</p>
            </div>
          </div>
          <div className="inline-block mt-2 px-4 py-1 bg-slate-900 text-white text-sm font-bold rounded-md">
            বার্ষিক একাডেমিক ক্যালেন্ডার ও ছুটির তালিকা — {selectedYear}
          </div>
        </div>

        <table className="w-full text-xs border-collapse border border-slate-800 text-left">
          <thead>
            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-800">
              <th className="border border-slate-800 py-2 px-2 text-center w-10">ক্রমিক</th>
              <th className="border border-slate-800 py-2 px-3">ইভেন্ট ও ছুটির বিবরণ</th>
              <th className="border border-slate-800 py-2 px-3 text-center w-28">ধরন</th>
              <th className="border border-slate-800 py-2 px-3 text-center w-36">তারিখ</th>
              <th className="border border-slate-800 py-2 px-3 text-center w-20">স্কুল বন্ধ</th>
              <th className="border border-slate-800 py-2 px-3">স্থান / মন্তব্য</th>
            </tr>
          </thead>
          <tbody>
            {calendarEvents
              .sort((a, b) => a.startDate.localeCompare(b.startDate))
              .map((evt, idx) => (
                <tr key={evt.id} className="border-b border-slate-300">
                  <td className="border border-slate-800 py-1.5 px-2 text-center font-bold">
                    {toBengaliNumber(idx + 1)}
                  </td>
                  <td className="border border-slate-800 py-1.5 px-3 font-bold text-slate-900">
                    {evt.title}
                    {evt.description && <span className="block text-[11px] font-normal text-slate-600">{evt.description}</span>}
                  </td>
                  <td className="border border-slate-800 py-1.5 px-3 text-center">
                    {EVENT_TYPE_LABELS[evt.type]?.label || evt.type}
                  </td>
                  <td className="border border-slate-800 py-1.5 px-3 text-center font-mono">
                    {evt.endDate ? `${evt.startDate} হতে ${evt.endDate}` : evt.startDate}
                  </td>
                  <td className="border border-slate-800 py-1.5 px-3 text-center font-bold">
                    {evt.isSchoolClosed ? 'বন্ধ' : 'খোলা'}
                  </td>
                  <td className="border border-slate-800 py-1.5 px-3 text-slate-600">
                    {evt.location || '-'}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>

        {/* Signatures */}
        <div className="mt-12 pt-6 border-t border-slate-300 flex items-center justify-between text-xs text-slate-800">
          <div className="text-center">
            <div className="border-t border-slate-800 w-36 pt-1 font-bold">একাডেমিক কমিটির স্বাক্ষর</div>
          </div>
          <div className="text-center">
            <div className="border-t border-slate-800 w-36 pt-1 font-bold">প্রধান শিক্ষকের স্বাক্ষর ও সিল</div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT ACADEMIC EVENT */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <CalendarDays className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-base">
                  {editingEvent ? 'ইভেন্ট তথ্য সম্পাদনা করুন' : 'নতুন একাডেমিক ইভেন্ট যোগ করুন'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEvent} className="space-y-4 text-xs">
              {/* Event Title */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ইভেন্টের নাম / শিরোনাম <span className="text-rose-500">*</span>:
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: ২য় সাময়িক পরীক্ষা ২০২৬ / পবিত্র ঈদুল ফিতর ছুটি"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Event Type & School Closed */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ইভেন্টের ধরন:</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as CalendarEventType)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="exam">পরীক্ষা (Exam)</option>
                    <option value="holiday">সরকারি ও ধর্মীয় ছুটি (Holiday)</option>
                    <option value="event">অনুষ্ঠান ও ক্রীড়া (Event)</option>
                    <option value="meeting">অভিভাবক সমাবেশ (Meeting)</option>
                    <option value="result">ফলাফল প্রকাশ (Result)</option>
                    <option value="admission">ভর্তি কার্যক্রম (Admission)</option>
                  </select>
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center space-x-2 cursor-pointer font-bold text-rose-700">
                    <input
                      type="checkbox"
                      checked={formIsSchoolClosed}
                      onChange={(e) => setFormIsSchoolClosed(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>বিদ্যালয় বন্ধ / ক্লাস স্থগিত</span>
                  </label>
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-700">
                    শুরুর তারিখ <span className="text-rose-500">*</span>:
                  </label>
                  <label className="flex items-center space-x-1.5 text-xs text-indigo-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isMultiDay}
                      onChange={(e) => setIsMultiDay(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>একাধিক দিনের ইভেন্ট (তারিখ রেঞ্জ)</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />

                  {isMultiDay && (
                    <input
                      type="date"
                      placeholder="সমাপ্তির তারিখ"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  )}
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">স্থান / ভেন্যু (প্রযোজ্য ক্ষেত্রে):</label>
                <input
                  type="text"
                  placeholder="যেমন: বিদ্যালয় মিলনায়তন / সকল ক্লাসরুম / কেন্দ্রীয় খেলার মাঠ"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">বিস্তারিত বিবরণ ও নির্দেশিকা:</label>
                <textarea
                  rows={3}
                  placeholder="ইভেন্টের বিস্তারিত সময়সূচি, নিয়মাবলী বা প্রয়োজনীয় নির্দেশনা..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                ></textarea>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition"
                >
                  {editingEvent ? 'হালনাগাদ সংরক্ষণ' : 'ইভেন্ট যোগ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BROADCAST NOTICE SMS */}
      {/* ========================================================================= */}
      {smsModalEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <Send className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-base">নোটিশ এসএমএস ব্রডকাস্ট</h3>
              </div>
              <button
                type="button"
                onClick={() => setSmsModalEvent(null)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {smsFeedback && (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{smsFeedback}</span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                &quot;<strong>{smsModalEvent.title}</strong>&quot; সংক্রান্ত আনুষ্ঠানিক নোটিশ এসএমএস সকল অভিভাবকের ফোনে প্রেরণ করা হবে।
              </p>

              <div className="bg-slate-100 p-3 rounded-xl border border-slate-200 text-slate-800 font-serif leading-relaxed">
                <span className="font-bold text-slate-500 text-[10px] block mb-1">এসএমএস ড্রাফট প্রিভিউ:</span>
                {schoolInfo.name}: সম্মানিত অভিভাবক, {smsModalEvent.title} সংক্রান্ত বিজ্ঞপ্তি। তারিখ:{' '}
                {smsModalEvent.endDate ? `${smsModalEvent.startDate} হতে ${smsModalEvent.endDate}` : smsModalEvent.startDate}।{' '}
                {smsModalEvent.isSchoolClosed ? 'উক্ত সময়ে বিদ্যালয়ের নিয়মিত ক্লাস বন্ধ থাকবে।' : ''} বিস্তারিত জানতে বিদ্যালয়ে যোগাযোগ করুন। - প্রধান শিক্ষক।
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setSmsModalEvent(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={smsSending}
                onClick={handleSendNoticeSMS}
                className="inline-flex items-center px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md disabled:opacity-50 transition"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {smsSending ? 'পাঠানো হচ্ছে...' : 'নোটিশ এসএমএস পাঠান'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
