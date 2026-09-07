'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, KeyRound, ArrowRight, PlusCircle, Sparkles, ChevronLeft, Lock } from 'lucide-react';
import { authenticateAdmin, createRoom } from '@/lib/actions';
import { SiteLogo } from '@/components/SiteLogo';

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
    <div className="min-h-screen bg-[#edf2f9] text-slate-800 flex flex-col justify-center items-center px-4 relative overflow-hidden selection:bg-blue-500/20">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-blue-300/30 via-indigo-200/20 to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-sky-200/30 rounded-full blur-[100px] pointer-events-none" />

      {/* Top back shortcut */}
      <div className="w-full max-w-md mb-6 z-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Home</span>
        </Link>
      </div>

      <div className="w-full max-w-md z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <SiteLogo size="lg" className="mx-auto mb-4" />
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            {isAuthenticated ? 'Create Quiz Room' : 'Host Portal'}
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {isAuthenticated ? 'Configure your session & launch live command center' : 'Enter security PIN to continue'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/85 backdrop-blur-2xl border border-blue-100/90 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(30,58,138,0.06)]">
          {error && (
            <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isAuthenticated ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">
                  Security PIN
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    autoFocus
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono text-lg tracking-[0.3em] transition-all shadow-2xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !pin}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 font-bold text-xs uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition-all active:scale-[0.99] disabled:opacity-40 cursor-pointer"
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
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Host access unlocked</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">
                  Room Name
                </label>
                <input
                  type="text"
                  autoFocus
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. Annual Champions League"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 text-sm font-medium transition-all shadow-2xs"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 font-bold text-xs uppercase tracking-wider text-white shadow-md shadow-emerald-500/25 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
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
