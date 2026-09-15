import { integer, pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// 1. Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(), // Firebase Auth UID
  email: text("email").notNull(),
  role: text("role").notNull().default("student"), // 'student', 'teacher'
  isSubscribed: boolean("is_subscribed").notNull().default(false),
  mpesaPhoneNumber: text("mpesa_phone_number"),
  points: integer("points").notNull().default(0), // Gamification points
  createdAt: timestamp("created_at").defaultNow(),
});

// 2. Uploaded Materials table
export const materials = pgTable("materials", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  content: text("content").notNull(), // Raw parsed text content
  grade: integer("grade").notNull(), // Grades 4 to 10
  subject: text("subject").notNull(), // e.g. 'Mathematics', 'Science', 'English'
  uploadedById: integer("uploaded_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// 3. Generated Lessons table
export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  grade: integer("grade").notNull(),
  subject: text("subject").notNull(),
  topic: text("topic").notNull(),
  content: text("content").notNull(), // 600 - 1200 words
  analogy: text("analogy").notNull(), // Real-world example/analogy
  diagramCode: text("diagram_code"), // SVG / ASCII / Mermaid representation
  audioBase64: text("audio_base64"), // Prebuilt TTS base64 speech audio data
  materialId: integer("material_id").references(() => materials.id),
  status: text("status").notNull().default("approved"), // 'approved', 'flagged', 'pending'
  feedbackText: text("feedback_text"),
  suggestedEdits: text("suggested_edits"), // stores JSON with suggested edits
  createdAt: timestamp("created_at").defaultNow(),
});

// 4. Flashcards table
export const flashcards = pgTable("flashcards", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id")
    .references(() => lessons.id, { onDelete: "cascade" })
    .notNull(),
  front: text("front").notNull(),
  back: text("back").notNull(),
});

// 5. Practice Questions & Quiz table
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id")
    .references(() => lessons.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull(), // 'multiple-choice', 'short-answer', 'true-false'
  difficulty: text("difficulty").notNull(), // 'easy', 'medium', 'hard'
  prompt: text("prompt").notNull(),
  options: text("options"), // JSON string array for MCQs
  correctAnswer: text("correct_answer").notNull(),
  hint: text("hint").notNull(),
  explanation: text("explanation").notNull(),
});

// 6. Student Progress table
export const studentProgress = pgTable("student_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  lessonId: integer("lesson_id")
    .references(() => lessons.id, { onDelete: "cascade" })
    .notNull(),
  completed: boolean("completed").notNull().default(false),
  quizScore: integer("quiz_score"), // score achieved (e.g. out of 100)
  lastStudied: timestamp("last_studied").defaultNow(),
});

// 7. M-Pesa Transactions table
export const mpesaTransactions = pgTable("mpesa_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  checkoutRequestId: text("checkout_request_id").notNull(),
  amount: integer("amount").notNull().default(700), // 700 Kenyan Shillings
  phoneNumber: text("phone_number").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'completed', 'failed'
  createdAt: timestamp("created_at").defaultNow(),
});

// 8. Badges table for gamification
export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  badgeType: text("badge_type").notNull(), // 'first_lesson', 'quiz_master', 'subject_mastery:Mathematics' etc
  title: text("title").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 9. Relations
export const usersRelations = relations(users, ({ many }) => ({
  materials: many(materials),
  studentProgress: many(studentProgress),
  mpesaTransactions: many(mpesaTransactions),
  badges: many(badges),
}));

export const materialsRelations = relations(materials, ({ one, many }) => ({
  uploadedBy: one(users, {
    fields: [materials.uploadedById],
    references: [users.id],
  }),
  lessons: many(lessons),
}));

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  material: one(materials, {
    fields: [lessons.materialId],
    references: [materials.id],
  }),
  flashcards: many(flashcards),
  questions: many(questions),
  studentProgress: many(studentProgress),
}));

export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  lesson: one(lessons, {
    fields: [flashcards.lessonId],
    references: [lessons.id],
  }),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  lesson: one(lessons, {
    fields: [questions.lessonId],
    references: [lessons.id],
  }),
}));

export const studentProgressRelations = relations(studentProgress, ({ one }) => ({
  user: one(users, {
    fields: [studentProgress.userId],
    references: [users.id],
  }),
  lesson: one(lessons, {
    fields: [studentProgress.lessonId],
    references: [lessons.id],
  }),
}));

export const mpesaTransactionsRelations = relations(mpesaTransactions, ({ one }) => ({
  user: one(users, {
    fields: [mpesaTransactions.userId],
    references: [users.id],
  }),
}));

export const badgesRelations = relations(badges, ({ one }) => ({
  user: one(users, {
    fields: [badges.userId],
    references: [users.id],
  }),
}));

