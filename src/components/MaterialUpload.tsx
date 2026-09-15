import React, { useState, useEffect } from "react";
import { Upload, BookOpen, AlertCircle, Sparkles, Trash2, CheckCircle } from "lucide-react";
import { DbMaterial } from "../types.ts";

interface MaterialUploadProps {
  onGenerateSuccess: () => void;
  token: string;
}

const KENYAN_SUBJECTS = [
  "Mathematics",
  "Science & Technology",
  "English",
  "Kiswahili",
  "Social Studies",
  "Creative Arts",
];

const GRADES = [4, 5, 6, 7, 8, 9, 10];

export default function MaterialUpload({ onGenerateSuccess, token }: MaterialUploadProps) {
  const [materials, setMaterials] = useState<DbMaterial[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Mathematics");
  const [grade, setGrade] = useState("7");
  const [pastedContent, setPastedContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Generation state
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [topicPrompt, setTopicPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const generationSteps = [
    "Opening study materials and reading chapters...",
    "Aligning topics with Kenyan Competency Based Curriculum (CBC) standard guidelines...",
    "Synthesizing detailed lesson body (word count: 600 - 1,200 words)...",
    "Engaging Gemini visual artist to design responsive SVG educational diagrams...",
    "Converting summaries into high-fidelity teacher-style audio lecture scripts...",
    "Recording classroom audio narration using prebuilt voice TTS synthesizers...",
    "Orchestrating interactive practice questions, flashcards, and quizzes...",
    "Saving study pack to database. Preparing dashboard panels...",
  ];

  useEffect(() => {
    fetchMaterials();
  }, [token]);

  const fetchMaterials = async () => {
    try {
      const res = await fetch("/api/materials", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMaterials(data);
        if (data.length > 0 && !selectedMaterialId) {
          setSelectedMaterialId(data[0].id.toString());
        }
      }
    } catch (err) {
      console.error("Failed to load materials", err);
    }
  };

  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title) {
      setError("Document title is required.");
      return;
    }

    if (!pastedContent && !selectedFile) {
      setError("Please paste textbook content or upload a document file.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title);
    formData.append("subject", subject);
    formData.append("grade", grade);

    if (selectedFile) {
      formData.append("file", selectedFile);
    } else {
      formData.append("pastedContent", pastedContent);
    }

    try {
      const res = await fetch("/api/materials/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        setSuccess("Study material uploaded and parsed successfully!");
        setTitle("");
        setPastedContent("");
        setSelectedFile(null);
        // Reset file input
        const fileInput = document.getElementById("file-input") as HTMLInputElement;
        if (fileInput) fileInput.value = "";

        fetchMaterials();
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to upload study material.");
      }
    } catch (err) {
      setError("Server connection lost. Please try again.");
    }
  };

  const handleDeleteMaterial = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this study material?")) return;
    try {
      const res = await fetch(`/api/materials/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchMaterials();
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  // Run the beautiful timed progress loops during Gemini synthesis
  const triggerLessonGeneration = async () => {
    if (!selectedMaterialId || !topicPrompt) {
      setError("Please select a study document and enter a specific topic/subtopic.");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsGenerating(true);
    setGenerationStep(0);

    // Dynamic fake step ticking
    const stepInterval = setInterval(() => {
      setGenerationStep((prev) => {
        if (prev < generationSteps.length - 2) {
          return prev + 1;
        }
        return prev;
      });
    }, 4500);

    try {
      const res = await fetch("/api/lessons/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          materialId: selectedMaterialId,
          topic: topicPrompt,
        }),
      });

      clearInterval(stepInterval);

      if (res.ok) {
        setGenerationStep(generationSteps.length - 1); // final step
        setTimeout(() => {
          setIsGenerating(false);
          setSuccess(`Study Pack for "${topicPrompt}" synthesized perfectly!`);
          setTopicPrompt("");
          onGenerateSuccess();
        }, 1500);
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to generate lesson content.");
        setIsGenerating(false);
      }
    } catch (err) {
      clearInterval(stepInterval);
      setError("Content generation request timed out or server disconnected.");
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Upload study document */}
      <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <BookOpen className="h-5 w-5 text-indigo-600" />
          Add Study Material
        </h3>

        <form onSubmit={handleUploadMaterial} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Material / Chapter Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unit 3: Fractions & Decimals"
              className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Subject
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none"
              >
                {KENYAN_SUBJECTS.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Grade Level
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Bulk Upload Document
            </label>
            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-2xl p-4 text-center transition cursor-pointer relative bg-slate-50/50">
              <input
                id="file-input"
                type="file"
                accept=".txt,.pdf,.docx,.pptx"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="h-6 w-6 text-slate-400 mx-auto mb-2" />
              <p className="text-xs text-slate-600 font-bold">
                {selectedFile ? selectedFile.name : "Select or Drop PDF, DOCX, PPTX, TXT"}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Maximum size 10MB</p>
            </div>
          </div>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-150"></div>
            <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 uppercase">OR</span>
            <div className="flex-grow border-t border-slate-150"></div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Paste Textbook Text
            </label>
            <textarea
              value={pastedContent}
              onChange={(e) => setPastedContent(e.target.value)}
              placeholder="Paste textbook sections, curriculum topics, or study guides here directly..."
              rows={5}
              className="w-full text-sm p-3 border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none resize-none font-sans"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-sm"
          >
            Submit Material Source
          </button>
        </form>
      </div>

      {/* Synthesis Panel */}
      <div className="lg:col-span-2 space-y-6">
        {/* Gemini Generator form */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-100 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-indigo-600 animate-spin" />
            <h3 className="text-lg font-black text-indigo-900">Synthesize AI Study Pack</h3>
          </div>
          <p className="text-xs text-indigo-700 leading-relaxed max-w-xl">
            Transform any uploaded source chapter into full-scale student study modules, interactive flashcards,
            meaningful SVG illustrations, practice questions, and high-fidelity spoken teacher narrations.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <div>
              <label className="block text-xs font-bold text-indigo-850 uppercase tracking-wider mb-1.5">
                Select Source Document
              </label>
              <select
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                className="w-full text-sm p-3 bg-white border border-indigo-200 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-700"
              >
                {materials.length === 0 ? (
                  <option value="">-- No Materials Uploaded Yet --</option>
                ) : (
                  materials.map((m) => (
                    <option key={m.id} value={m.id.toString()}>
                      {m.title} (Grade {m.grade} {m.subject})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-indigo-850 uppercase tracking-wider mb-1.5">
                Target Topic / Concept to Teach
              </label>
              <input
                type="text"
                value={topicPrompt}
                onChange={(e) => setTopicPrompt(e.target.value)}
                placeholder="e.g. Introduction to Fractions"
                className="w-full text-sm p-3 bg-white border border-indigo-200 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-700"
              />
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              {success}
            </div>
          )}

          {/* Generation Loader */}
          {isGenerating ? (
            <div className="mt-6 p-5 bg-white border border-indigo-100 rounded-2xl shadow-sm text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-100 border-t-indigo-600 mb-3" />
              <h4 className="text-sm font-extrabold text-indigo-900">Generating Study Resources...</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Please wait. Creating lessons, generating flashcards, drawing diagrams, and synthesizing voice speech recordings takes about 15-30 seconds.
              </p>

              {/* Steps Progress bar */}
              <div className="mt-4 max-w-md mx-auto">
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 progress-transition"
                    style={{ width: `${((generationStep + 1) / generationSteps.length) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-indigo-600 mt-2 font-mono uppercase font-bold animate-pulse">
                  {generationSteps[generationStep]}
                </p>
              </div>
            </div>
          ) : (
            <button
              onClick={triggerLessonGeneration}
              disabled={materials.length === 0 || !topicPrompt}
              className="mt-5 w-full md:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Generate Study Resources (600 - 1,200 words + Audio)
            </button>
          )}
        </div>

        {/* Uploaded Material Source List */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <h4 className="text-sm font-bold text-slate-700 mb-3">Uploaded Source Materials ({materials.length})</h4>
          {materials.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              No study materials have been uploaded yet. Use the left panel to submit one.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {materials.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h5 className="text-sm font-semibold text-slate-800 truncate">{m.title}</h5>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-medium">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-full">Grade {m.grade}</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded-full">{m.subject}</span>
                      <span className="truncate">File: {m.fileName}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteMaterial(m.id)}
                    className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition shrink-0"
                    title="Delete source"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
