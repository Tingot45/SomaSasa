import React, { useEffect, useState } from "react";
import { Trophy, Award, Star, Crown, ChevronRight, CheckCircle2 } from "lucide-react";

interface Badge {
  id: number;
  badgeType: string;
  title: string;
  description: string;
  createdAt: string;
}

interface LeaderboardUser {
  id: number;
  email: string;
  points: number;
}

interface StudentAchievementsProps {
  token: string | null;
  points: number;
  unlockedBadges: Badge[];
  leaderboard: LeaderboardUser[];
  onRefresh: () => void;
}

export default function StudentAchievements({
  token,
  points,
  unlockedBadges,
  leaderboard,
  onRefresh,
}: StudentAchievementsProps) {
  // Determine level info
  const pointsPerLevel = 200;
  const currentLevel = Math.floor(points / pointsPerLevel) + 1;
  const currentLevelProgress = points % pointsPerLevel;
  const progressPercent = Math.min(Math.round((currentLevelProgress / pointsPerLevel) * 100), 100);
  const xpNeeded = pointsPerLevel - currentLevelProgress;

  // Static badges definitions to map
  const BADGE_TEMPLATES = [
    {
      type: "first_lesson",
      title: "First Step",
      description: "Completed your very first study lesson!",
      iconColor: "text-amber-600 bg-amber-50 border-amber-200",
      icon: Star,
    },
    {
      type: "quiz_master",
      title: "Quiz Champion",
      description: "Scored 80% or higher on a study quiz!",
      iconColor: "text-indigo-600 bg-indigo-50 border-indigo-200",
      icon: Trophy,
    },
    {
      type: "subject_guru",
      title: "Subject Guru",
      description: "Completed 3 or more lessons in a single subject!",
      iconColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
      icon: Award,
    },
    {
      type: "points_milestone_500",
      title: "Centurion Scholar",
      description: "Earned a grand total of 500 study points!",
      iconColor: "text-rose-600 bg-rose-50 border-rose-200",
      icon: Crown,
    },
  ];

  // Helper to check if user has unlocked badge template
  const isBadgeUnlocked = (type: string) => {
    if (type === "subject_guru") {
      return unlockedBadges.some((b) => b.badgeType.startsWith("subject_mastery:"));
    }
    return unlockedBadges.some((b) => b.badgeType === type);
  };

  const getUnlockedBadgeDetails = (type: string) => {
    if (type === "subject_guru") {
      const b = unlockedBadges.find((b) => b.badgeType.startsWith("subject_mastery:"));
      return b ? { title: b.title, description: b.description } : null;
    }
    const b = unlockedBadges.find((b) => b.badgeType === type);
    return b ? { title: b.title, description: b.description } : null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Achievements Column */}
      <div className="lg:col-span-2 space-y-6">
        {/* Level Banner */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                Soma Rank Level {currentLevel}
              </span>
              <h3 className="text-xl font-black text-slate-950 mt-2">Leveling Progress</h3>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {xpNeeded} XP to reach Level {currentLevel + 1}! Keep learning to rank up.
              </p>
            </div>
            <div className="h-16 w-16 shrink-0 bg-indigo-600 text-white rounded-2xl flex flex-col items-center justify-center shadow-md">
              <span className="text-[10px] uppercase font-bold tracking-wider leading-none">Lv</span>
              <span className="text-2xl font-black leading-none mt-1">{currentLevel}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>{currentLevelProgress} / {pointsPerLevel} XP</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Badges showcase */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-black text-slate-900">Your Achievement Badges</h3>
            <span className="text-xs text-slate-400 font-extrabold bg-slate-50 border border-slate-100 px-3 py-1 rounded-xl">
              {unlockedBadges.length} Badges Earned
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {BADGE_TEMPLATES.map((tmpl) => {
              const unlocked = isBadgeUnlocked(tmpl.type);
              const customDetails = getUnlockedBadgeDetails(tmpl.type);
              const IconComponent = tmpl.icon;

              return (
                <div
                  key={tmpl.type}
                  className={`border rounded-2xl p-4.5 flex gap-4 transition ${
                    unlocked
                      ? "bg-slate-50/50 border-slate-200 shadow-sm"
                      : "bg-slate-50/10 border-slate-100 opacity-60"
                  }`}
                >
                  <div
                    className={`h-12 w-12 shrink-0 rounded-xl flex items-center justify-center border ${
                      unlocked ? tmpl.iconColor : "bg-slate-100 text-slate-400 border-slate-200 grayscale"
                    }`}
                  >
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className={`text-sm font-extrabold ${unlocked ? "text-slate-900" : "text-slate-400"}`}>
                      {unlocked && customDetails ? customDetails.title : tmpl.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                      {unlocked && customDetails ? customDetails.description : tmpl.description}
                    </p>
                    {unlocked && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full mt-2.5">
                        <CheckCircle2 className="h-3 w-3" />
                        Unlocked
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Leaderboard Column */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-black text-slate-900">Leaderboard</h3>
            <span className="text-xs text-slate-400 font-bold">Kenyan student rankings</span>
          </div>
          <Trophy className="h-6 w-6 text-indigo-600 animate-bounce" />
        </div>

        {/* Podium for top 3 */}
        {leaderboard.length > 0 && (
          <div className="grid grid-cols-3 gap-3 items-end border-b border-slate-100 pb-5 mb-5 text-center">
            {/* Rank 2 (Left) */}
            {leaderboard[1] && (
              <div className="flex flex-col items-center">
                <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 mb-2">
                  2
                </div>
                <div className="text-[10px] font-bold text-slate-600 truncate max-w-full px-1">
                  {leaderboard[1].email.split("@")[0]}
                </div>
                <div className="text-xs font-black text-slate-800">{leaderboard[1].points} pts</div>
                <div className="h-14 w-full bg-slate-100/70 border border-slate-150 rounded-t-xl mt-2 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase">
                  Silver
                </div>
              </div>
            )}

            {/* Rank 1 (Middle - Tallest) */}
            {leaderboard[0] && (
              <div className="flex flex-col items-center">
                <div className="h-10 w-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-sm font-bold text-amber-600 mb-2 shadow-sm animate-pulse">
                  👑
                </div>
                <div className="text-xs font-extrabold text-slate-900 truncate max-w-full px-1">
                  {leaderboard[0].email.split("@")[0]}
                </div>
                <div className="text-sm font-black text-indigo-700">{leaderboard[0].points} pts</div>
                <div className="h-18 w-full bg-amber-500/10 border border-amber-200/50 rounded-t-xl mt-2 flex items-center justify-center text-[10px] font-black text-amber-700 uppercase">
                  Gold
                </div>
              </div>
            )}

            {/* Rank 3 (Right) */}
            {leaderboard[2] && (
              <div className="flex flex-col items-center">
                <div className="h-8 w-8 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-xs font-bold text-orange-700 mb-2">
                  3
                </div>
                <div className="text-[10px] font-bold text-slate-600 truncate max-w-full px-1">
                  {leaderboard[2].email.split("@")[0]}
                </div>
                <div className="text-xs font-black text-slate-800">{leaderboard[2].points} pts</div>
                <div className="h-11 w-full bg-orange-500/5 border border-orange-200/30 rounded-t-xl mt-2 flex items-center justify-center text-[10px] font-black text-orange-700 uppercase">
                  Bronze
                </div>
              </div>
            )}
          </div>
        )}

        {/* Remainder top 10 scrollable list */}
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {leaderboard.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-medium">
              No students on the leaderboard yet.
            </div>
          ) : (
            leaderboard.slice(3).map((user, idx) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-slate-400 w-4 text-center">{idx + 4}</span>
                  <div>
                    <span className="font-bold text-slate-850 block">
                      {user.email.split("@")[0]}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">{user.email}</span>
                  </div>
                </div>
                <span className="font-black text-slate-700">{user.points} pts</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
