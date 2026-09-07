import Link from 'next/link';
import { Play, Shield, ArrowRight, Zap, Trophy, Flame, Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col justify-between selection:bg-indigo-500/30 overflow-hidden relative">
      {/* Dynamic ambient lights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-indigo-600/15 via-blue-500/5 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-amber-500/5 blur-[160px] pointer-events-none" />

      {/* Modern Top Navigation */}
      <header className="border-b border-white/[0.06] backdrop-blur-xl sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 p-[1px] shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-[#0b0e14] rounded-[15px] flex items-center justify-center text-xl">
                🦊
              </div>
            </div>
            <span className="font-black text-lg tracking-tight text-white flex items-center gap-1.5">
              BLUEFOX <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">ARENA</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/login"
              className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-all"
            >
              Host Portal
            </Link>
            <Link
              href="/join"
              className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-white text-zinc-950 hover:bg-zinc-200 transition-all shadow-md active:scale-95"
            >
              Join Room
            </Link>
          </div>
        </div>
      </header>

      {/* Main Hero */}
      <main className="max-w-5xl mx-auto px-6 py-16 sm:py-24 flex flex-col items-center text-center flex-1 justify-center z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 mb-8">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Next-Gen Competitive Quiz Experience</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white max-w-3xl leading-[1.08] mb-6">
          Precision trivia for up to{' '}
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-amber-300 bg-clip-text text-transparent">
            8 live teams.
          </span>
        </h1>

        <p className="text-sm sm:text-base text-zinc-400 max-w-xl mb-12 font-medium">
          Synchronized countdowns, rapid-fire matrices, instant audio feedback, and full host orchestration.
        </p>

        {/* Action Portals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full max-w-2xl mb-16 text-left">
          {/* Player Portal */}
          <Link
            href="/join"
            className="group relative p-7 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] hover:border-indigo-500/50 hover:bg-white/[0.05] transition-all duration-300 shadow-[0_15px_35px_rgba(0,0,0,0.4)] flex flex-col justify-between overflow-hidden"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold mb-4 group-hover:scale-105 transition-transform">
                <Play className="w-5 h-5 fill-current" />
              </div>
              <h3 className="text-xl font-black text-white mb-1.5">Enter Arena</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Connect with team code and compete on live synchronized screens.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs uppercase tracking-wider mt-6 group-hover:translate-x-1 transition-transform">
              <span>Join Quiz</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* Host Portal */}
          <Link
            href="/admin/login"
            className="group relative p-7 rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] hover:border-amber-500/50 hover:bg-white/[0.05] transition-all duration-300 shadow-[0_15px_35px_rgba(0,0,0,0.4)] flex flex-col justify-between overflow-hidden"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold mb-4 group-hover:scale-105 transition-transform">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-white mb-1.5">Host Command</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Launch questions, manage 8 teams, orchestrate timers, and score answers.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs uppercase tracking-wider mt-6 group-hover:translate-x-1 transition-transform">
              <span>Admin Center</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>

        {/* Feature Strip */}
        <div className="flex flex-wrap items-center justify-center gap-3 max-w-2xl text-xs font-semibold text-zinc-400">
          <span className="px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> 8-Team Live Sync
          </span>
          <span className="px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-400" /> Rapid Fire Matrix
          </span>
          <span className="px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-emerald-400" /> Realtime Leaderboard
          </span>
        </div>
      </main>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-white/[0.04] px-6 py-5 text-center text-[11px] font-medium text-zinc-500 tracking-wider uppercase">
        Bluefox Quiz Arena &bull; Live Tournament Suite
      </footer>
    </div>
  );
}
