import React, { useState, useRef, useEffect } from "react";
import { Play, Pause, RotateCcw, Volume2, HelpCircle } from "lucide-react";

interface AudioPlayerProps {
  audioBase64: string | null;
  lessonTitle: string;
}

export default function AudioPlayer({ audioBase64, lessonTitle }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Reset player states when audio string changes
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.load();
    }
  }, [audioBase64]);

  if (!audioBase64) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-amber-50 border border-amber-100 rounded-2xl">
        <HelpCircle className="h-8 w-8 text-amber-500 mb-2" />
        <h4 className="text-sm font-semibold text-amber-800">Audio Lecture Generating</h4>
        <p className="text-xs text-amber-600 text-center max-w-xs mt-1">
          A classroom-style audio tutorial is not yet generated or available for this lesson.
        </p>
      </div>
    );
  }

  // Create standard data URL for audio source
  const audioSrc = `data:audio/mp3;base64,${audioBase64}`;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => console.error("Play error:", err));
    }
    setIsPlaying(!isPlaying);
  };

  const restart = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    if (!isPlaying) {
      audioRef.current.play().catch((err) => console.error("Play error:", err));
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const changeSpeed = () => {
    if (!audioRef.current) return;
    let nextRate = 1;
    if (playbackRate === 1) nextRate = 1.25;
    else if (playbackRate === 1.25) nextRate = 1.5;
    else if (playbackRate === 1.5) nextRate = 0.75;
    else nextRate = 1;

    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-indigo-950">
      <audio
        ref={audioRef}
        src={audioSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs text-indigo-300 font-semibold uppercase tracking-wider">
            Teacher-Style Audio Tutorial
          </span>
          <h4 className="text-lg font-bold text-white line-clamp-1 mt-0.5">{lessonTitle}</h4>
          <p className="text-xs text-slate-400">Listen, repeat, and study at your own pace</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Restart */}
          <button
            onClick={restart}
            className="p-2.5 bg-indigo-800/50 hover:bg-indigo-800 rounded-full transition text-indigo-200"
            title="Restart lecture"
          >
            <RotateCcw className="h-5 w-5" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="p-4 bg-white hover:bg-slate-100 text-indigo-900 rounded-full transition shadow-lg transform hover:scale-105 active:scale-95"
          >
            {isPlaying ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current ml-0.5" />}
          </button>

          {/* Speed Rate Toggle */}
          <button
            onClick={changeSpeed}
            className="px-3.5 py-2 bg-indigo-850 hover:bg-indigo-800 rounded-xl transition text-xs font-semibold text-indigo-200 min-w-[55px]"
            title="Adjust speed"
          >
            {playbackRate}x
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-5">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 bg-indigo-950 rounded-lg appearance-none cursor-pointer accent-white"
        />
        <div className="flex justify-between text-xs text-slate-400 mt-1.5 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
