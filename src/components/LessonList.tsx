import React from "react";
import { BookOpen, Award, ArrowRight, Play, CheckCircle2, Download, Trash2 } from "lucide-react";
import { DbLesson } from "../types.ts";

interface LessonListProps {
  lessons: DbLesson[];
  completedLessonIds: Set<number>;
  onSelect: (lesson: DbLesson) => void;
  downloadedLessonIds?: Set<number>;
  onDownload?: (lesson: DbLesson, e: React.MouseEvent) => void;
  onDeleteDownload?: (lessonId: number, e: React.MouseEvent) => void;
  isOnline?: boolean;
}

export default function LessonList({
  lessons,
  completedLessonIds,
  onSelect,
  downloadedLessonIds = new Set(),
  onDownload,
  onDeleteDownload,
  isOnline = true,
}: LessonListProps) {
  if (lessons.length === 0) {
    return (
      <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl p-6">
        <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
        <h4 className="text-sm font-bold text-slate-700">No Study Packs Generated Yet</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Teachers haven't generated study content for this subject and grade combination. Switch to the Teacher dashboard to upload study materials and generate AI study packs instantly!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {lessons.map((lesson) => {
        const isCompleted = completedLessonIds.has(lesson.id);
        const isDownloaded = downloadedLessonIds.has(lesson.id);

        return (
          <div
            key={lesson.id}
            onClick={() => onSelect(lesson)}
            className="group cursor-pointer bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition duration-300 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-[10px] uppercase font-black tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                  {lesson.subject}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-black tracking-wider text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                    Grade {lesson.grade}
                  </span>
                  {isDownloaded && (
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                      Offline Ready
                    </span>
                  )}
                </div>
              </div>

              <h4 className="text-base font-extrabold text-slate-800 line-clamp-1 group-hover:text-indigo-700 transition">
                {lesson.title}
              </h4>
              <p className="text-xs text-slate-400 font-semibold mt-1">Topic: {lesson.topic}</p>

              {/* Lesson snippet */}
              <p className="text-xs text-slate-500 mt-2.5 line-clamp-2 leading-relaxed">
                {lesson.content.replace(/<[^>]*>/g, "").replace(/[#*`_]/g, "")}
              </p>
            </div>

            <div className="border-t border-slate-100 pt-3.5 mt-4.5 flex items-center justify-between">
              {/* Completed check / Play button */}
              <div className="flex items-center gap-1.5 text-xs">
                {isCompleted ? (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    Completed
                  </span>
                ) : (
                  <span className="text-slate-400 font-semibold flex items-center gap-1">
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Not started
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Offline download buttons */}
                {onDownload && onDeleteDownload && (
                  <div className="flex items-center">
                    {isDownloaded ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDownload(lesson.id, e);
                        }}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                        title="Remove offline copy"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isOnline) onDownload(lesson, e);
                        }}
                        className={`p-1.5 rounded-lg transition ${
                          isOnline
                            ? "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                            : "text-slate-300 cursor-not-allowed"
                        }`}
                        title={isOnline ? "Download for Offline Study" : "Connect to internet to download"}
                        disabled={!isOnline}
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}

                <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition flex items-center gap-1">
                  Study Now
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
