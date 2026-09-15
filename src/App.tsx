import React, { useState, useEffect } from "react";
import {
  auth,
  googleAuthProvider,
} from "./lib/firebase.ts";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import {
  BookOpen,
  Award,
  Users,
  Sparkles,
  LogOut,
  GraduationCap,
  Bookmark,
  Volume2,
  ListTodo,
  FileText,
  UserCheck,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Shield,
  Clock,
  Menu,
  Download,
  Wifi,
  WifiOff,
} from "lucide-react";
import { DbUser, DbLesson, DbFlashcard, DbQuestion } from "./types.ts";
import LessonList from "./components/LessonList.tsx";
import DiagramViewer from "./components/DiagramViewer.tsx";
import AudioPlayer from "./components/AudioPlayer.tsx";
import FlashcardSet from "./components/FlashcardSet.tsx";
import QuizRoom from "./components/QuizRoom.tsx";
import MaterialUpload from "./components/MaterialUpload.tsx";
import TeacherAnalyticsView from "./components/TeacherAnalyticsView.tsx";
import StudentAchievements from "./components/StudentAchievements.tsx";
import TeacherFeedback from "./components/TeacherFeedback.tsx";
import {
  saveLessonOffline,
  getLessonOffline,
  deleteLessonOffline,
  getAllOfflineLessons,
  queueOfflineProgress,
  getQueuedProgress,
  deleteQueuedProgress,
} from "./lib/offline-db.ts";

const KENYAN_SUBJECTS = [
  "Mathematics",
  "Science & Technology",
  "English",
  "Kiswahili",
  "Social Studies",
  "Creative Arts",
];

const GRADES = [4, 5, 6, 7, 8, 9, 10];

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Filter States
  const [selectedSubject, setSelectedSubject] = useState("Mathematics");
  const [selectedGrade, setSelectedGrade] = useState("7");

  // Content States
  const [lessons, setLessons] = useState<DbLesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [lessonDetail, setLessonDetail] = useState<{
    lesson: DbLesson;
    flashcards: DbFlashcard[];
    questions: DbQuestion[];
  } | null>(null);

  // Student progress tracker
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<number>>(new Set());
  const [studentStats, setStudentStats] = useState({
    avgScore: 0,
    lessonsCount: 0,
  });

  // Navigation tab for lesson detail
  const [activeLessonTab, setActiveLessonTab] = useState<
    "read" | "audio" | "flashcards" | "practice" | "quiz"
  >("read");

  // Student view tabs
  const [studentTab, setStudentTab] = useState<"catalog" | "achievements" | "offline">("catalog");

  // Gamification States
  const [points, setPoints] = useState(0);
  const [unlockedBadges, setUnlockedBadges] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // Offline States
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [downloadedLessonIds, setDownloadedLessonIds] = useState<Set<number>>(new Set());
  const [offlineLessons, setOfflineLessons] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [newBadgesToast, setNewBadgesToast] = useState<{ title: string; description: string }[]>([]);

  // Teacher navigation tabs
  const [teacherTab, setTeacherTab] = useState<"upload" | "analytics" | "lessons" | "review">("upload");

  // Mobile billing M-Pesa simulations
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Authenticate monitor
  useEffect(() => {
    if (DEV_MODE && firebaseUser?.uid === "dev-user") return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setFirebaseUser(user);
        const idToken = await user.getIdToken();
        setToken(idToken);
        await syncUserWithBackend(idToken);
      } else {
        setFirebaseUser(null);
        setDbUser(null);
        setToken(null);
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const syncUserWithBackend = async (idToken: string) => {
    try {
      const res = await fetch("/api/users/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setDbUser(data);
        await fetchLessons(idToken);
        await fetchStudentProgress(idToken);
        await fetchGamification(idToken);
        await fetchLeaderboard(idToken);
        await refreshOfflineLibrary();
        if (navigator.onLine) {
          await syncOfflineProgress(idToken);
        }
      }
    } catch (err) {
      console.error("Backend sync failed:", err);
    } finally {
      setAuthLoading(false);
    }
  };

  // Online / Offline monitors & queue bootstrap
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (token) syncOfflineProgress(token);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    // Initial offline db check
    refreshOfflineLibrary();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [token]);

  const fetchGamification = async (idToken = token) => {
    if (!idToken) return;
    try {
      const res = await fetch("/api/student/gamification", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPoints(data.points || 0);
        setUnlockedBadges(data.badges || []);
      }
    } catch (err) {
      console.error("Failed to fetch gamification profile:", err);
    }
  };

  const fetchLeaderboard = async (idToken = token) => {
    if (!idToken) return;
    try {
      const res = await fetch("/api/leaderboard", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    }
  };

  const refreshOfflineLibrary = async () => {
    try {
      const stored = await getAllOfflineLessons();
      setOfflineLessons(stored);
      const ids = new Set<number>(stored.map((item: any) => item.id));
      setDownloadedLessonIds(ids);
    } catch (err) {
      console.error("Failed to read IndexedDB catalog:", err);
    }
  };

  const syncOfflineProgress = async (idToken = token) => {
    if (!idToken) return;
    try {
      const queue = await getQueuedProgress();
      if (queue.length === 0) return;

      setSyncStatus(`Syncing ${queue.length} offline progress logs with cloud...`);
      let successCount = 0;

      for (const item of queue) {
        const res = await fetch("/api/student/progress", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            lessonId: item.lessonId,
            completed: item.completed,
            quizScore: item.quizScore !== null ? item.quizScore : undefined,
          }),
        });

        if (res.ok) {
          await deleteQueuedProgress(item.id!);
          successCount++;
        }
      }

      if (successCount > 0) {
        setSyncStatus(`Successfully synchronized ${successCount} offline study milestones!`);
        await fetchStudentProgress(idToken);
        await fetchGamification(idToken);
        await fetchLeaderboard(idToken);
        setTimeout(() => setSyncStatus(null), 4000);
      } else {
        setSyncStatus(null);
      }
    } catch (err) {
      console.error("Cloud synchronization failed:", err);
      setSyncStatus(null);
    }
  };

  const handleDownloadLesson = async (lesson: DbLesson) => {
    if (!token) return;
    try {
      setSyncStatus(`Downloading "${lesson.title}" for offline access...`);
      const res = await fetch(`/api/lessons/${lesson.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const details = await res.json();
        await saveLessonOffline(lesson.id, details);
        await refreshOfflineLibrary();
        setSyncStatus(`"${lesson.title}" downloaded and ready for offline study!`);
        setTimeout(() => setSyncStatus(null), 3000);
      } else {
        setSyncStatus("Failed to download study pack.");
        setTimeout(() => setSyncStatus(null), 3000);
      }
    } catch (err) {
      console.error("Failed to save offline lesson:", err);
      setSyncStatus("Failed to download study pack.");
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  const handleDeleteDownloadedLesson = async (lessonId: number) => {
    try {
      await deleteLessonOffline(lessonId);
      await refreshOfflineLibrary();
      setSyncStatus("Removed lesson from offline library.");
      setTimeout(() => setSyncStatus(null), 3000);
    } catch (err) {
      console.error("Failed to delete offline lesson:", err);
    }
  };

  const DEV_MODE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      console.error("Login popup failed:", err);
    }
  };

  const handleDevLogin = async (role: "student" | "teacher") => {
    setFirebaseUser({ uid: "dev-user", displayName: "Dev User", email: "dev@somasasa.local" } as any);
    setToken("dev-token");
    setDbUser({
      id: 1,
      uid: "dev-user",
      email: "dev@somasasa.local",
      role,
      isSubscribed: true,
      points: 120,
    } as any);
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setLessons([]);
      setLessonDetail(null);
      setSelectedLessonId(null);
      setCompletedLessonIds(new Set());
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Helper to switch user role (student vs teacher) for demonstration
  const handleToggleRole = async () => {
    if (!token || !dbUser) return;
    const nextRole = dbUser.role === "student" ? "teacher" : "student";
    try {
      const res = await fetch("/api/users/set-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: nextRole }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDbUser(updated);
        // Clear active selection
        setSelectedLessonId(null);
        setLessonDetail(null);
      }
    } catch (err) {
      console.error("Failed to switch role:", err);
    }
  };

  // Simulated payment processing
  const handleSubscribeMpesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !phoneNumber) return;

    setIsPaying(true);
    setPaymentSuccess(false);

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ phoneNumber }),
      });

      if (res.ok) {
        const data = await res.json();
        setDbUser(data.user);
        setPaymentSuccess(true);
        setPhoneNumber("");
      }
    } catch (err) {
      console.error("Subscription failed:", err);
    } finally {
      setIsPaying(false);
    }
  };

  const fetchLessons = async (idToken = token) => {
    if (!idToken) return;
    try {
      const res = await fetch("/api/lessons", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLessons(data);
      }
    } catch (err) {
      console.error("Fetch lessons failed:", err);
    }
  };

  const fetchStudentProgress = async (idToken = token) => {
    if (!idToken) return;
    try {
      const res = await fetch("/api/student/progress", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const completedIds = new Set<number>();
        let scoresSum = 0;
        let scoresCount = 0;

        data.progress.forEach((p: any) => {
          if (p.completed) {
            completedIds.add(p.lessonId);
          }
          if (p.quizScore !== null) {
            scoresSum += p.quizScore;
            scoresCount++;
          }
        });

        setCompletedLessonIds(completedIds);
        setStudentStats({
          avgScore: scoresCount > 0 ? Math.round(scoresSum / scoresCount) : 0,
          lessonsCount: completedIds.size,
        });
      }
    } catch (err) {
      console.error("Fetch student progress failed:", err);
    }
  };

  const loadLessonDetail = async (id: number) => {
    // Offline / Tokenless local db reading fallback
    if (!isOnline || !token) {
      try {
        const offlineData = await getLessonOffline(id);
        if (offlineData) {
          setLessonDetail(offlineData);
          setSelectedLessonId(id);
          setActiveLessonTab("read");
          setSyncStatus("Loaded lesson pack from offline database.");
          setTimeout(() => setSyncStatus(null), 3000);
          return;
        }
      } catch (err) {
        console.error("Failed to read offline database pack:", err);
      }
    }

    if (!token) return;
    try {
      const res = await fetch(`/api/lessons/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLessonDetail(data);
        setSelectedLessonId(id);
        setActiveLessonTab("read");
      } else {
        // Fallback to offline
        const offlineData = await getLessonOffline(id);
        if (offlineData) {
          setLessonDetail(offlineData);
          setSelectedLessonId(id);
          setActiveLessonTab("read");
        }
      }
    } catch (err) {
      console.error("Failed to load lesson detail:", err);
      // Fallback to offline
      const offlineData = await getLessonOffline(id);
      if (offlineData) {
        setLessonDetail(offlineData);
        setSelectedLessonId(id);
        setActiveLessonTab("read");
      }
    }
  };

  const handleDeleteLesson = async (id: number) => {
    if (!token) return;
    if (!window.confirm("Are you sure you want to delete this study pack?")) return;

    try {
      const res = await fetch(`/api/lessons/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchLessons();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleQuizComplete = async (score: number) => {
    if (!selectedLessonId) return;

    // Offline progress queue
    if (!isOnline || !token) {
      try {
        await queueOfflineProgress(selectedLessonId, true, score);
        setSyncStatus("Quiz completed! Progress logged offline. We will synchronize once you connect to the internet.");
        setTimeout(() => setSyncStatus(null), 5000);

        const updatedCompleted = new Set(completedLessonIds);
        updatedCompleted.add(selectedLessonId);
        setCompletedLessonIds(updatedCompleted);
        return;
      } catch (err) {
        console.error("Failed to save offline progress:", err);
      }
    }

    try {
      const res = await fetch("/api/student/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lessonId: selectedLessonId,
          completed: true,
          quizScore: score,
        }),
      });

      if (res.ok) {
        const progressData = await res.json();
        await fetchStudentProgress();
        await fetchGamification();
        await fetchLeaderboard();
        if (progressData.newlyUnlockedBadges && progressData.newlyUnlockedBadges.length > 0) {
          setNewBadgesToast(progressData.newlyUnlockedBadges);
          setTimeout(() => setNewBadgesToast([]), 6000);
        }
      }
    } catch (err) {
      console.error("Failed to save progress:", err);
      // Queue offline on failure
      await queueOfflineProgress(selectedLessonId, true, score);
      setSyncStatus("Saved progress to offline cache due to connection issue.");
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  const handleMarkAsRead = async () => {
    if (!selectedLessonId) return;

    // Offline progress queue
    if (!isOnline || !token) {
      try {
        await queueOfflineProgress(selectedLessonId, true, null);
        setSyncStatus("Lesson finished! Progress logged offline. We will synchronize once you connect to the internet.");
        setTimeout(() => setSyncStatus(null), 5000);

        const updatedCompleted = new Set(completedLessonIds);
        updatedCompleted.add(selectedLessonId);
        setCompletedLessonIds(updatedCompleted);
        return;
      } catch (err) {
        console.error("Failed to save offline progress:", err);
      }
    }

    try {
      const res = await fetch("/api/student/progress", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lessonId: selectedLessonId,
          completed: true,
        }),
      });

      if (res.ok) {
        const progressData = await res.json();
        await fetchStudentProgress();
        await fetchGamification();
        await fetchLeaderboard();
        if (progressData.newlyUnlockedBadges && progressData.newlyUnlockedBadges.length > 0) {
          setNewBadgesToast(progressData.newlyUnlockedBadges);
          setTimeout(() => setNewBadgesToast([]), 6000);
        }
      }
    } catch (err) {
      console.error("Failed to mark read:", err);
      // Queue offline on failure
      await queueOfflineProgress(selectedLessonId, true, null);
      setSyncStatus("Saved progress to offline cache due to connection issue.");
      setTimeout(() => setSyncStatus(null), 5000);
    }
  };

  // Filter lessons based on selection
  const filteredLessons = lessons.filter(
    (l) => l.subject === selectedSubject && l.grade === parseInt(selectedGrade)
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-100 border-t-indigo-600 mb-4" />
        <p className="text-sm font-semibold text-slate-500 font-mono animate-pulse uppercase">
          SomaSasa Loading...
        </p>
      </div>
    );
  }

  // 1. Sign In Page
  if (!firebaseUser || !dbUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto w-full text-center my-auto space-y-8">
          <div>
            <div className="inline-flex items-center justify-center p-3 bg-indigo-50 border border-indigo-100 rounded-3xl text-indigo-600 shadow-sm mb-6">
              <GraduationCap className="h-14 w-14" />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">SomaSasa</h1>
            <p className="text-slate-500 mt-2 font-medium">Study at your own pace, excel on your own terms</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6">
            <p className="text-sm text-slate-600 leading-relaxed text-left">
              Transform textbooks, study notes, past exam papers, and mixed formats into tailored, structured
              lessons, high-fidelity spoken teacher audio recordings, interactive flashcards, practice questions, and quizzes.
            </p>

            <button
              onClick={handleLogin}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-base transition shadow-md flex items-center justify-center gap-3 transform active:scale-95 duration-150"
            >
              <Smartphone className="h-5 w-5" />
              Sign in with Google
            </button>

            {DEV_MODE && (
              <div className="border-t border-slate-200 pt-4 mt-2 space-y-2">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Dev Mode - Skip Auth</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDevLogin("student")}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition"
                  >
                    Enter as Student
                  </button>
                  <button
                    onClick={() => handleDevLogin("teacher")}
                    className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl text-sm transition"
                  >
                    Enter as Teacher
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400 font-medium">
            Tailored to the Kenyan Curriculum for Grades 4 to 10
          </p>
        </div>
      </div>
    );
  }

  // 2. Dashboards Layout
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 leading-none">SomaSasa</h2>
              <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">
                AI Companion
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick dashboard switches for testing */}
            <button
              onClick={handleToggleRole}
              className="text-xs font-extrabold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 rounded-xl transition"
            >
              Toggle to {dbUser.role === "student" ? "Teacher View" : "Student View"}
            </button>

            {/* Email */}
            <span className="hidden md:inline text-xs font-semibold text-slate-500">
              {dbUser.email}
            </span>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 rounded-xl transition"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main workspace container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* STUDENT DASHBOARD SIDE */}
        {dbUser.role === "student" && (
          <div className="space-y-8">
            {/* 1. Student stats widget */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Profile Card */}
              <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white rounded-3xl p-6 shadow-md md:col-span-2 flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-black">Karibu Tena, {firebaseUser.displayName || "Soma Learner"}! 👋</h3>
                  <p className="text-xs text-indigo-300 mt-1 leading-relaxed">
                    Ready to master your chapters today? Select your Grade and subject below to dive into structured AI lessons and audio recordings.
                  </p>
                </div>

                {/* Sub status */}
                <div className="mt-6 flex items-center gap-2">
                  <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full ${
                    dbUser.isSubscribed ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/35" : "bg-amber-500/25 text-amber-300 border border-amber-500/35"
                  }`}>
                    {dbUser.isSubscribed ? "Full Access Pro" : "Free Explorer Status"}
                  </span>
                </div>
              </div>

              {/* Progress Summary 1 */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Bookmark className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
                    Lessons Completed
                  </span>
                  <h3 className="text-2xl font-black text-slate-800 mt-0.5">{studentStats.lessonsCount}</h3>
                </div>
              </div>

              {/* Progress Summary 2 */}
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center gap-4">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">
                    Quiz Avg Accuracy
                  </span>
                  <h3 className="text-2xl font-black text-slate-800 mt-0.5">{studentStats.avgScore}%</h3>
                </div>
              </div>
            </div>

            {/* M-Pesa paywall banner if not subscribed */}
            {!dbUser.isSubscribed && (
              <div className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-1">
                  <h4 className="text-lg font-black text-amber-900 flex items-center gap-1.5">
                    <Smartphone className="h-5 w-5 text-amber-700 animate-pulse" />
                    Unlock Full Premium Study Packs
                  </h4>
                  <p className="text-xs text-amber-700 leading-relaxed max-w-xl">
                    Get access to spoken teacher lecture recordings, memorization flashcards, adaptive practice,
                    and graded quizzes for only <strong>700 Kenyan Shillings per year</strong> via M-Pesa.
                  </p>
                </div>

                <form onSubmit={handleSubscribeMpesa} className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 0712345678"
                    className="p-3 border border-amber-300 rounded-xl focus:border-amber-500 focus:outline-none bg-white text-sm w-full md:w-48"
                  />
                  <button
                    type="submit"
                    className="px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-sm transition shrink-0"
                    disabled={isPaying || !phoneNumber}
                  >
                    {isPaying ? "Verifying..." : "Pay via M-Pesa"}
                  </button>
                </form>
              </div>
            )}

            {/* Connectivity Notifications & Badge Toast Alerts */}
            <div className="flex flex-col gap-3">
              {!isOnline && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold px-4 py-3.5 rounded-2xl flex items-center gap-2 shadow-sm">
                  <WifiOff className="h-4 w-4 text-rose-600 animate-pulse" />
                  <span>You are currently offline. You can study any of your downloaded study packs in the <strong>Offline Library</strong> tab.</span>
                </div>
              )}
              {isOnline && syncStatus && (
                <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold px-4 py-3.5 rounded-2xl flex items-center gap-2 animate-pulse shadow-sm">
                  <Wifi className="h-4 w-4 text-indigo-600 animate-spin" />
                  <span>{syncStatus}</span>
                </div>
              )}
              {newBadgesToast.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex flex-col gap-1.5 shadow-md border-l-4 border-l-amber-500 animate-bounce">
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    👑 Milestone Achievement Unlocked!
                  </h4>
                  {newBadgesToast.map((badge, bIdx) => (
                    <div key={bIdx} className="text-xs font-semibold">
                      🎉 <strong>{badge.title}</strong>: {badge.description}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Student Dashboard Navigation Tabs */}
            {selectedLessonId === null && (
              <div className="flex items-center gap-4 border-b border-slate-200 pb-1">
                <button
                  onClick={() => setStudentTab("catalog")}
                  className={`text-sm font-extrabold pb-3 px-1 border-b-2 transition ${
                    studentTab === "catalog"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Study Catalog
                </button>
                <button
                  onClick={() => setStudentTab("offline")}
                  className={`text-sm font-extrabold pb-3 px-1 border-b-2 transition flex items-center gap-1.5 ${
                    studentTab === "offline"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Offline Library
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-black px-1.5 py-0.5 rounded-full">
                    {downloadedLessonIds.size}
                  </span>
                </button>
                <button
                  onClick={() => setStudentTab("achievements")}
                  className={`text-sm font-extrabold pb-3 px-1 border-b-2 transition ${
                    studentTab === "achievements"
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Leaderboard & Badges
                </button>
              </div>
            )}

            {/* Lesson Workspace view */}
            {selectedLessonId === null ? (
              /* Lessons List Section */
              <div className="space-y-6">
                {studentTab === "catalog" && (
                  <div className="space-y-6">
                    {/* Subject Selector Filters */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h3 className="text-base font-extrabold text-slate-800">Choose Subject & Grade</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-bold">Grade:</span>
                          <select
                            value={selectedGrade}
                            onChange={(e) => {
                              setSelectedGrade(e.target.value);
                              fetchLessons();
                            }}
                            className="text-xs font-bold p-2 bg-slate-100 rounded-lg focus:outline-none border-none text-slate-700 cursor-pointer"
                          >
                            {GRADES.map((g) => (
                              <option key={g} value={g.toString()}>
                                Grade {g}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Horizontal Scroll Subjects list */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                        {KENYAN_SUBJECTS.map((sub) => {
                          const isActive = selectedSubject === sub;
                          return (
                            <button
                              key={sub}
                              onClick={() => setSelectedSubject(sub)}
                              className={`text-xs font-bold px-4 py-2.5 rounded-xl shrink-0 transition ${
                                isActive
                                  ? "bg-indigo-600 text-white shadow-sm"
                                  : "bg-slate-50 hover:bg-slate-100 text-slate-600"
                              }`}
                            >
                              {sub}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Lesson Catalog component */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-black text-slate-800">Available Study Packs</h3>
                      <LessonList
                        lessons={filteredLessons}
                        completedLessonIds={completedLessonIds}
                        onSelect={(l) => loadLessonDetail(l.id)}
                        downloadedLessonIds={downloadedLessonIds}
                        onDownload={handleDownloadLesson}
                        onDeleteDownload={handleDeleteDownloadedLesson}
                        isOnline={isOnline}
                      />
                    </div>
                  </div>
                )}

                {studentTab === "offline" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-black text-slate-800">Your Downloaded Offline Packs</h3>
                      <span className="text-xs text-slate-400 font-semibold">Study offline without network charges</span>
                    </div>
                    {offlineLessons.length === 0 ? (
                      <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl p-6">
                        <Download className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                        <h4 className="text-sm font-bold text-slate-700">No Offline Downloads</h4>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                          Click the download icon on any study pack in the <strong>Study Catalog</strong> while online to access it anywhere.
                        </p>
                      </div>
                    ) : (
                      <LessonList
                        lessons={offlineLessons.map(item => item.details.lesson)}
                        completedLessonIds={completedLessonIds}
                        onSelect={(l) => loadLessonDetail(l.id)}
                        downloadedLessonIds={downloadedLessonIds}
                        onDownload={handleDownloadLesson}
                        onDeleteDownload={handleDeleteDownloadedLesson}
                        isOnline={isOnline}
                      />
                    )}
                  </div>
                )}

                {studentTab === "achievements" && (
                  <StudentAchievements
                    points={points}
                    unlockedBadges={unlockedBadges}
                    leaderboard={leaderboard}
                    token={token}
                    onRefresh={() => {
                      fetchGamification();
                      fetchLeaderboard();
                    }}
                  />
                )}
              </div>
            ) : (
              /* Lesson Detailed Workspace Screen (Single View layout) */
              lessonDetail && (
                <div className="space-y-6">
                  {/* Workspace top navigation bar */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <button
                      onClick={() => {
                        setSelectedLessonId(null);
                        setLessonDetail(null);
                      }}
                      className="text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-xl transition inline-flex items-center gap-1.5 self-start"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Back to Dashboard
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setActiveLessonTab("read")}
                        className={`text-xs font-bold px-3 py-2 rounded-xl transition ${
                          activeLessonTab === "read"
                            ? "bg-indigo-600 text-white"
                            : "bg-white hover:bg-slate-50 text-slate-600"
                        }`}
                      >
                        1. Read Lesson
                      </button>

                      {/* Paywall locked tabs */}
                      <button
                        onClick={() => {
                          if (dbUser.isSubscribed) setActiveLessonTab("audio");
                        }}
                        className={`text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1 ${
                          !dbUser.isSubscribed
                            ? "opacity-45 bg-slate-100 text-slate-400 cursor-not-allowed"
                            : activeLessonTab === "audio"
                            ? "bg-indigo-600 text-white"
                            : "bg-white hover:bg-slate-50 text-slate-600"
                        }`}
                        title={!dbUser.isSubscribed ? "Subscribe to unlock" : ""}
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                        2. Spoken Lecture
                        {!dbUser.isSubscribed && " 🔒"}
                      </button>

                      <button
                        onClick={() => {
                          if (dbUser.isSubscribed) setActiveLessonTab("flashcards");
                        }}
                        className={`text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1 ${
                          !dbUser.isSubscribed
                            ? "opacity-45 bg-slate-100 text-slate-400 cursor-not-allowed"
                            : activeLessonTab === "flashcards"
                            ? "bg-indigo-600 text-white"
                            : "bg-white hover:bg-slate-50 text-slate-600"
                        }`}
                        title={!dbUser.isSubscribed ? "Subscribe to unlock" : ""}
                      >
                        <Bookmark className="h-3.5 w-3.5" />
                        3. Flashcards
                        {!dbUser.isSubscribed && " 🔒"}
                      </button>

                      <button
                        onClick={() => {
                          if (dbUser.isSubscribed) setActiveLessonTab("practice");
                        }}
                        className={`text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1 ${
                          !dbUser.isSubscribed
                            ? "opacity-45 bg-slate-100 text-slate-400 cursor-not-allowed"
                            : activeLessonTab === "practice"
                            ? "bg-indigo-600 text-white"
                            : "bg-white hover:bg-slate-50 text-slate-600"
                        }`}
                        title={!dbUser.isSubscribed ? "Subscribe to unlock" : ""}
                      >
                        <ListTodo className="h-3.5 w-3.5" />
                        4. Practice Mode
                        {!dbUser.isSubscribed && " 🔒"}
                      </button>

                      <button
                        onClick={() => {
                          if (dbUser.isSubscribed) setActiveLessonTab("quiz");
                        }}
                        className={`text-xs font-bold px-3 py-2 rounded-xl transition flex items-center gap-1 ${
                          !dbUser.isSubscribed
                            ? "opacity-45 bg-slate-100 text-slate-400 cursor-not-allowed"
                            : activeLessonTab === "quiz"
                            ? "bg-indigo-600 text-white"
                            : "bg-white hover:bg-slate-50 text-slate-600"
                        }`}
                        title={!dbUser.isSubscribed ? "Subscribe to unlock" : ""}
                      >
                        <Award className="h-3.5 w-3.5" />
                        5. Graded Quiz
                        {!dbUser.isSubscribed && " 🔒"}
                      </button>
                    </div>
                  </div>

                  {/* Active Workspace screens */}
                  {activeLessonTab === "read" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Detailed Text content */}
                      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                              Grade {lessonDetail.lesson.grade} {lessonDetail.lesson.subject}
                            </span>
                            <h2 className="text-2xl font-extrabold text-slate-850 mt-1 leading-snug">
                              {lessonDetail.lesson.title}
                            </h2>
                          </div>
                        </div>

                        {/* Text explanation */}
                        <div className="prose prose-slate max-w-none text-slate-700 text-sm leading-relaxed space-y-4 font-sans border-t border-slate-100 pt-5">
                          {lessonDetail.lesson.content.split("\n\n").map((para, i) => (
                            <p key={i}>{para}</p>
                          ))}
                        </div>

                        <div className="border-t border-slate-100 pt-6 mt-6 flex justify-end">
                          <button
                            onClick={handleMarkAsRead}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition"
                          >
                            Mark Lesson as Finished
                          </button>
                        </div>
                      </div>

                      {/* Side widgets: Diagrams & Analogy */}
                      <div className="space-y-6">
                        {/* Analogy Box */}
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
                          <h4 className="text-sm font-extrabold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                            <Smartphone className="h-4 w-4" />
                            Kenyan Analogy
                          </h4>
                          <p className="text-xs text-amber-800 leading-relaxed mt-2 font-medium">
                            {lessonDetail.lesson.analogy}
                          </p>
                        </div>

                        {/* Responsive Diagram component */}
                        <DiagramViewer
                          svgCode={lessonDetail.lesson.diagramCode}
                          title={lessonDetail.lesson.title}
                        />
                      </div>
                    </div>
                  )}

                  {/* Audio lecture workspace */}
                  {activeLessonTab === "audio" && dbUser.isSubscribed && (
                    <div className="max-w-2xl mx-auto space-y-6">
                      <AudioPlayer
                        audioBase64={lessonDetail.lesson.audioBase64}
                        lessonTitle={lessonDetail.lesson.title}
                      />

                      {/* Interactive slide summary deck */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <h4 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mb-3">
                          <Shield className="h-4 w-4 text-indigo-600" />
                          Narrated Lecture Notes
                        </h4>
                        <blockquote className="border-l-4 border-indigo-500 pl-4 text-xs italic text-slate-600 leading-relaxed font-medium">
                          {lessonDetail.lesson.narrationScript}
                        </blockquote>

                        <div className="mt-5">
                          <DiagramViewer
                            svgCode={lessonDetail.lesson.diagramCode}
                            title={lessonDetail.lesson.title}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Flashcards study space */}
                  {activeLessonTab === "flashcards" && dbUser.isSubscribed && (
                    <div className="py-6">
                      <FlashcardSet flashcards={lessonDetail.flashcards} />
                    </div>
                  )}

                  {/* Practice Zone workspace */}
                  {activeLessonTab === "practice" && dbUser.isSubscribed && (
                    <div className="py-6">
                      <QuizRoom
                        questions={lessonDetail.questions.filter((q) => q.options === null || q.options !== undefined)} // filter practice
                        isQuizMode={false}
                        onComplete={() => {}}
                      />
                    </div>
                  )}

                  {/* Graded Quiz workspace */}
                  {activeLessonTab === "quiz" && dbUser.isSubscribed && (
                    <div className="py-6">
                      <QuizRoom
                        questions={lessonDetail.questions}
                        isQuizMode={true}
                        onComplete={handleQuizComplete}
                      />
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* TEACHER DASHBOARD SIDE */}
        {dbUser.role === "teacher" && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 leading-none">Teacher Dashboard</h2>
                <span className="text-xs text-slate-400 font-semibold mt-1 block">
                  Add textbooks, compile learning packages, and view class diagnostics.
                </span>
              </div>

              {/* Navigation switches */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setTeacherTab("upload")}
                  className={`text-xs font-bold px-3.5 py-2 rounded-xl transition ${
                    teacherTab === "upload"
                      ? "bg-indigo-600 text-white"
                      : "bg-white hover:bg-slate-50 text-slate-600 border border-slate-200"
                  }`}
                >
                  Upload & Synthesize
                </button>

                <button
                  onClick={() => setTeacherTab("lessons")}
                  className={`text-xs font-bold px-3.5 py-2 rounded-xl transition ${
                    teacherTab === "lessons"
                      ? "bg-indigo-600 text-white"
                      : "bg-white hover:bg-slate-50 text-slate-600 border border-slate-200"
                  }`}
                >
                  Manage Study Packs
                </button>

                <button
                  onClick={() => setTeacherTab("review")}
                  className={`text-xs font-bold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 ${
                    teacherTab === "review"
                      ? "bg-indigo-600 text-white"
                      : "bg-white hover:bg-slate-50 text-slate-600 border border-slate-200"
                  }`}
                >
                  <span>Review AI Study Packs</span>
                  <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full font-black">
                    AI feedback loop
                  </span>
                </button>

                <button
                  onClick={() => setTeacherTab("analytics")}
                  className={`text-xs font-bold px-3.5 py-2 rounded-xl transition ${
                    teacherTab === "analytics"
                      ? "bg-indigo-600 text-white"
                      : "bg-white hover:bg-slate-50 text-slate-600 border border-slate-200"
                  }`}
                >
                  Class Performance Reports
                </button>
              </div>
            </div>

            {/* Active panels */}
            {teacherTab === "upload" && (
              <MaterialUpload onGenerateSuccess={fetchLessons} token={token} />
            )}

            {teacherTab === "lessons" && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <h4 className="text-base font-extrabold text-slate-800 mb-4">Active Course Study Packs ({lessons.length})</h4>
                {lessons.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    No course study packs generated yet. Use the "Upload & Synthesize" tab to build your first one.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-150 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                          <th className="py-3 px-4">Title</th>
                          <th className="py-3 px-4">Subject</th>
                          <th className="py-3 px-4 text-center">Grade</th>
                          <th className="py-3 px-4">Topic</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lessons.map((l) => (
                          <tr key={l.id} className="hover:bg-slate-50/30 transition">
                            <td className="py-3.5 px-4 font-bold text-slate-850">{l.title}</td>
                            <td className="py-3.5 px-4">
                              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-semibold">
                                {l.subject}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center">Grade {l.grade}</td>
                            <td className="py-3.5 px-4 font-medium text-slate-600">{l.topic}</td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => handleDeleteLesson(l.id)}
                                className="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {teacherTab === "analytics" && <TeacherAnalyticsView token={token} />}

            {teacherTab === "review" && <TeacherFeedback lessons={lessons} token={token} onRefresh={fetchLessons} />}
          </div>
        )}
      </main>

      {/* Footer bar */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-400 font-semibold">
        SomaSasa Applet © 2026 • Tailored AI Study Materials for Kenyan Students
      </footer>
    </div>
  );
}
