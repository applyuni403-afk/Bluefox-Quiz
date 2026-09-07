import Link from 'next/link';
import { Play, Shield, ArrowRight, Zap, Trophy, Flame, Sparkles } from 'lucide-react';
import { SiteLogo } from '@/components/SiteLogo';

export default function Home() {
  return (
    <div className="h-screen max-h-screen overflow-hidden bg-[#edf2f9] text-slate-800 flex flex-col justify-between selection:bg-blue-500/20 selection:text-blue-900 relative">
      {/* Dynamic ambient soft blue lights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-blue-300/30 via-indigo-200/20 to-transparent blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-sky-200/30 blur-[160px] pointer-events-none" />

      {/* Modern Top Navigation */}
      <header className="border-b border-blue-200/60 bg-white/75 backdrop-blur-xl shrink-0 z-50 px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SiteLogo size="md" />
            <span className="font-black text-lg tracking-tight text-slate-900 flex items-center gap-1.5">
              BLUEFOX <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">QUIZ</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/login"
              className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-all"
            >
              Host Portal
            </Link>
            <Link
              href="/join"
              className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-md shadow-blue-500/20 active:scale-95"
            >
              Join Room
            </Link>
          </div>
        </div>
      </header>

      {/* Main Hero */}
      <main className="max-w-5xl mx-auto px-6 py-2 sm:py-4 flex flex-col items-center text-center flex-1 min-h-0 justify-center z-10 w-full">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] bg-blue-100/80 text-blue-700 border border-blue-200 mb-3 sm:mb-4 shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Next-Gen Competitive Quiz Experience</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-slate-900 max-w-3xl leading-[1.12] mb-3">
          Precision trivia for up to{' '}
          <span className="bg-gradient-to-r from-blue-700 via-indigo-600 to-sky-600 bg-clip-text text-transparent">
            8 live teams.
          </span>
        </h1>

        <p className="text-xs sm:text-sm text-slate-600 max-w-xl mb-5 sm:mb-6 font-medium">
          Synchronized countdowns, rapid-fire matrices, instant audio feedback, and full host orchestration.
        </p>

        {/* Action Portals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl mb-4 sm:mb-5 text-left">
          {/* Team Portal */}
          <Link
            href="/join"
            className="group relative p-5 rounded-2xl bg-white/85 hover:bg-white backdrop-blur-xl border border-blue-100 hover:border-blue-300 hover:shadow-[0_15px_35px_rgba(59,130,246,0.12)] transition-all duration-200 shadow-[0_8px_25px_rgba(30,58,138,0.04)] flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform shadow-2xs">
                <Play className="w-4 h-4 fill-current" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">Enter Quiz</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Connect with team code and compete on live synchronized screens.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-blue-600 font-bold text-xs uppercase tracking-wider mt-4 group-hover:translate-x-1 transition-transform">
              <span>Join Quiz</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          {/* Host Portal */}
          <Link
            href="/admin/login"
            className="group relative p-5 rounded-2xl bg-white/85 hover:bg-white backdrop-blur-xl border border-blue-100 hover:border-amber-300 hover:shadow-[0_15px_35px_rgba(245,158,11,0.12)] transition-all duration-200 shadow-[0_8px_25px_rgba(30,58,138,0.04)] flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold mb-3 group-hover:scale-105 transition-transform shadow-2xs">
                <Shield className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">Host Command</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Launch questions, manage 8 teams, orchestrate timers, and score answers.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-amber-600 font-bold text-xs uppercase tracking-wider mt-4 group-hover:translate-x-1 transition-transform">
              <span>Admin Center</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>

        {/* Feature Strip */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl text-[11px] font-semibold text-slate-600 mb-3 sm:mb-4">
          <span className="px-3 py-1 rounded-full bg-white/85 border border-blue-100 flex items-center gap-1.5 shadow-2xs">
            <Zap className="w-3.5 h-3.5 text-amber-500" /> 8-Team Live Sync
          </span>
          <span className="px-3 py-1 rounded-full bg-white/85 border border-blue-100 flex items-center gap-1.5 shadow-2xs">
            <Flame className="w-3.5 h-3.5 text-rose-500" /> Rapid Fire Matrix
          </span>
          <span className="px-3 py-1 rounded-full bg-white/85 border border-blue-100 flex items-center gap-1.5 shadow-2xs">
            <Trophy className="w-3.5 h-3.5 text-emerald-500" /> Realtime Leaderboard
          </span>
        </div>

        {/* Support Team */}
        <div className="flex items-center justify-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/90 backdrop-blur-xl border border-blue-100 shadow-2xs text-[11px] text-slate-600">
            <span className="font-bold text-slate-700">Support Team:</span>
            <span>📞</span>
            <a
              href="tel:+9779742290123"
              className="font-medium text-slate-700 hover:text-blue-600 transition-colors"
            >
              +977-9742290123
            </a>
            <span className="text-slate-300 font-bold">|</span>
            <a
              href="tel:9825929601"
              className="font-medium text-slate-700 hover:text-blue-600 transition-colors"
            >
              9825929601
            </a>
          </div>
        </div>
      </main>

      {/* Clean Minimal Footer */}
      <footer className="border-t border-blue-200/50 px-6 py-2 text-center text-[10px] font-semibold text-slate-400 tracking-wider uppercase shrink-0">
        Bluefox Quiz &bull; Live Tournament Suite
      </footer>
    </div>
  );
}

