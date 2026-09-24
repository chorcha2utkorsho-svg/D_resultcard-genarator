/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { SchoolProvider, useSchool } from './context/SchoolContext';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { MarkEntryView } from './components/MarkEntryView';
import { ResultsView } from './components/ResultsView';
import { TabulationSheet } from './components/TabulationSheet';
import { StudentManagement } from './components/StudentManagement';
import { SyllabusView } from './components/SyllabusView';
import { QuestionPaperGenerator } from './components/QuestionPaperGenerator';
import { NotesView } from './components/NotesView';
import { BackupSettingsModal } from './components/BackupSettingsModal';

function MainContent() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const { schoolInfo } = useSchool();

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      {/* Global Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8">
        {currentTab === 'dashboard' && (
          <DashboardView
            onNavigate={(tab) => setCurrentTab(tab)}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}

        {currentTab === 'marks_entry' && <MarkEntryView />}

        {currentTab === 'results' && <ResultsView />}

        {currentTab === 'tabulation' && <TabulationSheet />}

        {currentTab === 'students' && <StudentManagement />}

        {currentTab === 'syllabus' && <SyllabusView />}

        {currentTab === 'question_papers' && <QuestionPaperGenerator />}

        {currentTab === 'notes' && <NotesView />}
      </main>

      {/* Settings & Backup Modal */}
      <BackupSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Responsive Footer */}
      <footer className="no-print bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p className="font-bold text-slate-700 font-serif">
            {schoolInfo.name || 'ডি-লিকন মডেল একাডেমী'}
          </p>
          <p>{schoolInfo.address} | হটলাইন: {schoolInfo.phone}</p>
          <p className="text-[11px] text-slate-400 pt-1">
            ডিজিটাল রেজাল্ট প্রসেসিং ও স্কুল ম্যানেজমেন্ট সিস্টেম • ডেস্কটপ ও স্মার্টফোন কম্প্যাটিবল
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <SchoolProvider>
      <MainContent />
    </SchoolProvider>
  );
}
