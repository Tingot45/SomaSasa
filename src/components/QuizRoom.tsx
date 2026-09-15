import React, { useState } from "react";
import { Check, X, AlertCircle, HelpCircle, Trophy, Lightbulb, RefreshCw } from "lucide-react";
import { DbQuestion } from "../types.ts";

interface QuizRoomProps {
  questions: DbQuestion[];
  isQuizMode: boolean; // true = formal quiz, false = practice zone
  onComplete: (score: number) => void;
}

export default function QuizRoom({ questions, isQuizMode, onComplete }: QuizRoomProps) {
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [checkedAnswers, setCheckedAnswers] = useState<Record<number, boolean>>({});
  const [showHint, setShowHint] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [score, setScore] = useState(0);

  if (!questions || questions.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 bg-slate-50 border border-slate-200 rounded-xl text-slate-400">
        No questions available for this topic.
      </div>
    );
  }

  // Separate practice questions from quiz questions based on mode
  const currentQuestion = questions[currentQIndex];

  // Parse options if MCQ
  const getOptions = (question: DbQuestion): string[] => {
    if (!question.options) return [];
    try {
      return typeof question.options === "string" ? JSON.parse(question.options) : question.options;
    } catch (e) {
      return [];
    }
  };

  const handleSelectOption = (option: string) => {
    if (isQuizMode && quizFinished) return;
    if (!isQuizMode && checkedAnswers[currentQuestion.id]) return; // locked after check in practice

    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: option,
    }));
  };

  const handleCheckAnswer = () => {
    // Only for practice mode
    if (isQuizMode) return;
    const isCorrect =
      selectedAnswers[currentQuestion.id]?.trim().toLowerCase() ===
      currentQuestion.correctAnswer.trim().toLowerCase();

    setCheckedAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: true,
    }));
  };

  const handleNext = () => {
    setShowHint(false);
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex((prev) => prev + 1);
    } else if (isQuizMode) {
      // Calculate final score
      let correctCount = 0;
      questions.forEach((q) => {
        const selected = selectedAnswers[q.id]?.trim().toLowerCase();
        const correct = q.correctAnswer.trim().toLowerCase();
        if (selected === correct) {
          correctCount++;
        }
      });
      const finalScore = Math.round((correctCount / questions.length) * 100);
      setScore(finalScore);
      setQuizFinished(true);
      onComplete(finalScore);
    }
  };

  const restartQuiz = () => {
    setCurrentQIndex(0);
    setSelectedAnswers({});
    setCheckedAnswers({});
    setShowHint(false);
    setQuizFinished(false);
    setScore(0);
  };

  const options = getOptions(currentQuestion);
  const selectedOption = selectedAnswers[currentQuestion.id];
  const isChecked = checkedAnswers[currentQuestion.id];
  const isCorrect = selectedOption?.trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 max-w-2xl mx-auto">
      {/* Quiz Finished State */}
      {quizFinished && isQuizMode ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center p-4 bg-amber-50 text-amber-500 rounded-full mb-4 animate-bounce">
            <Trophy className="h-12 w-12" />
          </div>
          <h3 className="text-2xl font-black text-slate-800">Quiz Completed!</h3>
          <p className="text-slate-500 mt-1">Excellent effort studying Kenyan CBC topics.</p>

          <div className="my-6 max-w-xs mx-auto p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-500">Your Score</span>
            <h1 className="text-5xl font-black text-indigo-700 mt-1">{score}%</h1>
            <p className="text-xs text-indigo-600 mt-2 font-medium">
              {score >= 80
                ? "Hapo Sawa! Brilliant mastery of this lesson!"
                : score >= 50
                ? "Nzuri Sana! You have a good understanding."
                : "Keep practicing! You will excel."}
            </p>
          </div>

          <button
            onClick={restartQuiz}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition inline-flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Quiz Again
          </button>
        </div>
      ) : (
        /* Question Active State */
        <div>
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
            <div>
              <span className="text-xs bg-indigo-50 text-indigo-600 font-bold px-3 py-1 rounded-full">
                {isQuizMode ? "Graded Quiz" : "Adaptive Practice Mode"}
              </span>
              <span className="text-xs text-slate-400 font-semibold ml-2">
                Level: {currentQuestion.difficulty.toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-slate-500 font-bold font-mono">
              {currentQIndex + 1} of {questions.length}
            </span>
          </div>

          <h3 className="text-lg font-bold text-slate-800 leading-snug mb-5">
            {currentQuestion.prompt}
          </h3>

          {/* Options Display (MCQ / TF) */}
          <div className="space-y-3">
            {options.length > 0 ? (
              options.map((opt, i) => {
                const isSelected = selectedOption === opt;
                let optionStyle = "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50";

                if (isSelected) {
                  optionStyle = "border-indigo-600 bg-indigo-50/30 text-indigo-900";
                }

                if (isChecked && !isQuizMode) {
                  const isOptCorrect = opt === currentQuestion.correctAnswer;
                  if (isOptCorrect) {
                    optionStyle = "border-emerald-600 bg-emerald-50/30 text-emerald-900 font-semibold";
                  } else if (isSelected) {
                    optionStyle = "border-rose-300 bg-rose-50/30 text-rose-900";
                  }
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleSelectOption(opt)}
                    className={`w-full p-4 border-2 rounded-xl text-left transition flex items-center justify-between text-sm ${optionStyle}`}
                    disabled={(!isQuizMode && isChecked) || quizFinished}
                  >
                    <span>{opt}</span>
                    {isChecked && !isQuizMode && opt === currentQuestion.correctAnswer && (
                      <Check className="h-4 w-4 text-emerald-600" />
                    )}
                    {isChecked && !isQuizMode && isSelected && opt !== currentQuestion.correctAnswer && (
                      <X className="h-4 w-4 text-rose-500" />
                    )}
                  </button>
                );
              })
            ) : (
              /* Short Answer Input */
              <div className="space-y-2">
                <input
                  type="text"
                  value={selectedOption || ""}
                  onChange={(e) => handleSelectOption(e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full p-4 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:outline-none"
                  disabled={(!isQuizMode && isChecked) || quizFinished}
                />
                {!isQuizMode && isChecked && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700">
                    Correct Answer: <span className="text-emerald-700">{currentQuestion.correctAnswer}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hint Section */}
          {showHint && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-2.5">
              <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-bold text-amber-800 uppercase tracking-wider">Hint</h5>
                <p className="text-xs text-amber-700 mt-0.5 font-medium">{currentQuestion.hint}</p>
              </div>
            </div>
          )}

          {/* Feedback & Explanation (Practice Mode only) */}
          {!isQuizMode && isChecked && (
            <div className={`mt-5 p-4 rounded-xl border flex gap-3 ${
              isCorrect ? "bg-emerald-50 border-emerald-100" : "bg-rose-50 border-rose-100"
            }`}>
              {isCorrect ? (
                <Check className="h-6 w-6 text-emerald-600 shrink-0" />
              ) : (
                <X className="h-6 w-6 text-rose-500 shrink-0" />
              )}
              <div>
                <h4 className={`text-sm font-bold ${isCorrect ? "text-emerald-850" : "text-rose-850"}`}>
                  {isCorrect ? "Hapo Sawa! Correct!" : "Oops, Not quite!"}
                </h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed font-medium">
                  {currentQuestion.explanation}
                </p>
              </div>
            </div>
          )}

          {/* Actions panel */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-5 mt-6">
            {!isQuizMode && !isChecked ? (
              <button
                onClick={() => setShowHint(!showHint)}
                className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 rounded-xl transition"
              >
                {showHint ? "Hide Hint" : "Get Hint"}
              </button>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              {!isQuizMode && !isChecked ? (
                <button
                  onClick={handleCheckAnswer}
                  disabled={!selectedOption}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Check Answer
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={!selectedOption && isQuizMode}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {currentQIndex === questions.length - 1 ? (isQuizMode ? "Finish Quiz" : "Finish Practice") : "Next Question"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
