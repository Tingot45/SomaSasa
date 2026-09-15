import React, { useState } from "react";
import { Check, AlertTriangle, Edit3, Save, MessageSquare, BookOpen, Eye } from "lucide-react";

interface Lesson {
  id: number;
  title: string;
  subject: string;
  grade: number;
  topic: string;
  content: string;
  analogy: string;
  diagramCode: string | null;
  status?: string;
  feedbackText?: string | null;
  suggestedEdits?: string | null;
}

interface TeacherFeedbackProps {
  lessons: Lesson[];
  token: string | null;
  onRefresh: () => void;
}

export default function TeacherFeedback({ lessons, token, onRefresh }: TeacherFeedbackProps) {
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Editable fields state
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editAnalogy, setEditAnalogy] = useState("");
  const [editDiagramCode, setEditDiagramCode] = useState("");

  // Feedback comment state
  const [feedbackText, setFeedbackText] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSelectLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setEditTitle(lesson.title);
    setEditContent(lesson.content);
    setEditAnalogy(lesson.analogy);
    setEditDiagramCode(lesson.diagramCode);
    setFeedbackText(lesson.feedbackText || "");
    setIsEditing(false);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleReviewAction = async (status: "approved" | "flagged") => {
    if (!token || !selectedLesson) return;
    setActionLoading(true);

    try {
      // Package any direct manual overrides if teacher has altered text fields
      const updatedFields = isEditing ? {
        title: editTitle,
        content: editContent,
        analogy: editAnalogy,
        diagramCode: editDiagramCode,
      } : undefined;

      const res = await fetch(`/api/teacher/lessons/${selectedLesson.id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status,
          feedbackText: status === "flagged" ? feedbackText : undefined,
          suggestedEdits: isEditing ? "Direct teacher edit and save" : selectedLesson.suggestedEdits,
          updatedFields,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(status === "approved" ? "Lesson approved & published successfully!" : "Lesson flagged with feedback!");
        setSelectedLesson(data.lesson);
        setIsEditing(false);
        onRefresh();
      } else {
        const err = await res.json();
        showToast(`Failed: ${err.error || "Could not complete review"}`);
      }
    } catch (err) {
      console.error("Failed to submit review:", err);
      showToast("Network error submitting review.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Toast popup */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg border border-slate-800 animate-slide-up">
          {toastMessage}
        </div>
      )}

      {/* Lesson List Column */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-base font-black text-slate-950">AI Content Moderation Desk</h3>
          <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
            Review, modify, flag, or approve AI-generated lessons before publication.
          </p>
        </div>

        <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
          {lessons.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs font-medium">
              No lessons generated to review yet.
            </div>
          ) : (
            lessons.map((l) => {
              const isSelected = selectedLesson?.id === l.id;
              return (
                <button
                  key={l.id}
                  onClick={() => handleSelectLesson(l)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition flex flex-col gap-2 ${
                    isSelected
                      ? "bg-indigo-50/50 border-indigo-200"
                      : "bg-slate-50/10 border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                      Grade {l.grade} • {l.subject}
                    </span>
                    <span
                      className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-md ${
                        l.status === "approved"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : l.status === "flagged"
                          ? "bg-rose-50 text-rose-700 border border-rose-100"
                          : "bg-amber-50 text-amber-700 border border-amber-100"
                      }`}
                    >
                      {l.status}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 leading-tight">{l.title}</h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">Topic: {l.topic}</p>
                  </div>
                  {l.feedbackText && (
                    <div className="mt-1 text-[10px] text-rose-600 bg-rose-50/50 p-1.5 rounded-lg border border-rose-100/50 italic font-medium">
                      Flag: "{l.feedbackText}"
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Reviewer detail Column */}
      <div className="lg:col-span-2">
        {!selectedLesson ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-sm h-full flex flex-col items-center justify-center space-y-3">
            <BookOpen className="h-12 w-12 text-slate-300" />
            <h4 className="text-sm font-extrabold text-slate-800">No Lesson Selected</h4>
            <p className="text-xs text-slate-400 max-w-sm leading-relaxed font-medium">
              Click on any generated study package in the left-hand column to view its detailed AI text, analogy, vector diagram, and edit or moderate it.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Reviewing AI Material
                </span>
                <h3 className="text-lg font-black text-slate-950 mt-1">{selectedLesson.title}</h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`text-xs font-bold px-3.5 py-2 rounded-xl transition inline-flex items-center gap-1.5 ${
                    isEditing
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  <Edit3 className="h-4 w-4" />
                  {isEditing ? "Viewing Mode" : "Modify Content"}
                </button>
              </div>
            </div>

            {/* Editing Panel vs View Panel */}
            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-600">Lesson Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none text-xs font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-600">Lesson Content Paragraphs</label>
                  <textarea
                    rows={12}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none text-xs leading-relaxed font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-600">Kenyan Context Analogy</label>
                  <textarea
                    rows={4}
                    value={editAnalogy}
                    onChange={(e) => setEditAnalogy(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none text-xs font-medium leading-relaxed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-extrabold text-slate-600">SVG Infographic Diagram Code</label>
                  <textarea
                    rows={8}
                    value={editDiagramCode}
                    onChange={(e) => setEditDiagramCode(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none text-xs font-mono"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Lesson text */}
                <div className="prose prose-slate max-w-none text-slate-700 text-xs leading-relaxed space-y-4 max-h-[300px] overflow-y-auto border border-slate-100 p-4 rounded-xl bg-slate-50/30">
                  {editContent.split("\n\n").map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>

                {/* Analogy & Diagram */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <h5 className="text-xs font-extrabold text-amber-900 uppercase tracking-wide flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      Analogical Connection
                    </h5>
                    <p className="text-xs text-amber-800 leading-relaxed mt-2 font-medium">
                      {editAnalogy}
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center bg-slate-50/50">
                    <h5 className="text-xs font-extrabold text-slate-700 flex items-center gap-1 mb-2 self-start">
                      <Eye className="h-3.5 w-3.5 text-indigo-600" />
                      Visual Diagram Previews
                    </h5>
                    {editDiagramCode ? (
                      <div
                        className="w-full max-h-[140px] overflow-hidden flex items-center justify-center rounded border border-slate-150 bg-white p-2"
                        dangerouslySetInnerHTML={{ __html: editDiagramCode }}
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold">No SVG code generated</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Direct Moderate Desk controls */}
            <div className="border-t border-slate-100 pt-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-600 flex items-center gap-1">
                  <MessageSquare className="h-4 w-4 text-rose-500" />
                  Teacher's Flag Comments (Only required if flagging for revision)
                </label>
                <input
                  type="text"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="e.g., Explanation on step 3 needs more focus on Kisumu port examples, update SVG colors to blue..."
                  className="w-full p-3 border border-slate-200 rounded-xl focus:border-rose-400 focus:outline-none text-xs placeholder:text-slate-400 font-medium"
                />
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-2">
                <button
                  onClick={() => handleReviewAction("flagged")}
                  disabled={actionLoading}
                  className="w-full md:w-auto px-5 py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition border border-rose-200/50 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <AlertTriangle className="h-4 w-4" />
                  {actionLoading ? "Processing..." : "Flag for AI Revision"}
                </button>

                <button
                  onClick={() => handleReviewAction("approved")}
                  disabled={actionLoading}
                  className="w-full md:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  {actionLoading ? "Processing..." : "Save, Approve & Publish"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
