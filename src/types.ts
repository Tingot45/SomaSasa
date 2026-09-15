export interface DbUser {
  id: number;
  uid: string;
  email: string;
  role: "student" | "teacher";
  isSubscribed: boolean;
  mpesaPhoneNumber: string | null;
  createdAt: string;
}

export interface DbMaterial {
  id: number;
  title: string;
  fileName: string;
  fileType: string;
  content: string;
  grade: number;
  subject: string;
  uploadedById: number | null;
  createdAt: string;
}

export interface DbLesson {
  id: number;
  title: string;
  grade: number;
  subject: string;
  topic: string;
  content: string;
  analogy: string;
  diagramCode: string | null;
  audioBase64: string | null;
  narrationScript?: string | null;
  materialId: number | null;
  status?: string;
  feedbackText?: string | null;
  suggestedEdits?: string | null;
  createdAt: string;
}

export interface DbFlashcard {
  id: number;
  lessonId: number;
  front: string;
  back: string;
}

export interface DbQuestion {
  id: number;
  lessonId: number;
  type: "multiple-choice" | "short-answer" | "true-false";
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  options: string | null; // JSON array string
  correctAnswer: string;
  hint: string;
  explanation: string;
}

export interface DbStudentProgress {
  id: number;
  userId: number;
  lessonId: number;
  completed: boolean;
  quizScore: number | null;
  lastStudied: string;
}

export interface TeacherAnalytics {
  stats: {
    studentsCount: number;
    lessonsCount: number;
    materialsCount: number;
  };
  studentPerformance: Array<{
    studentEmail: string;
    completedCount: number;
    avgScore: string | null;
  }>;
}

export interface StudentDashboardData {
  user: DbUser;
  progress: DbStudentProgress[];
}
