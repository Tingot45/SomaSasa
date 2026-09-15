import React, { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCw, CheckCircle2 } from "lucide-react";
import { DbFlashcard } from "../types.ts";
import Markdown from "./Markdown.tsx";

interface FlashcardSetProps {
  flashcards: DbFlashcard[];
}

export default function FlashcardSet({ flashcards }: FlashcardSetProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [mastered, setMastered] = useState<Record<number, boolean>>({});

  if (!flashcards || flashcards.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 bg-slate-50 border border-slate-200 rounded-xl text-slate-400">
        No study flashcards available for this lesson.
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % flashcards.length);
    }, 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
    }, 150);
  };

  const toggleMastered = (id: number) => {
    setMastered((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const totalMastered = Object.values(mastered).filter(Boolean).length;

  return (
    <div className="flex flex-col items-center">
      {/* Progress & Stats */}
      <div className="w-full max-w-md flex justify-between items-center mb-4 text-xs font-semibold text-slate-600">
        <span>
          Card {currentIndex + 1} of {flashcards.length}
        </span>
        <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Mastered: {totalMastered}/{flashcards.length}
        </span>
      </div>

      {/* 3D Interactive Card Flipping */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        className="w-full max-w-md aspect-[4/3] cursor-pointer perspective-1000 group relative select-none"
      >
        <div
          className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${
            isFlipped ? "rotate-y-180" : ""
          }`}
        >
          {/* Card Front */}
          <div className="absolute inset-0 w-full h-full bg-white border-2 border-indigo-100 hover:border-indigo-200 rounded-3xl shadow-sm flex flex-col justify-between p-8 backface-hidden">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              Vocabulary Term
            </span>
            <div className="flex-1 flex items-center justify-center text-center">
              <h3 className="text-2xl font-bold text-slate-800 px-4 leading-relaxed">
                <Markdown>{currentCard.front}</Markdown>
              </h3>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-indigo-500 font-semibold bg-indigo-50/50 py-2 rounded-xl">
              <RotateCw className="h-3.5 w-3.5 animate-pulse" />
              Click card to reveal definition
            </div>
          </div>

          {/* Card Back */}
          <div className="absolute inset-0 w-full h-full bg-indigo-50 border-2 border-indigo-200 rounded-3xl shadow-sm flex flex-col justify-between p-8 backface-hidden rotate-y-180">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-500">
              Definition / Explanation
            </span>
            <div className="flex-1 flex items-center justify-center text-center">
              <p className="text-lg text-slate-700 font-medium px-4 leading-relaxed">
                <Markdown>{currentCard.back}</Markdown>
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              Click again to flip back
            </div>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="w-full max-w-md flex items-center justify-between mt-6 gap-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
          className="p-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-full transition hover:shadow-sm"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Mastered toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleMastered(currentCard.id);
          }}
          className={`flex-1 py-3 px-4 rounded-xl font-bold transition text-sm ${
            mastered[currentCard.id]
              ? "bg-emerald-600 text-white shadow-md hover:bg-emerald-700"
              : "bg-white border border-slate-300 hover:border-emerald-300 text-slate-700 hover:text-emerald-700"
          }`}
        >
          {mastered[currentCard.id] ? "✓ Mastered" : "Mark as Mastered"}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
          className="p-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-full transition hover:shadow-sm"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
