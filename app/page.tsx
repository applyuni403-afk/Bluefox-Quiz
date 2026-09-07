import Link from 'next/link';
import { Play, Shield, Zap, Volume2, Trophy, Clock, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-white flex flex-col justify-between selection:bg-blue-600 selection:text-white">
      {/* Navbar */}
      <header className="border-b border-zinc-800/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-xl shadow-lg shadow-blue-500/30">
              🦊
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
              Bluefox Quiz
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition"
            >
              <Shield className="w-4 h-4 text-blue-400" />
              <span>Admin Host</span>
            </Link>
            <Link
              href="/join"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Join Game</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 py-16 sm:py-24 flex flex-col items-center text-center flex-1 justify-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-6">
          <Zap className="w-3.5 h-3.5" />
          <span>Vercel-Native Serverless Quiz Engine</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight max-w-4xl leading-[1.1] mb-6">
          Live, synchronized quizzes for up to{' '}
          <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-amber-300 bg-clip-text text-transparent">
            8 competitive groups.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mb-12">
          Full host control, millisecond-accurate synchronized countdown timers,
          text, MCQ, video & audio questions, team pass chains, sound effects, and rapid-fire rounds.
        </p>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mb-16 text-left">
          {/* Contestant Card */}
          <Link
            href="/join"
            className="group relative p-8 rounded-3xl bg-zinc-900/90 border border-zinc-800 hover:border-blue-500/60 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition">
              <Play className="w-28 h-28 text-blue-500" />
            </div>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold mb-4 group-hover:scale-110 transition">
                <Play className="w-6 h-6 fill-current" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">Join a Room</h3>
              <p className="text-sm text-zinc-400 mb-6">
                Have a 6-character room code? Enter with your team name and join the live contest.
              </p>
            </div>
            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm group-hover:translate-x-1 transition">
              <span>Enter Room Code</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Admin Card */}
          <Link
            href="/admin/login"
            className="group relative p-8 rounded-3xl bg-zinc-900/90 border border-zinc-800 hover:border-indigo-500/60 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition">
              <Shield className="w-28 h-28 text-indigo-500" />
            </div>
            <div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold mb-4 group-hover:scale-110 transition">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">Host / Admin</h3>
              <p className="text-sm text-zinc-400 mb-6">
                Create a quiz room, manage questions, launch timers, mark scores, and control the show.
              </p>
            </div>
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm group-hover:translate-x-1 transition">
              <span>Admin PIN Portal</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-4xl text-left">
          <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/60">
            <Clock className="w-5 h-5 text-blue-400 mb-2" />
            <h4 className="font-bold text-sm text-zinc-200">Sync Timer</h4>
            <p className="text-xs text-zinc-400 mt-1">
              Absolute server timestamp with local 250ms countdown.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/60">
            <Volume2 className="w-5 h-5 text-indigo-400 mb-2" />
            <h4 className="font-bold text-sm text-zinc-200">Media Questions</h4>
            <p className="text-xs text-zinc-400 mt-1">
              Muted autoplay video, audio tracks, and MCQ options.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/60">
            <Zap className="w-5 h-5 text-amber-400 mb-2" />
            <h4 className="font-bold text-sm text-zinc-200">Rapid Fire</h4>
            <p className="text-xs text-zinc-400 mt-1">
              Numbered tile board selected directly by individual players.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/60">
            <Trophy className="w-5 h-5 text-emerald-400 mb-2" />
            <h4 className="font-bold text-sm text-zinc-200">Live Scoring</h4>
            <p className="text-xs text-zinc-400 mt-1">
              Pass rotation chain, clap/wrong sounds, and podium.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 px-6 py-6 text-center text-xs text-zinc-500">
        <p>Bluefox Quiz &bull; Powered by Next.js App Router, Neon Postgres &amp; Vercel</p>
      </footer>
    </div>
  );
}
