import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Compass,
  Home,
  Maximize2,
  Rocket,
  Sparkles,
  X,
} from 'lucide-react';
import { Student } from '../types';
import {
  DREAM_CAREER_PRESETS,
  matchCareerPresets,
} from '../data/dreamCareerGallery';
import { toBengaliNumber } from '../utils/bengali';

interface EcheDanaGalleryProps {
  student: Student;
  classNameBn: string;
  schoolName: string;
  dreamCareer: string;
  dailyStudyHoursGoal?: number;
  planSaveNotice?: string | null;
  onSelectDreamCareer: (careerTag: string) => void;
  onOpenMonerBari: () => void;
}

interface LightboxVisionItem {
  titleBn: string;
  careerTag: string;
  roleTitleBn?: string;
  captionBn: string;
  studyTipBn?: string;
  imageUrl: string;
  isCustomStudentAi?: boolean;
}

export const EcheDanaGallery: React.FC<EcheDanaGalleryProps> = ({
  student,
  classNameBn,
  schoolName,
  dreamCareer,
  dailyStudyHoursGoal = 3,
  planSaveNotice,
  onSelectDreamCareer,
  onOpenMonerBari,
}) => {
  const [selectedCareerFilter, setSelectedCareerFilter] = useState<string>('all');
  const [activeSpotlightCareer, setActiveSpotlightCareer] = useState<string>(
    dreamCareer || DREAM_CAREER_PRESETS[0].careerTag
  );
  const [lightboxItem, setLightboxItem] = useState<LightboxVisionItem | null>(null);
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, boolean>>({});

  // Sync spotlight when student changes or future plan career updates
  useEffect(() => {
    if (dreamCareer) {
      setActiveSpotlightCareer(dreamCareer);
    }
  }, [dreamCareer, student.id]);

  // Close Lightbox on ESC
  useEffect(() => {
    if (!lightboxItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxItem]);

  const orderedPresets = useMemo(
    () => matchCareerPresets(activeSpotlightCareer),
    [activeSpotlightCareer]
  );

  const heroPreset = orderedPresets[0] || DREAM_CAREER_PRESETS[0];

  const filteredGridPresets = useMemo(() => {
    if (selectedCareerFilter === 'all') {
      return orderedPresets;
    }
    return DREAM_CAREER_PRESETS.filter((p) => p.careerTag === selectedCareerFilter);
  }, [orderedPresets, selectedCareerFilter]);

  const handleImageError = (url: string) => {
    setFailedImageUrls((prev) => ({ ...prev, [url]: true }));
  };

  const customPhotos = student.dreamGallery || [];

  return (
    <div className="space-y-6">
      {/* Editorial Gallery Header */}
      <header className="bg-[#091e42] text-white rounded-2xl border border-slate-800 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-amber-300 font-semibold">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>ইচ্ছে ডানা</span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span>ভবিষ্যতের নিজেকে দেখার আয়না</span>
            <span aria-hidden="true" className="text-slate-500">·</span>
            <span className="text-emerald-300">{student.nameBn}</span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-bold font-serif text-white tracking-tight">
            নিজেকে স্বপ্নের উচ্চতায় কল্পনা করো
          </h3>

          <p className="text-sm text-slate-300 leading-relaxed">
            বড় হয়ে তুমি যা হতে চাও—সেই স্বপ্নের পোশাক ও কর্মক্ষেত্রে নিজেকে প্রতিদিন একবার দেখো। এই আত্মবিশ্বাসই তোমাকে সেই লক্ষ্যে পৌঁছে দেবে।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenMonerBari}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Home className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>মনের বাড়ি</span>
          </button>
        </div>
      </header>

      {/* Interactive Career Filter & Goal Selector Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-700">
            <Compass className="w-4 h-4 text-indigo-700 shrink-0" />
            <span className="font-bold text-slate-900">ভবিষ্যৎ ক্যারিয়ার ভিশন গ্যালারি</span>
            <span aria-hidden="true" className="text-slate-400">·</span>
            <span>
              বর্তমান লক্ষ্য: <strong className="text-indigo-800">{dreamCareer}</strong>
            </span>
          </div>

          {heroPreset.careerTag !== dreamCareer && (
            <button
              type="button"
              onClick={() => onSelectDreamCareer(heroPreset.careerTag)}
              className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer whitespace-nowrap shrink-0"
            >
              &ldquo;{heroPreset.shortLabelBn}&rdquo; আমার স্বপ্ন হিসেবে সেট করুন
            </button>
          )}
        </div>

        {planSaveNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{planSaveNotice}</span>
          </div>
        )}

        {/* Segmented Interactive Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit max-w-full overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedCareerFilter('all')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
              selectedCareerFilter === 'all'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-950'
            }`}
          >
            সবগুলো পেশা ({toBengaliNumber(DREAM_CAREER_PRESETS.length)})
          </button>

          {DREAM_CAREER_PRESETS.map((preset) => {
            const isActiveFilter = selectedCareerFilter === preset.careerTag;
            return (
              <button
                key={preset.careerTag}
                type="button"
                onClick={() => {
                  setSelectedCareerFilter(preset.careerTag);
                  setActiveSpotlightCareer(preset.careerTag);
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  isActiveFilter
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {preset.shortLabelBn}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Custom Student-Specific AI Gallery Portraits (From Developer Station) */}
      {customPhotos.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-lg font-bold text-slate-900 font-serif">
              {student.nameBn}-এর বিশেষ AI স্বপ্ন-ছবি ({toBengaliNumber(customPhotos.length)}টি)
            </h4>
            <span className="text-xs text-slate-500">
              বিদ্যালয় ডেভেলপার স্টেশন থেকে নির্মিত ব্যক্তিগত সংগ্রহ
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {customPhotos.map((item) => {
              const isBroken = failedImageUrls[item.imageUrl];
              return (
                <article
                  key={item.id}
                  onClick={() =>
                    setLightboxItem({
                      titleBn: item.titleBn,
                      careerTag: item.careerTag,
                      captionBn:
                        item.captionBn ||
                        'প্রতিদিন নিজেকে এই উচ্চতায় কল্পনা করো এবং নিষ্ঠার সাথে পড়াশোনা করো।',
                      imageUrl: item.imageUrl,
                      isCustomStudentAi: true,
                    })
                  }
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden cursor-pointer group hover:border-indigo-400 transition flex flex-col justify-between"
                >
                  <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden">
                    {isBroken ? (
                      <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center p-4 text-center text-slate-300 space-y-2">
                        <Rocket className="w-8 h-8 text-amber-300" />
                        <span className="text-xs font-semibold">{item.titleBn}</span>
                      </div>
                    ) : (
                      <img
                        src={item.imageUrl}
                        alt={item.titleBn}
                        onError={() => handleImageError(item.imageUrl)}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                        referrerPolicy="no-referrer"
                      />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex flex-col justify-end p-4 text-white">
                      <div className="text-[11px] font-semibold text-amber-300">
                        {item.careerTag}
                      </div>
                      <div className="text-base font-bold font-serif leading-snug">
                        {item.titleBn}
                      </div>
                    </div>

                    <div className="absolute top-3 right-3 p-2 bg-slate-950/70 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {item.captionBn && (
                    <div className="p-4 text-xs text-slate-600 leading-relaxed">
                      {item.captionBn}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* 2. Featured Career Spotlight (2-Column Editorial Split) */}
      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div
          onClick={() =>
            setLightboxItem({
              titleBn: `ভবিষ্যতের ${heroPreset.shortLabelBn} — ${student.nameBn}`,
              careerTag: heroPreset.careerTag,
              roleTitleBn: heroPreset.roleTitleBn,
              captionBn: heroPreset.quoteBn,
              studyTipBn: heroPreset.studyTipBn,
              imageUrl: heroPreset.imageUrl,
            })
          }
          className="lg:col-span-7 relative min-h-[260px] lg:min-h-[340px] bg-slate-900 overflow-hidden cursor-pointer group"
        >
          {failedImageUrls[heroPreset.imageUrl] ? (
            <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center p-6 text-center text-slate-200 space-y-2">
              <Rocket className="w-10 h-10 text-amber-300" />
              <div className="text-lg font-bold font-serif">{heroPreset.headlineBn}</div>
            </div>
          ) : (
            <img
              src={heroPreset.imageUrl}
              alt={`${heroPreset.headlineBn} — ${student.nameBn}`}
              onError={() => handleImageError(heroPreset.imageUrl)}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
              referrerPolicy="no-referrer"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex flex-col justify-end p-5 text-white">
            <div className="text-xs font-medium text-amber-300">
              {heroPreset.careerTag} · {heroPreset.roleTitleBn}
            </div>
          </div>

          <div className="absolute top-3 right-3 p-2 bg-slate-950/75 text-white rounded-lg">
            <Maximize2 className="w-4 h-4" />
          </div>
        </div>

        <div className="lg:col-span-5 p-6 sm:p-7 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-indigo-700">
              <span>নির্বাচিত লক্ষ্য</span>
              <span aria-hidden="true" className="text-slate-400">·</span>
              <span>{heroPreset.careerTag}</span>
            </div>

            <h4 className="text-xl sm:text-2xl font-bold text-slate-900 font-serif leading-snug">
              ভবিষ্যতের {heroPreset.shortLabelBn} — {student.nameBn}
            </h4>

            <p className="text-sm text-slate-600 leading-relaxed font-serif">
              &ldquo;{heroPreset.quoteBn}&rdquo;
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3 text-xs">
            <div>
              <div className="font-bold text-slate-800 mb-1">
                লক্ষ্যে পৌঁছাতে আজকের করণীয় ({toBengaliNumber(dailyStudyHoursGoal)} ঘণ্টা দৈনিক অধ্যয়ন):
              </div>
              <p className="text-slate-600 leading-relaxed">{heroPreset.studyTipBn}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {heroPreset.careerTag === dreamCareer ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>এটি বর্তমানে তোমার প্রধান স্বপ্ন হিসেবে সেট আছে</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelectDreamCareer(heroPreset.careerTag)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  এটি আমার প্রধান স্বপ্ন সেট করো
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. AI-Generated Career Vision Grid */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-lg font-bold text-slate-900 font-serif">
            সকল স্বপ্নের পেশা ও ভবিষ্যৎ ভিশন ({toBengaliNumber(filteredGridPresets.length)}টি)
          </h4>
          <span className="text-xs text-slate-500">
            যেকোনো ছবিতে ক্লিক করে বড় করে দেখো অথবা নিজের লক্ষ্য হিসেবে বেছে নাও
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGridPresets.map((preset) => {
            const isCurrentDream = preset.careerTag === dreamCareer;
            const isBroken = failedImageUrls[preset.imageUrl];
            return (
              <article
                key={preset.careerTag}
                className={`bg-white rounded-2xl border overflow-hidden transition flex flex-col justify-between ${
                  isCurrentDream
                    ? 'border-emerald-500 shadow-sm'
                    : 'border-slate-200 hover:border-slate-400'
                }`}
              >
                <div
                  onClick={() => {
                    setActiveSpotlightCareer(preset.careerTag);
                    setLightboxItem({
                      titleBn: `ভবিষ্যতের ${preset.shortLabelBn} — ${student.nameBn}`,
                      careerTag: preset.careerTag,
                      roleTitleBn: preset.roleTitleBn,
                      captionBn: preset.quoteBn,
                      studyTipBn: preset.studyTipBn,
                      imageUrl: preset.imageUrl,
                    });
                  }}
                  className="cursor-pointer group"
                >
                  <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden">
                    {isBroken ? (
                      <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center p-4 text-center text-slate-300 space-y-2">
                        <Rocket className="w-8 h-8 text-amber-300" />
                        <span className="text-xs font-semibold">{preset.headlineBn}</span>
                      </div>
                    ) : (
                      <img
                        src={preset.imageUrl}
                        alt={preset.headlineBn}
                        onError={() => handleImageError(preset.imageUrl)}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="absolute top-3 right-3 p-1.5 bg-slate-950/70 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize2 className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-indigo-700">{preset.shortLabelBn}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{preset.roleTitleBn}</span>
                    </div>

                    <h5 className="text-base font-bold text-slate-900 font-serif leading-snug">
                      {preset.headlineBn}
                    </h5>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {preset.quoteBn}
                    </p>
                  </div>
                </div>

                <div className="px-4 sm:px-5 pb-4 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSpotlightCareer(preset.careerTag);
                      setLightboxItem({
                        titleBn: `ভবিষ্যতের ${preset.shortLabelBn} — ${student.nameBn}`,
                        careerTag: preset.careerTag,
                        roleTitleBn: preset.roleTitleBn,
                        captionBn: preset.quoteBn,
                        studyTipBn: preset.studyTipBn,
                        imageUrl: preset.imageUrl,
                      });
                    }}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-950 cursor-pointer whitespace-nowrap"
                  >
                    বড় করে দেখো →
                  </button>

                  {isCurrentDream ? (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 whitespace-nowrap">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>তোমার স্বপ্ন</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSpotlightCareer(preset.careerTag);
                        onSelectDreamCareer(preset.careerTag);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-amber-400 text-slate-800 hover:text-slate-950 text-xs font-bold rounded-lg transition cursor-pointer whitespace-nowrap shrink-0"
                    >
                      স্বপ্ন বেছে নাও
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Fullscreen Lightbox Viewer */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4"
          onClick={() => setLightboxItem(null)}
          role="dialog"
          aria-modal="true"
          aria-label={lightboxItem.titleBn}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 gap-4">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-indigo-700 flex flex-wrap items-center gap-2">
                  <span>{lightboxItem.careerTag}</span>
                  {lightboxItem.roleTitleBn && (
                    <>
                      <span aria-hidden="true" className="text-slate-400">·</span>
                      <span className="text-slate-600">{lightboxItem.roleTitleBn}</span>
                    </>
                  )}
                </div>
                <div className="text-sm sm:text-base font-bold text-slate-900 font-serif truncate">
                  {lightboxItem.titleBn}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                aria-label="Close"
                className="p-2 rounded-lg text-slate-500 hover:text-slate-950 hover:bg-slate-100 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 max-h-[60vh] flex items-center justify-center overflow-hidden">
              {failedImageUrls[lightboxItem.imageUrl] ? (
                <div className="py-20 px-6 text-center text-slate-200 space-y-2">
                  <Rocket className="w-10 h-10 text-amber-300 mx-auto" />
                  <div className="text-base font-bold font-serif">{lightboxItem.titleBn}</div>
                </div>
              ) : (
                <img
                  src={lightboxItem.imageUrl}
                  alt={lightboxItem.titleBn}
                  onError={() => handleImageError(lightboxItem.imageUrl)}
                  className="max-h-[60vh] w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>

            <div className="p-5 space-y-3 text-xs sm:text-sm">
              <p className="text-slate-800 font-serif text-base leading-relaxed">
                &ldquo;{lightboxItem.captionBn}&rdquo;
              </p>

              {lightboxItem.studyTipBn && (
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong className="text-slate-800">প্রস্তুতি টিপস: </strong>
                  {lightboxItem.studyTipBn}
                </p>
              )}

              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  {student.nameBn} · {classNameBn} · {schoolName}
                </span>

                {!lightboxItem.isCustomStudentAi && lightboxItem.careerTag !== dreamCareer && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDreamCareer(lightboxItem.careerTag);
                      setLightboxItem(null);
                    }}
                    className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer whitespace-nowrap"
                  >
                    &ldquo;{lightboxItem.careerTag}&rdquo; আমার স্বপ্ন সেট করুন
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
