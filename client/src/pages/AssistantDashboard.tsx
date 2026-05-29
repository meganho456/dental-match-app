import { useState, useEffect, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';

const TIERS = ['RDA', 'DA'];
const SOFTWARE_OPTIONS = ['OPEN_DENTAL', 'DENTRIX', 'EAGLESOFT', 'CURVE_DENTAL', 'CARESTREAM', 'OTHER'];

interface Match {
  id: string; status: string; bidRate: string | null;
  clockedInAt: string | null; clockedOutAt: string | null; placedAt: string | null;
  job: {
    id: string; type: string;
    shiftStart: string | null; shiftEnd: string | null;
    hourlyRate: string | null;
    clinic: { companyName: string };
    location?: { city: string | null; state: string | null; country?: string };
  };
}
interface Review { id: string; matchId: string; authorId: string; rating: number; }

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  DECLINED: 'bg-red-100 text-red-700',
  CLOCKED_IN: 'bg-indigo-100 text-indigo-700',
  CLOCKED_OUT: 'bg-purple-100 text-purple-700',
  PLACED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export default function AssistantDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Profile form
  const [tier, setTier] = useState('RDA');
  const [software, setSoftware] = useState<string[]>([]);
  const [travelRadius, setTravelRadius] = useState('10');
  const [hourlyRate, setHourlyRate] = useState('');
  const [openToPermanent, setOpenToPermanent] = useState(false);
  const [bio, setBio] = useState('');
  const [yearsExp, setYearsExp] = useState('');

  // Review form
  const [reviewMatchId, setReviewMatchId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const notify = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type });

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (user.role !== 'ASSISTANT') { navigate('/'); return; }
    loadAll();
  }, [user]);

  const loadAll = async () => {
    const [profRes, matchRes, reviewRes] = await Promise.allSettled([
      api.get(`/assistants/${user!.id}`),
      api.get('/matches?limit=100'),
      api.get(`/reviews/user/${user!.id}`),
    ]);
    if (profRes.status === 'fulfilled') {
      const p = profRes.value.data;
      setProfile(p);
      setTier(p.tier ?? 'RDA');
      setSoftware(p.software ?? []);
      setTravelRadius(String(p.travelRadius ?? 10));
      setHourlyRate(p.hourlyRate ? parseFloat(p.hourlyRate).toString() : '');
      setOpenToPermanent(p.openToPermanent ?? false);
      setBio(p.bio ?? '');
      setYearsExp(p.yearsExp != null ? String(p.yearsExp) : '');
    }
    if (matchRes.status === 'fulfilled') setMatches(matchRes.value.data.data);
    if (reviewRes.status === 'fulfilled') setMyReviews(reviewRes.value.data.data);
  };

  const toggleSoftware = (s: string) =>
    setSoftware((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/assistants/${user!.id}`, {
        tier, software,
        travelRadius: Number(travelRadius),
        hourlyRate: Number(hourlyRate),
        openToPermanent,
        bio: bio || null,
        yearsExp: yearsExp ? Number(yearsExp) : null,
      });
      notify(profile ? 'Profile updated!' : 'Profile created!');
      loadAll();
    } catch (err: any) {
      notify(err.response?.data?.error ?? 'Failed to save profile', 'error');
    }
  };

  const updateMatch = async (matchId: string, status: string) => {
    try {
      await api.patch(`/matches/${matchId}/status`, { status });
      notify(`Status updated to ${status.toLowerCase()}.`);
      loadAll();
    } catch (err: any) {
      notify(err.response?.data?.error ?? 'Failed to update status', 'error');
    }
  };

  const withdrawBid = async (matchId: string) => {
    if (!window.confirm('Withdraw this bid?')) return;
    try {
      await api.delete(`/matches/${matchId}`);
      notify('Bid withdrawn.');
      loadAll();
    } catch (err: any) {
      notify(err.response?.data?.error ?? 'Failed to withdraw bid', 'error');
    }
  };

  const submitReview = async (matchId: string) => {
    try {
      await api.post('/reviews', { matchId, rating: reviewRating, comment: reviewComment || undefined });
      notify('Review submitted!');
      setReviewMatchId(null);
      setReviewComment('');
      setReviewRating(5);
      loadAll();
    } catch (err: any) {
      notify(err.response?.data?.error ?? 'Failed to submit review', 'error');
    }
  };

  const alreadyReviewed = (matchId: string) =>
    myReviews.some((r) => r.matchId === matchId && r.authorId === user!.id);

  const activeMatches = matches.filter((m) => !['DECLINED', 'CANCELLED'].includes(m.status));
  const pastMatches   = matches.filter((m) => ['DECLINED', 'CANCELLED'].includes(m.status));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Assistant Dashboard</h1>

      {/* ── Profile ─────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-4">
          {profile ? 'My Profile' : '① Complete Your Profile to Start Bidding'}
        </h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Certification *</label>
              <select value={tier} onChange={(e) => setTier(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {TIERS.map((t) => <option key={t} value={t}>{t === 'RDA' ? 'RDA (Registered)' : 'DA (Dental Asst.)'}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Desired Rate ($/hr) *</label>
              <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} required min="1" step="0.5"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Travel Radius (mi) *</label>
              <input type="number" value={travelRadius} onChange={(e) => setTravelRadius(e.target.value)} required min="1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Years Experience</label>
              <input type="number" value={yearsExp} onChange={(e) => setYearsExp(e.target.value)} min="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-2">Software Skills</label>
            <div className="flex flex-wrap gap-2">
              {SOFTWARE_OPTIONS.map((s) => (
                <button key={s} type="button" onClick={() => toggleSoftware(s)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    software.includes(s)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}>
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={openToPermanent} onChange={(e) => setOpenToPermanent(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm text-gray-700">Open to permanent positions</span>
          </label>

          <textarea value={bio} onChange={(e) => setBio(e.target.value)}
            placeholder="Short bio (optional)" rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

          <button type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg">
            {profile ? 'Update Profile' : 'Create Profile'}
          </button>
        </form>
      </section>

      {/* ── Bids / Matches ───────────────────────────────────── */}
      {profile ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">My Bids & Shifts</h2>
            <Link to="/jobs" className="text-sm text-blue-600 hover:underline font-medium">
              Browse open jobs →
            </Link>
          </div>

          {activeMatches.length === 0 && pastMatches.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center shadow-sm">
              <p className="text-gray-400 text-sm mb-3">No bids yet.</p>
              <Link to="/jobs"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-lg">
                Browse Open Jobs
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {activeMatches.map((m) => (
                <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{m.job.clinic.companyName}</p>
                      <p className="text-xs text-gray-500">
                        {m.job.type}
                        {m.job.shiftStart
                          ? ` · ${new Date(m.job.shiftStart).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
                            + ` · ${new Date(m.job.shiftStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                            + ` – ${new Date(m.job.shiftEnd!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                          : ''}
                        {m.bidRate ? ` · Your bid: $${parseFloat(m.bidRate)}/hr` : ''}
                        {!m.bidRate && m.job.hourlyRate ? ` · $${parseFloat(m.job.hourlyRate).toFixed(0)}/hr` : ''}
                      </p>
                      {m.clockedInAt && <p className="text-xs text-gray-400 mt-0.5">Clocked in: {new Date(m.clockedInAt).toLocaleTimeString()}</p>}
                      {m.clockedOutAt && <p className="text-xs text-gray-400 mt-0.5">Clocked out: {new Date(m.clockedOutAt).toLocaleTimeString()}</p>}
                      {m.placedAt && <p className="text-xs text-green-600 mt-0.5 font-medium">Placed {new Date(m.placedAt).toLocaleDateString()}</p>}
                      <span className={`inline-block mt-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[m.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {m.status}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0 items-end">
                      {m.status === 'ACCEPTED' && m.job.type === 'TEMP' && (
                        <button onClick={() => updateMatch(m.id, 'CLOCKED_IN')}
                          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg font-medium">
                          Clock In
                        </button>
                      )}
                      {m.status === 'CLOCKED_IN' && (
                        <button onClick={() => updateMatch(m.id, 'CLOCKED_OUT')}
                          className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg font-medium">
                          Clock Out
                        </button>
                      )}
                      {m.status === 'PENDING' && (
                        <button onClick={() => withdrawBid(m.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium border border-red-200 px-3 py-1.5 rounded-lg">
                          Withdraw
                        </button>
                      )}
                      {m.status === 'PLACED' && !alreadyReviewed(m.id) && (
                        reviewMatchId === m.id ? (
                          <div className="text-right space-y-2">
                            <div className="flex gap-1 justify-end">
                              {[1,2,3,4,5].map((n) => (
                                <button key={n} type="button" onClick={() => setReviewRating(n)}
                                  className={`text-xl ${n <= reviewRating ? 'text-yellow-400' : 'text-gray-300'}`}>★</button>
                              ))}
                            </div>
                            <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)}
                              placeholder="Comment (optional)" rows={2}
                              className="w-48 border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => submitReview(m.id)}
                                className="text-xs bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded-lg font-medium">Submit</button>
                              <button onClick={() => setReviewMatchId(null)}
                                className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setReviewMatchId(m.id)}
                            className="text-xs bg-yellow-50 hover:bg-yellow-100 text-yellow-700 border border-yellow-200 px-3 py-1.5 rounded-lg font-medium">
                            Leave Review
                          </button>
                        )
                      )}
                      {m.status === 'PLACED' && alreadyReviewed(m.id) && (
                        <span className="text-xs text-green-600 font-medium">Reviewed ✓</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {pastMatches.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                    {pastMatches.length} declined / cancelled bid{pastMatches.length !== 1 ? 's' : ''}
                  </summary>
                  <div className="space-y-2 mt-2">
                    {pastMatches.map((m) => (
                      <div key={m.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">{m.job.clinic.companyName}</p>
                          <p className="text-xs text-gray-400">{m.job.type}{m.job.shiftStart ? ` · ${new Date(m.job.shiftStart).toLocaleDateString()}` : ''}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[m.status] ?? ''}`}>{m.status}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-center text-gray-400 py-6 text-sm">Create your profile above to start bidding on jobs.</p>
      )}
    </div>
  );
}
