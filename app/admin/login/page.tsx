'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, KeyRound, ArrowRight, PlusCircle, Sparkles } from 'lucide-react';
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
        setError('Invalid Admin PIN. Please try again.');
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
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center font-black text-2xl mx-auto shadow-xl shadow-indigo-600/30 mb-4">
            🦊
          </div>
          <h1 className="text-3xl font-black tracking-tight">Admin Host Portal</h1>
          <p className="text-sm text-zinc-400 mt-2">
            Enter your secret PIN to access room controls and question settings.
          </p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-medium">
              {error}
            </div>
          )}

          {!isAuthenticated ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Admin PIN Code
                </label>
                <div className="relative">
                  <KeyRound className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="password"
                    required
                    autoFocus
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter Admin PIN"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-lg tracking-widest"
                  />
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Default dev PIN is <code className="text-zinc-300">bluefox2026</code> (configured in ADMIN_PIN).
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !pin}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-white shadow-lg shadow-blue-600/25 transition disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Authenticate as Host</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleCreateRoom} className="space-y-5">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Authenticated! You can now create a new quiz room.</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  Room Name (e.g. Annual Trivia Championship)
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Bluefox Quiz Arena"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white shadow-lg shadow-emerald-600/25 transition disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>Create Room &amp; Launch Host Panel</span>
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
