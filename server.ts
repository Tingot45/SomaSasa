import express from "express";
import path from "path";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/index.ts";
import {
  users,
  materials,
  lessons,
  flashcards,
  questions,
  studentProgress,
  mpesaTransactions,
  badges,
} from "./src/db/schema.ts";
import { eq, and, sql, desc } from "drizzle-orm";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { generateLessonAndResources } from "./src/lib/content-generator.ts";

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // -------------------------------------------------------------
  // API Routes
  // -------------------------------------------------------------

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // 1. User Sync: Register or fetch user
  app.post("/api/users/sync", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { uid, email } = req.user!;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Synchronize user profile in Cloud SQL
      const result = await db
        .insert(users)
        .values({
          uid,
          email,
          role: "student",
          isSubscribed: false,
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: { email },
        })
        .returning();

      res.json(result[0]);
    } catch (error) {
      console.error("Failed to sync user:", error);
      res.status(500).json({ error: "Database query failed. Please try again later." });
    }
  });

  // 2. Set User Role (for easy student/teacher dashboard toggling in the UI)
  app.post("/api/users/set-role", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { uid } = req.user!;
      const { role } = req.body;

      if (role !== "student" && role !== "teacher") {
        return res.status(400).json({ error: "Invalid role specified" });
      }

      const result = await db
        .update(users)
        .set({ role })
        .where(eq(users.uid, uid))
        .returning();

      res.json(result[0]);
    } catch (error) {
      console.error("Failed to set role:", error);
      res.status(500).json({ error: "Database query failed. Please try again later." });
    }
  });

  // 3. Subscription Payment: Simple M-Pesa mockup
  app.post("/api/subscribe", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { uid } = req.user!;
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      // Find user
      const userRecord = await db
        .select()
        .from(users)
        .where(eq(users.uid, uid));

      if (!userRecord.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const userId = userRecord[0].id;
      const checkoutRequestId = "mpesa_" + Math.random().toString(36).substring(2, 11);

      // Create a pending transaction
      const transaction = await db
        .insert(mpesaTransactions)
        .values({
          userId,
          checkoutRequestId,
          phoneNumber,
          amount: 700,
          status: "pending",
        })
        .returning();

      // M-Pesa simulation: Automatically complete the transaction after creation to make testing fast!
      await db
        .update(mpesaTransactions)
        .set({ status: "completed" })
        .where(eq(mpesaTransactions.id, transaction[0].id));

      const updatedUser = await db
        .update(users)
        .set({ isSubscribed: true, mpesaPhoneNumber: phoneNumber })
        .where(eq(users.id, userId))
        .returning();

      res.json({
        success: true,
        user: updatedUser[0],
        message: "M-Pesa payment simulated and verified successfully!",
      });
    } catch (error) {
      console.error("Failed to process M-Pesa subscription:", error);
      res.status(500).json({ error: "M-Pesa subscription processing failed." });
    }
  });

  // 4. Create Material: Handle Bulk Upload (or Manual pasted content)
  app.post(
    "/api/materials/upload",
    requireAuth,
    upload.single("file"),
    async (req: AuthRequest, res) => {
      try {
        const { uid } = req.user!;
        const { title, subject, grade, pastedContent } = req.body;

        if (!title || !subject || !grade) {
          return res.status(400).json({ error: "Missing required metadata fields" });
        }

        // Get user ID
        const userRecord = await db
          .select()
          .from(users)
          .where(eq(users.uid, uid));

        if (!userRecord.length) {
          return res.status(404).json({ error: "User not found" });
        }

        const userId = userRecord[0].id;

        let content = pastedContent || "";
        let fileName = "pasted_text";
        let fileType = "text";

        if (req.file) {
          fileName = req.file.originalname;
          fileType = req.file.mimetype;
          // Standard text decoding for txt files
          if (fileType.includes("text") || fileName.endsWith(".txt")) {
            content = req.file.buffer.toString("utf8");
          } else {
            // For binary files, use a descriptive notice, or mock extraction
            content = `[File: ${fileName} (${fileType})]
            This is an uploaded curriculum textbook material for ${subject} Grade ${grade}.
            It covers chapters on key curriculum subtopics. Use your AI intelligence to expand on the subject of ${title} for Kenyans in Grades 4 to 10.`;
          }
        }

        if (!content || content.trim().length === 0) {
          return res.status(400).json({ error: "No study content was provided" });
        }

        // Save material to the database
        const result = await db
          .insert(materials)
          .values({
            title,
            fileName,
            fileType,
            content,
            grade: parseInt(grade),
            subject,
            uploadedById: userId,
          })
          .returning();

        res.json(result[0]);
      } catch (error) {
        console.error("Failed to upload material:", error);
        res.status(500).json({ error: "Failed to upload and save material." });
      }
    }
  );

  // 5. Get Materials
  app.get("/api/materials", requireAuth, async (req: AuthRequest, res) => {
    try {
      const result = await db
        .select()
        .from(materials)
        .orderBy(desc(materials.createdAt));
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch materials:", error);
      res.status(500).json({ error: "Failed to load study materials." });
    }
  });

  // 6. Delete Material
  app.delete("/api/materials/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const materialId = parseInt(req.params.id);
      await db.delete(materials).where(eq(materials.id, materialId));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete material:", error);
      res.status(500).json({ error: "Failed to delete study material." });
    }
  });

  // 7. Synthesize Material into Structured Lesson, Quiz, Questions, TTS
  app.post("/api/lessons/generate", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { materialId, topic } = req.body;

      if (!materialId || !topic) {
        return res.status(400).json({ error: "Material ID and target Topic are required" });
      }

      // 1. Fetch material details
      const materialRecord = await db
        .select()
        .from(materials)
        .where(eq(materials.id, parseInt(materialId)));

      if (!materialRecord.length) {
        return res.status(404).json({ error: "Material source not found" });
      }

      const mat = materialRecord[0];

      // 2. Orhcestrate Gemini generation
      console.log(`Generating lessons and quizzes for ${mat.subject} Grade ${mat.grade} on topic "${topic}"`);
      const { lesson, audioBase64 } = await generateLessonAndResources(
        mat.content,
        mat.grade,
        mat.subject,
        topic
      );

      // 3. Save Lesson content to database
      const savedLesson = await db
        .insert(lessons)
        .values({
          title: lesson.title,
          grade: mat.grade,
          subject: mat.subject,
          topic: lesson.topic,
          content: lesson.content,
          analogy: lesson.analogy,
          diagramCode: lesson.diagramCode,
          audioBase64: audioBase64,
          materialId: mat.id,
        })
        .returning();

      const lessonId = savedLesson[0].id;

      // 4. Save Flashcards
      if (lesson.flashcards && lesson.flashcards.length > 0) {
        const flashcardRows = lesson.flashcards.map((f) => ({
          lessonId,
          front: f.front,
          back: f.back,
        }));
        await db.insert(flashcards).values(flashcardRows);
      }

      // 5. Save Questions (Practice & Quiz questions are both stored in questions table)
      const allQuestions = [
        ...lesson.practiceQuestions.map((q) => ({ ...q, difficulty: q.difficulty || "medium", isQuiz: false })),
        ...lesson.quizQuestions.map((q) => ({ ...q, difficulty: q.difficulty || "medium", isQuiz: true })),
      ];

      if (allQuestions.length > 0) {
        const questionRows = allQuestions.map((q) => ({
          lessonId,
          type: q.type,
          difficulty: q.difficulty,
          prompt: q.prompt,
          options: q.options ? JSON.stringify(q.options) : null,
          correctAnswer: q.correctAnswer,
          hint: q.hint,
          explanation: q.explanation,
        }));
        await db.insert(questions).values(questionRows);
      }

      res.json({
        success: true,
        lesson: savedLesson[0],
      });
    } catch (error) {
      console.error("AI Content Generation failed:", error);
      res.status(500).json({ error: "AI Content Generation or TTS service failed. Try again." });
    }
  });

  // 8. Fetch Lessons (Filtered optionally by grade/subject)
  app.get("/api/lessons", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { grade, subject } = req.query;

      let query = db.select().from(lessons);

      let conditions = [];
      if (grade) {
        conditions.push(eq(lessons.grade, parseInt(grade as string)));
      }
      if (subject) {
        conditions.push(eq(lessons.subject, subject as string));
      }

      let result;
      if (conditions.length > 0) {
        // @ts-ignore
        result = await query.where(and(...conditions)).orderBy(desc(lessons.createdAt));
      } else {
        result = await query.orderBy(desc(lessons.createdAt));
      }

      res.json(result);
    } catch (error) {
      console.error("Failed to fetch lessons:", error);
      res.status(500).json({ error: "Failed to load lessons." });
    }
  });

  // 9. Get Single Lesson detail with flashcards, practice questions, quizzes
  app.get("/api/lessons/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const lessonId = parseInt(req.params.id);

      const lessonRecord = await db
        .select()
        .from(lessons)
        .where(eq(lessons.id, lessonId));

      if (!lessonRecord.length) {
        return res.status(404).json({ error: "Lesson not found" });
      }

      const lessonFlashcards = await db
        .select()
        .from(flashcards)
        .where(eq(flashcards.lessonId, lessonId));

      const lessonQuestions = await db
        .select()
        .from(questions)
        .where(eq(questions.lessonId, lessonId));

      res.json({
        lesson: lessonRecord[0],
        flashcards: lessonFlashcards,
        questions: lessonQuestions,
      });
    } catch (error) {
      console.error("Failed to fetch lesson detail:", error);
      res.status(500).json({ error: "Failed to load lesson details." });
    }
  });

  // 10. Delete Lesson
  app.delete("/api/lessons/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const lessonId = parseInt(req.params.id);
      await db.delete(lessons).where(eq(lessons.id, lessonId));
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete lesson:", error);
      res.status(500).json({ error: "Failed to delete lesson." });
    }
  });

  // 11. Student Logs Progress (completed or score)
  app.post("/api/student/progress", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { uid } = req.user!;
      const { lessonId, completed, quizScore } = req.body;

      if (!lessonId) {
        return res.status(400).json({ error: "Lesson ID is required" });
      }

      // Find user
      const userRecord = await db
        .select()
        .from(users)
        .where(eq(users.uid, uid));

      if (!userRecord.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const userId = userRecord[0].id;

      // Upsert student progress record
      const existing = await db
        .select()
        .from(studentProgress)
        .where(
          and(
            eq(studentProgress.userId, userId),
            eq(studentProgress.lessonId, parseInt(lessonId))
          )
        );

      let result;
      if (existing.length > 0) {
        result = await db
          .update(studentProgress)
          .set({
            completed: completed !== undefined ? completed : existing[0].completed,
            quizScore: quizScore !== undefined ? parseInt(quizScore) : existing[0].quizScore,
            lastStudied: new Date(),
          })
          .where(eq(studentProgress.id, existing[0].id))
          .returning();
      } else {
        result = await db
          .insert(studentProgress)
          .values({
            userId,
            lessonId: parseInt(lessonId),
            completed: completed !== undefined ? completed : true,
            quizScore: quizScore !== undefined ? parseInt(quizScore) : null,
          })
          .returning();
      }

      // Gamification: Calculate points to award
      let pointsToAdd = 0;
      const isNewlyCompleted = completed === true && (existing.length === 0 || !existing[0].completed);
      if (isNewlyCompleted) {
        pointsToAdd += 50; // 50 XP for lesson completion
      }

      if (quizScore !== undefined) {
        const newScore = parseInt(quizScore);
        const oldScore = existing.length && existing[0].quizScore !== null ? existing[0].quizScore : 0;
        if (newScore > oldScore) {
          pointsToAdd += (newScore - oldScore) * 10; // 10 XP per correct question point improvement
        }
      }

      if (pointsToAdd > 0) {
        await db
          .update(users)
          .set({ points: sql`${users.points} + ${pointsToAdd}` })
          .where(eq(users.id, userId));
      }

      // Fetch updated user stats for badge analysis
      const updatedUserRecord = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));
      const totalPoints = updatedUserRecord[0]?.points || 0;

      // Fetch lesson details to know subject for Subject Mastery check
      const lessonRecord = await db
        .select()
        .from(lessons)
        .where(eq(lessons.id, parseInt(lessonId)));
      const lessonSubject = lessonRecord.length ? lessonRecord[0].subject : "";

      const newlyUnlockedBadges: { title: string; description: string }[] = [];

      // Badge 1: First Step (Complete first lesson)
      if (isNewlyCompleted) {
        const hasFirstLessonBadge = await db
          .select()
          .from(badges)
          .where(and(eq(badges.userId, userId), eq(badges.badgeType, "first_lesson")));
        if (!hasFirstLessonBadge.length) {
          const badgeVal = {
            userId,
            badgeType: "first_lesson",
            title: "First Step",
            description: "Completed your very first study lesson!",
          };
          await db.insert(badges).values(badgeVal);
          newlyUnlockedBadges.push({ title: badgeVal.title, description: badgeVal.description });
        }
      }

      // Badge 2: Quiz Champion (Score >= 8 out of 10)
      if (quizScore !== undefined && parseInt(quizScore) >= 8) {
        const hasQuizMasterBadge = await db
          .select()
          .from(badges)
          .where(and(eq(badges.userId, userId), eq(badges.badgeType, "quiz_master")));
        if (!hasQuizMasterBadge.length) {
          const badgeVal = {
            userId,
            badgeType: "quiz_master",
            title: "Quiz Champion",
            description: "Scored 80% or higher on a study quiz!",
          };
          await db.insert(badges).values(badgeVal);
          newlyUnlockedBadges.push({ title: badgeVal.title, description: badgeVal.description });
        }
      }

      // Badge 3: Subject Guru (Complete at least 3 lessons in a subject)
      if (lessonSubject) {
        const completedInSubject = await db
          .select({ count: sql<number>`count(*)` })
          .from(studentProgress)
          .innerJoin(lessons, eq(studentProgress.lessonId, lessons.id))
          .where(
            and(
              eq(studentProgress.userId, userId),
              eq(studentProgress.completed, true),
              eq(lessons.subject, lessonSubject)
            )
          );
        const subjectCount = completedInSubject[0]?.count || 0;
        if (subjectCount >= 3) {
          const badgeType = `subject_mastery:${lessonSubject}`;
          const hasSubjectBadge = await db
            .select()
            .from(badges)
            .where(and(eq(badges.userId, userId), eq(badges.badgeType, badgeType)));
          if (!hasSubjectBadge.length) {
            const badgeVal = {
              userId,
              badgeType,
              title: `${lessonSubject} Guru`,
              description: `Completed 3 or more lessons in ${lessonSubject}!`,
            };
            await db.insert(badges).values(badgeVal);
            newlyUnlockedBadges.push({ title: badgeVal.title, description: badgeVal.description });
          }
        }
      }

      // Badge 4: Centurion Scholar (Earn >= 500 total points)
      if (totalPoints >= 500) {
        const hasCenturionBadge = await db
          .select()
          .from(badges)
          .where(and(eq(badges.userId, userId), eq(badges.badgeType, "points_milestone_500")));
        if (!hasCenturionBadge.length) {
          const badgeVal = {
            userId,
            badgeType: "points_milestone_500",
            title: "Centurion Scholar",
            description: "Earned a grand total of 500 study points!",
          };
          await db.insert(badges).values(badgeVal);
          newlyUnlockedBadges.push({ title: badgeVal.title, description: badgeVal.description });
        }
      }

      res.json({
        ...result[0],
        pointsAwarded: pointsToAdd,
        totalPoints,
        newlyUnlockedBadges,
      });
    } catch (error) {
      console.error("Failed to record student progress:", error);
      res.status(500).json({ error: "Failed to record learning progress." });
    }
  });

  // 12. Student Progress & Analytics API
  app.get("/api/student/progress", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { uid } = req.user!;

      const userRecord = await db
        .select()
        .from(users)
        .where(eq(users.uid, uid));

      if (!userRecord.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const userId = userRecord[0].id;

      // Fetch all progress records for the user
      const progressLogs = await db
        .select()
        .from(studentProgress)
        .where(eq(studentProgress.userId, userId));

      res.json({
        user: userRecord[0],
        progress: progressLogs,
      });
    } catch (error) {
      console.error("Failed to fetch student dashboard data:", error);
      res.status(500).json({ error: "Failed to load dashboard data." });
    }
  });

  // 13. Teacher Analytics API
  app.get("/api/teacher/analytics", requireAuth, async (req: AuthRequest, res) => {
    try {
      // Aggregate stats across students
      const totalStudentsQuery = await db
        .select({ count: sql<number>`count(distinct ${users.id})` })
        .from(users)
        .where(eq(users.role, "student"));

      const totalLessonsQuery = await db
        .select({ count: sql<number>`count(*)` })
        .from(lessons);

      const totalMaterialsQuery = await db
        .select({ count: sql<number>`count(*)` })
        .from(materials);

      const progressSummary = await db
        .select({
          studentEmail: users.email,
          completedCount: sql<number>`sum(case when ${studentProgress.completed} = true then 1 else 0 end)`,
          avgScore: sql<number>`avg(${studentProgress.quizScore})`,
        })
        .from(studentProgress)
        .innerJoin(users, eq(studentProgress.userId, users.id))
        .groupBy(users.email);

      res.json({
        stats: {
          studentsCount: totalStudentsQuery[0]?.count || 0,
          lessonsCount: totalLessonsQuery[0]?.count || 0,
          materialsCount: totalMaterialsQuery[0]?.count || 0,
        },
        studentPerformance: progressSummary,
      });
    } catch (error) {
      console.error("Failed to fetch teacher analytics:", error);
      res.status(500).json({ error: "Failed to load teacher analytics." });
    }
  });

  // 14. Student Gamification Details (Points & Badges)
  app.get("/api/student/gamification", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { uid } = req.user!;
      const userRecord = await db
        .select()
        .from(users)
        .where(eq(users.uid, uid));

      if (!userRecord.length) {
        return res.status(404).json({ error: "User not found" });
      }

      const userId = userRecord[0].id;
      const userBadges = await db
        .select()
        .from(badges)
        .where(eq(badges.userId, userId))
        .orderBy(desc(badges.createdAt));

      res.json({
        points: userRecord[0].points,
        badges: userBadges,
      });
    } catch (error) {
      console.error("Failed to fetch gamification details:", error);
      res.status(500).json({ error: "Failed to load achievements." });
    }
  });

  // 15. Global Student Leaderboard
  app.get("/api/leaderboard", requireAuth, async (req: AuthRequest, res) => {
    try {
      const topStudents = await db
        .select({
          id: users.id,
          email: users.email,
          points: users.points,
        })
        .from(users)
        .where(eq(users.role, "student"))
        .orderBy(desc(users.points))
        .limit(10);

      res.json(topStudents);
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
      res.status(500).json({ error: "Failed to load leaderboard." });
    }
  });

  // 16. Teacher Lesson Review & Manual Edits
  app.post("/api/teacher/lessons/:id/review", requireAuth, async (req: AuthRequest, res) => {
    try {
      const lessonId = parseInt(req.params.id);
      const { status, feedbackText, suggestedEdits, updatedFields } = req.body;

      if (!status || !["approved", "flagged", "pending"].includes(status)) {
        return res.status(400).json({ error: "Valid status ('approved', 'flagged', 'pending') is required" });
      }

      // Prepare review updates
      const updateData: any = {
        status,
        feedbackText: feedbackText || null,
        suggestedEdits: suggestedEdits || null,
      };

      // Direct teacher manual edits overrides
      if (updatedFields) {
        if (updatedFields.title) updateData.title = updatedFields.title;
        if (updatedFields.content) updateData.content = updatedFields.content;
        if (updatedFields.analogy) updateData.analogy = updatedFields.analogy;
        if (updatedFields.diagramCode) updateData.diagramCode = updatedFields.diagramCode;
      }

      const result = await db
        .update(lessons)
        .set(updateData)
        .where(eq(lessons.id, lessonId))
        .returning();

      if (!result.length) {
        return res.status(404).json({ error: "Lesson not found to review" });
      }

      res.json({
        success: true,
        lesson: result[0],
      });
    } catch (error) {
      console.error("Failed to review/update lesson:", error);
      res.status(500).json({ error: "Failed to save lesson review." });
    }
  });

  // -------------------------------------------------------------
  // Frontend Bundler / Serving
  // -------------------------------------------------------------

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // @ts-ignore
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
