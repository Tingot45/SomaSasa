import React, { useState, useEffect } from "react";
import { Users, FileText, CheckCircle2, TrendingUp, Sparkles } from "lucide-react";
import { TeacherAnalytics } from "../types.ts";

interface TeacherAnalyticsViewProps {
  token: string;
}

export default function TeacherAnalyticsView({ token }: TeacherAnalyticsViewProps) {
  const [analytics, setAnalytics] = useState<TeacherAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [token]);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch("/api/teacher/analytics", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Failed to load teacher analytics", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-100 border-t-indigo-600" />
      </div>
    );
  }

  const stats = analytics?.stats || { studentsCount: 0, lessonsCount: 0, materialsCount: 0 };
  const performance = analytics?.studentPerformance || [];

  return (
    <div className="space-y-6">
      {/* Cards stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total Students */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
              Active Students
            </span>
            <h3 className="text-2xl font-black text-slate-800 mt-0.5">{stats.studentsCount}</h3>
          </div>
        </div>

        {/* Uploaded Materials */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
              Study Sources
            </span>
            <h3 className="text-2xl font-black text-slate-800 mt-0.5">{stats.materialsCount}</h3>
          </div>
        </div>

        {/* Lessons generated */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Sparkles className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
              Generated Study Packs
            </span>
            <h3 className="text-2xl font-black text-slate-800 mt-0.5">{stats.lessonsCount}</h3>
          </div>
        </div>
      </div>

      {/* Table performance summary */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Student Progress Log</h3>
            <p className="text-xs text-slate-500 mt-0.5">Track individual learner lessons completed and quiz score averages</p>
          </div>
          <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            Active engagement
          </span>
        </div>

        {performance.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            No student study logs or quiz results registered yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-150 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3 px-4">Student Email</th>
                  <th className="py-3 px-4 text-center">Lessons Mastered</th>
                  <th className="py-3 px-4 text-center">Average Quiz Score</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {performance.map((p, idx) => {
                  const scoreVal = p.avgScore ? Math.round(parseFloat(p.avgScore)) : null;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/30 transition">
                      <td className="py-3.5 px-4 font-semibold text-slate-800">{p.studentEmail}</td>
                      <td className="py-3.5 px-4 text-center text-slate-600 font-medium">
                        {p.completedCount} lessons
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {scoreVal !== null ? (
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            scoreVal >= 80 ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"
                          }`}>
                            {scoreVal}%
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">No quizzes taken</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50/50 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Active
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
