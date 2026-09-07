'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, KeyRound, ArrowRight, PlusCircle, Sparkles, ChevronLeft, Lock } from 'lucide-react';
import { authenticateAdmin, createRoom } from '@/lib/actions';

export default function AdminLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const ok = await authenticateAdmin(pin);
      if (ok) {
        setIsAuthenticated(true);
      } else {
        setError('Invalid Admin PIN.');
      }
    } catch (err) {
      setError((err as Error).message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const room = await createRoom(roomName || 'Bluefox Championship');
      router.push(`/admin/room/${room.id}`);
    } catch (err) {
      setError((err as Error).message || 'Failed to create room');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-zinc-100 flex flex-col justify-center items-center px-4 relative overflow-hidden selection:bg-indigo-500/30">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-indigo-600/15 via-blue-600/10 to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Top back shortcut */}
      <div className="w-full max-w-md mb-6 z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Home</span>
        </Link>
      </div>

      <div className="w-full max-w-md z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 via-blue-600 to-slate-900 p-[1px] shadow-2xl shadow-indigo-500/20 mx-auto mb-4">
            <div className="w-full h-full bg-[#0b0e14] rounded-[23px] flex items-center justify-center text-3xl">
              🦊
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            {isAuthenticated ? 'Create Quiz Room' : 'Host Portal'}
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-medium">
            {isAuthenticated ? 'Configure your session & launch live command center' : 'Enter security PIN to continue'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
          {error && (
            <div className="mb-6 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isAuthenticated ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400 mb-2">
                  Security PIN
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="password"
                    required
                    autoFocus
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/40 border border-white/[0.08] rounded-2xl pl-11 pr-4 py-3.5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 font-mono text-lg tracking-[0.3em] transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !pin}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 hover:from-indigo-500 hover:to-blue-500 font-bold text-xs uppercase tracking-wider text-white shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.99] disabled:opacity-40"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Authorize</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCreateRoom} className="space-y-5">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Host access unlocked</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-zinc-400 mb-2">
                  Room Name
                </label>
                <input
                  type="text"
                  autoFocus
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. Annual Champions League"
                  className="w-full bg-black/40 border border-white/[0.08] rounded-2xl px-4 py-3.5 text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/20 text-sm font-medium transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-bold text-xs uppercase tracking-wider text-white shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>Create &amp; Launch</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
