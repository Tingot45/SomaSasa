import { ai } from "./gemini.ts";
import { Type } from "@google/genai";
import { db } from "../db/index.ts";
import { lessons } from "../db/schema.ts";
import { eq, and, isNotNull } from "drizzle-orm";

interface GeneratedQuizQuestion {
  type: string;
  difficulty: string;
  prompt: string;
  options: string[] | null;
  correctAnswer: string;
  hint: string;
  explanation: string;
}

interface GeneratedFlashcard {
  front: string;
  back: string;
}

interface GeneratedLessonData {
  title: string;
  topic: string;
  content: string;
  analogy: string;
  diagramCode: string;
  narrationScript: string;
  flashcards: GeneratedFlashcard[];
  practiceQuestions: GeneratedQuizQuestion[];
  quizQuestions: GeneratedQuizQuestion[];
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      // Retry on transient 503 (high demand) or 429 (rate limit) errors
      const isRetryable = err?.status === 503 || err?.status === 429;
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }
      const delay = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s, 16s backoff
      console.log(`AI generation attempt ${attempt + 1} failed (${err.status}). Retrying in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export async function generateLessonAndResources(
  materialContent: string,
  grade: number,
  subject: string,
  topic: string
): Promise<{ lesson: GeneratedLessonData; audioBase64: string | null }> {
  // Fetch up to 5 lessons with feedback or edits to learn from and fine-tune AI generation parameters
  let feedbackContext = "";
  try {
    const recentFeedback = await db
      .select({
        title: lessons.title,
        feedbackText: lessons.feedbackText,
        suggestedEdits: lessons.suggestedEdits,
      })
      .from(lessons)
      .where(and(eq(lessons.status, "flagged"), isNotNull(lessons.feedbackText)))
      .limit(5);

    if (recentFeedback.length > 0) {
      feedbackContext = "\n\nCRITICAL TEACHER FEEDBACK & REVISION DIRECTIVES TO LEARN FROM (Avoid these issues in this generation):\n";
      recentFeedback.forEach((f, idx) => {
        feedbackContext += `${idx + 1}. Lesson: "${f.title}"\n   - Teacher Feedback: "${f.feedbackText}"\n`;
        if (f.suggestedEdits) {
          feedbackContext += `   - Suggested Corrections to follow: "${f.suggestedEdits}"\n`;
        }
      });
    }
  } catch (err) {
    console.error("Failed to load feedback context for AI:", err);
  }

  const prompt = `
    You are a professional teacher and curriculum developer in Kenya.
    Using the following source material content, generate a highly structured, deep, and creative educational lesson for Grade ${grade} in the subject of ${subject} on the topic of "${topic}".
    
    Source Material Content:
    """
    ${materialContent}
    """${feedbackContext}

    CRITICAL REQUIREMENTS:
    1. The "content" field MUST be a detailed, comprehensive lesson of 600 to 1,200 words. Do not make it brief or summarize. Write paragraphs explaining concepts, defining terms, and providing step-by-step reasoning.
    2. Format the "content" field using clean Markdown:
       - Use "## " for main section headings, "### " for sub-headings, and "#### " for sub-sub-headings.
       - Use *single asterisks* for italics and **double asterisks** for bold emphasis.
       - Use "- " for bullet lists and "1. " for numbered lists when listing steps or examples.
       - Use blockquotes ("> ") for important notes or key takeaways.
    3. For ALL mathematical expressions, formulas, equations, fractions, and symbols, use LaTeX:
       - Use $...$ for inline math (e.g., the fraction $\frac{3}{4}$ has numerator 3).
       - Use $$...$$ for display/block equations on their own line (e.g., $$\frac{a}{b} + \frac{c}{d} = \frac{ad + bc}{bd}$$).
       - Use proper LaTeX commands for fractions (\frac{}{}), square roots (\sqrt{}), powers (x^{2}), subscripts (x_{1}), Greek letters (\pi, \theta, \alpha), multiplication (\times), division (\div), and comparison symbols (\leq, \geq, \neq).
       - Never write math as plain text or ASCII (do NOT use "3/4", "x^2", or "sqrt"). Always use LaTeX.
    4. Adapt explanations to the Kenyan school context, using familiar examples (e.g., M-Pesa, matatus, maize farming, tea plantations, local wildlife, Nairobi, Mombasa, Kenyan athletes, market days).
    5. Include a relatable real-world "analogy" (focused on the Kenyan context) that makes abstract concepts clear.
    6. "diagramCode" MUST be a complete, valid, self-contained, and beautiful SVG XML string representing a helpful educational diagram, chart, or infographic.
       - The SVG must be clean, responsive (use viewBox, width="100%", height="100%"), have nice rounded corners, modern color schemes (like slate, emerald, royal blue, amber), and readable text.
       - DO NOT use markdown or any text outside the SVG. Start directly with "<svg" and end with "</svg>".
    7. Provide a clear "narrationScript" of 150-250 words that a teacher would read to explain this lesson to a class.
    8. Generate 5 "flashcards" for key vocabulary/concepts.
    9. Generate 5 "practiceQuestions" and 5 "quizQuestions" with varying difficulties: 'easy', 'medium', 'hard'.
       - Questions can be 'multiple-choice', 'short-answer', or 'true-false'.
       - For multiple-choice questions, "options" must be an array of exactly 4 strings. For others, "options" must be null.
       - Provide helpful "hint" and detailed "explanation" for each.
       - In question prompts and explanations, use LaTeX ($...$) for any mathematical expressions.
    
    Format the entire output as a strict JSON object matching the provided schema.
  `;

  try {
    const response = await generateWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Title of the lesson" },
            topic: { type: Type.STRING, description: "Sub-topic of the lesson" },
            content: { type: Type.STRING, description: "The lesson body, 600-1200 words, HTML or Markdown format" },
            analogy: { type: Type.STRING, description: "Kenyan real-world analogy" },
            diagramCode: { type: Type.STRING, description: "Self-contained responsive SVG diagram" },
            narrationScript: { type: Type.STRING, description: "Narrator voice script of 150-250 words" },
            flashcards: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  front: { type: Type.STRING },
                  back: { type: Type.STRING },
                },
                required: ["front", "back"],
              },
            },
            practiceQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "multiple-choice, short-answer, true-false" },
                  difficulty: { type: Type.STRING, description: "easy, medium, hard" },
                  prompt: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "4 options for MCQs, or null for other types",
                  },
                  correctAnswer: { type: Type.STRING },
                  hint: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                },
                required: ["type", "difficulty", "prompt", "correctAnswer", "hint", "explanation"],
              },
            },
            quizQuestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, description: "multiple-choice, short-answer, true-false" },
                  difficulty: { type: Type.STRING, description: "easy, medium, hard" },
                  prompt: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  correctAnswer: { type: Type.STRING },
                  hint: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                },
                required: ["type", "difficulty", "prompt", "correctAnswer", "hint", "explanation"],
              },
            },
          },
          required: [
            "title",
            "topic",
            "content",
            "analogy",
            "diagramCode",
            "narrationScript",
            "flashcards",
            "practiceQuestions",
            "quizQuestions",
          ],
        },
        },
      })
    );

    const text = response.text;
    if (!text) {
      throw new Error("No text returned from Gemini");
    }

    const lessonData: GeneratedLessonData = JSON.parse(text);

    // 2. Generate teacher-style TTS audio from the narration script using gemini-3.1-flash-tts-preview
    let audioBase64: string | null = null;
    try {
      console.log("Generating teacher TTS narration...");
      const ttsResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [
          {
            parts: [
              {
                text: `Say in a warm, friendly, clear, authoritative Kenyan teacher-like voice: ${lessonData.narrationScript}`,
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Zephyr" }, // Zephyr is clear and friendly
            },
          },
        },
      });

      audioBase64 =
        ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ||
        null;
    } catch (ttsErr) {
      console.error("Failed to generate TTS audio narration:", ttsErr);
      // Fallback gracefully so we don't break the entire lesson creation
    }

    return { lesson: lessonData, audioBase64 };
  } catch (error) {
    console.error("Error in generateLessonAndResources:", error);
    throw error;
  }
}
