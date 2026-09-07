'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import {
  Shield,
  KeyRound,
  ArrowRight,
  PlusCircle,
  Sparkles,
  ChevronLeft,
  Lock,
  LogOut,
  RotateCcw,
  Check,
  Copy,
} from 'lucide-react';
import {
  authenticateAdmin,
  createRoom,
  getAdminRooms,
  findRoomByIdOrCode,
  logoutAdminAction,
  checkAdminSessionAction,
} from '@/lib/actions';
import { SiteLogo } from '@/components/SiteLogo';
import { useNotification } from '@/context/NotificationContext';

export default function AdminLoginPage() {
  const router = useRouter();
  const { toast } = useNotification();
  const [pin, setPin] = useState('');
  const [roomName, setRoomName] = useState('');
  const [rejoinCodeOrId, setRejoinCodeOrId] = useState('');
  const [activeTab, setActiveTab] = useState<'create' | 'rejoin'>('create');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Check if session cookie is already valid
  useEffect(() => {
    let mounted = true;
    checkAdminSessionAction()
      .then((isAdmin) => {
        if (mounted && isAdmin) {
          setIsAuthenticated(true);
        }
      })
      .finally(() => {
        if (mounted) setCheckingSession(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch previous rooms once authenticated
  const { data: previousRooms = [], mutate: mutateRooms, isLoading: loadingRooms } = useSWR(
    isAuthenticated ? 'admin_rooms' : null,
    getAdminRooms
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const ok = await authenticateAdmin(pin);
      if (ok) {
        setIsAuthenticated(true);
        toast.success('Authorized', 'Welcome to Host Control Hub.');
      } else {
        const msg = 'Invalid Admin Security PIN.';
        setError(msg);
        toast.error('Authentication Error', msg);
      }
    } catch (err) {
      const msg = (err as Error).message || 'Authentication error';
      setError(msg);
      toast.error('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutAdminAction();
      setIsAuthenticated(false);
      setPin('');
      setError('');
      toast.info('Logged Out', 'Host session terminated.');
    } catch (err) {
      const msg = (err as Error).message || 'Failed to log out';
      setError(msg);
      toast.error('Logout Failed', msg);
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
      toast.success('Room Ready', `Studio opened for "${room.name}".`);
      router.push(`/admin/room/${room.id}`);
    } catch (err) {
      const msg = (err as Error).message || 'Failed to create room';
      setError(msg);
      toast.error('Failed to Create Room', msg);
      setLoading(false);
    }
  };

  const handleRejoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const clean = rejoinCodeOrId.trim();
    if (!clean) {
      setError('Please enter a Room ID or 6-digit Code.');
      toast.warning('Input Required', 'Please enter a Room ID or 6-digit Code.');
      return;
    }

    setLoading(true);
    try {
      const room = await findRoomByIdOrCode(clean);
      if (room) {
        toast.success('Room Found', `Reopening "${room.name}".`);
        router.push(`/admin/room/${room.id}`);
      } else {
        const msg = 'No room found with this ID or Code.';
        setError(msg);
        toast.error('Room Not Found', msg);
        setLoading(false);
      }
    } catch (err) {
      const msg = (err as Error).message || 'Failed to find room';
      setError(msg);
      toast.error('Search Failed', msg);
      setLoading(false);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success('Room ID Copied', 'Copied to clipboard.');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="h-screen max-h-screen overflow-hidden bg-[#edf2f9] text-slate-800 flex flex-col justify-between items-center p-3 sm:p-5 relative selection:bg-blue-500/20">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-blue-300/30 via-indigo-200/20 to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-sky-200/30 rounded-full blur-[100px] pointer-events-none" />

      {!isAuthenticated ? (
        /* Unauthenticated PIN View */
        <>
          <div className="w-full max-w-md shrink-0 z-10 pt-1">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Home</span>
            </Link>
          </div>

          <div className="w-full max-w-md z-10 my-auto flex flex-col justify-center">
            {/* Header */}
            <div className="text-center mb-4 shrink-0">
              <SiteLogo size="md" className="mx-auto mb-2" />
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                Host Portal
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Enter security PIN to access the Quiz Control Center
              </p>
            </div>

            {/* PIN Card */}
            <div className="bg-white/85 backdrop-blur-2xl border border-blue-100/90 rounded-3xl p-6 shadow-[0_15px_40px_rgba(30,58,138,0.06)] space-y-4">
              {error && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {checkingSession ? (
                <div className="py-8 text-center text-slate-500 text-xs font-medium">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <span>Checking session...</span>
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1.5">
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-3 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono text-base tracking-[0.3em] transition-all shadow-2xs"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !pin}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 font-bold text-xs uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition-all active:scale-[0.99] disabled:opacity-40 cursor-pointer"
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
              )}
            </div>
          </div>

          <footer className="text-center text-[10px] uppercase tracking-wider text-slate-400 py-1 shrink-0">
            Bluefox Quiz &bull; Host Security Gateway
          </footer>
        </>
      ) : (
        /* Authenticated 2-Column Desktop Studio Hub */
        <>
          {/* Top Bar */}
          <header className="w-full max-w-6xl mx-auto flex items-center justify-between pb-3 border-b border-blue-200/60 shrink-0 z-10">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-blue-100 text-slate-600 hover:text-slate-900 transition shadow-2xs"
                title="Home"
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
              <SiteLogo size="sm" />
              <div>
                <h1 className="font-black text-base sm:text-lg tracking-tight text-slate-900">
                  Host Control Hub
                </h1>
                <p className="text-[11px] text-slate-500 font-medium">Manage and orchestrate live quiz rooms</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Host Authorized</span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-bold transition shadow-2xs cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          </header>

          {/* Side-by-Side 2-Column Central Workspace */}
          <div className="w-full max-w-6xl mx-auto flex-1 min-h-0 my-auto grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch overflow-hidden pt-3 z-10">
            {/* Left 5 cols: Launch / Rejoin Form */}
            <div className="md:col-span-5 bg-white/85 backdrop-blur-2xl border border-blue-100/90 rounded-3xl p-5 shadow-[0_15px_40px_rgba(30,58,138,0.06)] flex flex-col justify-between overflow-y-auto">
              <div>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('create');
                      setError('');
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                      activeTab === 'create'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>New Room</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('rejoin');
                      setError('');
                    }}
                    className={`py-2 px-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                      activeTab === 'rejoin'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Rejoin</span>
                  </button>
                </div>

                {error && (
                  <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {activeTab === 'create' ? (
                  <form onSubmit={handleCreateRoom} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1.5">
                        Quiz Room Name
                      </label>
                      <input
                        type="text"
                        autoFocus
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder="e.g. Annual Champions League"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs sm:text-sm font-medium transition-all shadow-2xs"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-700 hover:to-indigo-700 font-bold text-xs uppercase tracking-wider text-white shadow-md shadow-blue-500/25 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <PlusCircle className="w-4 h-4" />
                          <span>Create &amp; Launch Studio</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleRejoinRoom} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1.5">
                        Room ID or 6-Digit Code
                      </label>
                      <input
                        type="text"
                        autoFocus
                        value={rejoinCodeOrId}
                        onChange={(e) => setRejoinCodeOrId(e.target.value)}
                        placeholder="e.g. BLUFOX or 62473eb5-..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono text-xs sm:text-sm font-bold text-center transition-all shadow-2xs"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !rejoinCodeOrId.trim()}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 font-bold text-xs uppercase tracking-wider text-white shadow-md shadow-indigo-500/25 transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          <span>Rejoin Room Console</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                <span>Hosts can configure questions, manage up to 8 teams, and control live timers.</span>
              </div>
            </div>

            {/* Right 7 cols: Scrollable Previous Rooms Manager */}
            <div className="md:col-span-7 bg-white/85 backdrop-blur-2xl border border-blue-100/90 rounded-3xl p-5 shadow-[0_15px_40px_rgba(30,58,138,0.06)] flex flex-col overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <span className="text-[11px] uppercase font-bold tracking-[0.15em] text-slate-600">
                  Previous Rooms ({previousRooms.length})
                </span>
                <button
                  type="button"
                  onClick={() => mutateRooms()}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                >
                  Refresh
                </button>
              </div>

              {loadingRooms ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium">
                  Loading previous rooms...
                </div>
              ) : previousRooms.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-medium bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 my-auto">
                  No previous rooms found. Create one on the left!
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 pt-3">
                  {previousRooms.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-2xl bg-white hover:bg-blue-50/50 border border-slate-200/80 hover:border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                            {r.name}
                          </span>
                          <span
                            className={`px-2 py-0.2 rounded-full text-[8px] font-black uppercase tracking-wider ${
                              r.status === 'playing'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : r.status === 'finished'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {r.status}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                          <span className="font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                            {r.code}
                          </span>
                          <span className="text-slate-300">&bull;</span>
                          <button
                            type="button"
                            onClick={() => handleCopyId(r.id)}
                            title="Copy Room ID"
                            className="font-mono text-[9px] text-slate-400 hover:text-slate-700 flex items-center gap-1 transition cursor-pointer"
                          >
                            <span>ID: {r.id.slice(0, 8)}...</span>
                            {copiedId === r.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      <Link
                        href={`/admin/room/${r.id}`}
                        className="self-end sm:self-center px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider shadow-2xs transition active:scale-95 shrink-0"
                      >
                        Reopen Studio
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <footer className="text-center text-[10px] uppercase tracking-wider text-slate-400 py-1 shrink-0">
            Bluefox Quiz &bull; Host Control Studio
          </footer>
        </>
      )}
    </div>
  );
}
