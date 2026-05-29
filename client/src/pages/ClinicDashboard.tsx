import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';

interface Location {
  id: string; name: string | null; country: string;
  street: string; city: string | null; state: string | null; postal: string;
}
interface Job {
  id: string; type: 'TEMP' | 'PERMANENT'; status: string;
  hourlyRate: string | null;
  shiftStart: string | null; shiftEnd: string | null;
  description: string | null;
  _count: { matches: number };
  location: { city: string | null; state: string | null; country: string };
}
interface Match {
  id: string; status: string; bidRate: string | null;
  clockedInAt: string | null; clockedOutAt: string | null; placedAt: string | null;
  assistant: { id: string; tier: string; user: { id: string; email: string } };
  job: { id: string; type: string; shiftStart: string | null };
}
interface Review { id: string; matchId: string; authorId: string; rating: number; comment: string | null; }

type Tab = 'jobs' | 'matches';
type Country = 'US' | 'SG';

const COUNTRIES: { code: Country; label: string }[] = [
  { code: 'US', label: 'United States' },
  { code: 'SG', label: 'Singapore' },
];

function formatLocation(loc: Location) {
  const parts = [loc.street];
  if (loc.city) parts.push(loc.city);
  if (loc.state) parts.push(loc.state);
  parts.push(loc.postal);
  if (loc.country !== 'US') parts.push(loc.country);
  return parts.join(', ');
}

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  FILLED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  EXPIRED: 'bg-yellow-100 text-yellow-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  DECLINED: 'bg-red-100 text-red-700',
  CLOCKED_IN: 'bg-indigo-100 text-indigo-700',
  CLOCKED_OUT: 'bg-purple-100 text-purple-700',
  PLACED: 'bg-green-100 text-green-700',
};

export default function ClinicDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('jobs');
  const [profile, setProfile] = useState<{ id: string; companyName: string; phone: string | null; website: string | null } | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Profile form
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');

  // Location form — country-aware
  const [locCountry, setLocCountry] = useState<Country>('US');
  const [locName, setLocName] = useState('');
  const [locStreet, setLocStreet] = useState('');
  const [locCity, setLocCity] = useState('');
  const [locState, setLocState] = useState('');
  const [locPostal, setLocPostal] = useState('');

  // Job form
  const [jobType, setJobType] = useState<'TEMP' | 'PERMANENT'>('TEMP');
  const [jobLocationId, setJobLocationId] = useState('');
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [jobSlots, setJobSlots] = useState('1');

  // Review form
  const [reviewMatchId, setReviewMatchId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const notify = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type });

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (user.role !== 'CLINIC') { navigate('/'); return; }
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    try {
      const r = await api.get(`/clinics/${user!.id}`);
      const p = r.data;
      setProfile({ id: p.id, companyName: p.companyName, phone: p.phone, website: p.website });
      setCompanyName(p.companyName ?? '');
      setPhone(p.phone ?? '');
      setWebsite(p.website ?? '');
      setLocations(p.locations ?? []);
      await loadJobsAndMatches(p.id);
    } catch { /* no profile yet */ }
  };

  const loadJobsAndMatches = async (clinicProfileId: string) => {
    const [jobsRes, matchesRes, reviewsRes] = await Promise.allSettled([
      api.get(`/jobs?clinicId=${clinicProfileId}&status=ALL&limit=100`),
      api.get('/matches?limit=100'),
      api.get(`/reviews/user/${user!.id}`),
    ]);
    if (jobsRes.status === 'fulfilled')    setJobs(jobsRes.value.data.data);
    if (matchesRes.status === 'fulfilled') setMatches(matchesRes.value.data.data);
    if (reviewsRes.status === 'fulfilled') setMyReviews(reviewsRes.value.data.data);
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/clinics/${user!.id}`, { companyName, phone: phone || null, website: website || null });
      notify(profile ? 'Profile updated!' : 'Profile created!');
      loadProfile();
    } catch (err: any) {
      notify(err.response?.data?.error ?? 'Failed to save profile', 'error');
    }
  };

  const addLocation = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/clinics/${user!.id}/locations`, {
        country: locCountry,
        name:    locName || null,
        street:  locStreet,
        city:    locCity   || null,
        state:   locState  || null,
        postal:  locPostal,
      });
      setLocName(''); setLocStreet(''); setLocCity(''); setLocState(''); setLocPostal('');
      notify('Location added!');
      loadProfile();
    } catch (err: any) {
      notify(err.response?.data?.error ?? 'Failed to add location', 'error');
    }
  };

  const deleteLocation = async (id: string) => {
    if (!window.confirm('Remove this location? Jobs posted there will remain.')) return;
    try {
      await api.delete(`/clinics/${user!.id}/locations/${id}`);
      notify('Location removed.');
      loadProfile();
    } catch (err: any) {
      notify(err.response?.data?.error ?? 'Failed to remove location', 'error');
    }
  };

  const postJob = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const body: Record<string, unknown> = {
        type: jobType, locationId: jobLocationId,
        slots: Number(jobSlots), hourlyRate: Number(hourlyRate),
        description: jobDesc || undefined,
      };
      if (jobType === 'TEMP') {
        body.shiftStart = new Date(shiftStart).toISOString();
        body.shiftEnd   = new Date(shiftEnd).toISOString();
      }
      await api.post('/jobs', body);
      notify('Job posted!');
      setShiftStart(''); setShiftEnd(''); setHourlyRate(''); setJobDesc(''); setJobSlots('1');
      if (profile) loadJobsAndMatches(profile.id);
    } catch (err: any) {
      notify(err.response?.data?.error ?? 'Failed to post job', 'error');
    }
  };

  const cancelJob = async (id: string) => {
    if (!window.confirm('Cancel this job posting?')) return;
    try {
      await api.delete(`/jobs/${id}`);
      notify('Job cancelled.');
      if (profile) loadJobsAndMatches(profile.id);
    } catch (err: any) {
      notify(err.response?.data?.error ?? 'Failed to cancel job', 'error');
    }
  };

  const updateMatch = async (matchId: string, status: string) => {
    try {
      await api.patch(`/matches/${matchId}/status`, { status });
      notify(`Match ${status.toLowerCase()}.`);
      if (profile) loadJobsAndMatches(profile.id);
    } catch (err: any) {
      notify(err.response?.data?.error ?? 'Failed to update match', 'error');
    }
  };

  const submitReview = async (matchId: string) => {
    try {
      await api.post('/reviews', { matchId, rating: reviewRating, comment: reviewComment || undefined });
      notify('Review submitted!');
      setReviewMatchId(null); setReviewComment(''); setReviewRating(5);
      if (profile) loadJobsAndMatches(profile.id);
    } catch (err: any) {
      notify(err.response?.data?.error ?? 'Failed to submit review', 'error');
    }
  };

  const alreadyReviewed = (matchId: string) =>
    myReviews.some((r) => r.matchId === matchId && r.authorId === user!.id);

  const needsState = locCountry === 'US';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Clinic Dashboard</h1>

      {/* ── Profile ─────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-xl p-5 mb-5 shadow-sm">
        <h2 className="font-semibold text-gray-800 mb-3">
          {profile ? 'Clinic Profile' : '① Create Your Clinic Profile'}
        </h2>
        <form onSubmit={saveProfile} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Company name *" required
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit"
            className="sm:col-span-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg">
            {profile ? 'Update Profile' : 'Create Profile'}
          </button>
        </form>
      </section>

      {/* ── Locations ───────────────────────────────────────── */}
      {profile && (
        <section className="bg-white border border-gray-200 rounded-xl p-5 mb-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-3">
            {locations.length === 0 ? '② Add a Location (required to post jobs)' : 'Locations'}
          </h2>
          {locations.length > 0 && (
            <ul className="divide-y divide-gray-100 mb-4">
              {locations.map((loc) => (
                <li key={loc.id} className="py-2 flex items-center justify-between">
                  <span className="text-sm text-gray-700">
                    {loc.name ? <><strong>{loc.name}</strong> — </> : null}
                    {formatLocation(loc)}
                  </span>
                  <button onClick={() => deleteLocation(loc.id)}
                    className="text-xs text-red-500 hover:text-red-700 ml-4 shrink-0">Remove</button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={addLocation} className="space-y-3">
            {/* Country first */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Country *</label>
                <select value={locCountry} onChange={(e) => { setLocCountry(e.target.value as Country); setLocState(''); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Branch / Office Name (opt.)</label>
                <input value={locName} onChange={(e) => setLocName(e.target.value)}
                  placeholder="e.g. City Hall Branch"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* Street — always shown */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {locCountry === 'SG' ? 'Block / Street Address *' : 'Street Address *'}
              </label>
              <input value={locStreet} onChange={(e) => setLocStreet(e.target.value)} required
                placeholder={locCountry === 'SG' ? 'e.g. 1 Kim Seng Promenade' : 'e.g. 100 Smile Street'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* City + State (US) or City/District optional (SG) + Postal */}
            <div className={`grid gap-3 ${needsState ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div className={needsState ? '' : ''}>
                <label className="block text-xs text-gray-500 mb-1">
                  {locCountry === 'SG' ? 'Area / District (opt.)' : 'City *'}
                </label>
                <input value={locCity} onChange={(e) => setLocCity(e.target.value)}
                  required={needsState}
                  placeholder={locCountry === 'SG' ? 'e.g. Orchard' : 'e.g. San Diego'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {needsState && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">State *</label>
                  <input value={locState} onChange={(e) => setLocState(e.target.value)} required maxLength={2}
                    placeholder="e.g. CA"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {locCountry === 'SG' ? 'Postal Code * (6 digits)' : 'ZIP Code *'}
                </label>
                <input value={locPostal} onChange={(e) => setLocPostal(e.target.value)} required
                  placeholder={locCountry === 'SG' ? 'e.g. 237994' : 'e.g. 92101'}
                  maxLength={locCountry === 'SG' ? 6 : 10}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <button type="submit"
              className="w-full bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium py-2 rounded-lg">
              + Add Location
            </button>
          </form>
        </section>
      )}

      {/* ── Tabs ────────────────────────────────────────────── */}
      {profile && locations.length > 0 && (
        <>
          <div className="flex border-b border-gray-200 mb-4 gap-6">
            {(['jobs', 'matches'] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`pb-2 text-sm font-medium capitalize border-b-2 transition-colors ${
                  tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {t}
                {t === 'matches' && matches.filter((m) => m.status === 'PENDING').length > 0 && (
                  <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {matches.filter((m) => m.status === 'PENDING').length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Jobs tab ─────────────────────────────────────── */}
          {tab === 'jobs' && (
            <>
              <section className="bg-white border border-gray-200 rounded-xl p-5 mb-4 shadow-sm">
                <h2 className="font-semibold text-gray-800 mb-3">Post a Job</h2>
                <form onSubmit={postJob} className="space-y-3">
                  <div className="flex gap-3">
                    {(['TEMP', 'PERMANENT'] as const).map((t) => (
                      <button key={t} type="button" onClick={() => setJobType(t)}
                        className={`flex-1 border rounded-lg py-2 text-sm font-medium transition-colors ${
                          jobType === t ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:border-gray-400'
                        }`}>
                        {t === 'TEMP' ? 'Temp Shift' : 'Permanent Role'}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <select value={jobLocationId} onChange={(e) => setJobLocationId(e.target.value)} required
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select location *</option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name ? `${l.name} — ` : ''}{l.city ?? l.street}, {l.country}
                        </option>
                      ))}
                    </select>
                    <input type="number" value={jobSlots} onChange={(e) => setJobSlots(e.target.value)}
                      min="1" placeholder="Slots (default 1)"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  {/* Hourly rate — always shown for both TEMP and PERMANENT */}
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Hourly Rate ($/hr) *</label>
                    <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)}
                      required min="1" step="0.5"
                      placeholder={jobType === 'TEMP' ? 'e.g. 32' : 'e.g. 28 (hourly equivalent)'}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  {/* Shift times — TEMP only */}
                  {jobType === 'TEMP' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Shift Start *</label>
                        <input type="datetime-local" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} required
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Shift End *</label>
                        <input type="datetime-local" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} required
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                  )}

                  <textarea value={jobDesc} onChange={(e) => setJobDesc(e.target.value)}
                    placeholder="Job description (optional)" rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />

                  <button type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg">
                    Post Job
                  </button>
                </form>
              </section>

              {jobs.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No jobs posted yet.</p>
              ) : (
                <div className="space-y-3">
                  {jobs.map((job) => (
                    <div key={job.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            job.type === 'TEMP' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                          }`}>{job.type}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[job.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {job.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">
                          {job.location.city ?? job.location.country}
                          {job.location.state ? `, ${job.location.state}` : ''}
                          {job.type === 'TEMP' && job.shiftStart
                            ? ` · ${new Date(job.shiftStart).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}
                          {job.hourlyRate ? ` · $${parseFloat(job.hourlyRate)}/hr` : ''}
                        </p>
                        {job.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{job.description}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">{job._count.matches} bid{job._count.matches !== 1 ? 's' : ''}</p>
                      </div>
                      {job.status === 'OPEN' && (
                        <button onClick={() => cancelJob(job.id)}
                          className="text-xs text-red-500 hover:text-red-700 shrink-0 font-medium">Cancel</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Matches tab ───────────────────────────────────── */}
          {tab === 'matches' && (
            <div className="space-y-3">
              {matches.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No bids received yet.</p>
              ) : matches.map((m) => (
                <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{m.assistant.user.email}</p>
                      <p className="text-xs text-gray-500">
                        {m.assistant.tier}
                        {m.bidRate ? ` · Bid: $${parseFloat(m.bidRate)}/hr` : ''}
                        {m.job.shiftStart ? ` · ${new Date(m.job.shiftStart).toLocaleDateString()}` : ` · ${m.job.type}`}
                      </p>
                      {m.clockedInAt  && <p className="text-xs text-gray-400">In: {new Date(m.clockedInAt).toLocaleTimeString()}</p>}
                      {m.clockedOutAt && <p className="text-xs text-gray-400">Out: {new Date(m.clockedOutAt).toLocaleTimeString()}</p>}
                      <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[m.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {m.status}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0 items-end">
                      {m.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button onClick={() => updateMatch(m.id, 'ACCEPTED')}
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium">Accept</button>
                          <button onClick={() => updateMatch(m.id, 'DECLINED')}
                            className="text-xs bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-medium">Decline</button>
                        </div>
                      )}
                      {m.status === 'CLOCKED_OUT' && (
                        <button onClick={() => updateMatch(m.id, 'PLACED')}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium">Confirm Placement</button>
                      )}
                      {m.status === 'ACCEPTED' && m.job.type === 'PERMANENT' && (
                        <button onClick={() => updateMatch(m.id, 'PLACED')}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium">Confirm Hire</button>
                      )}
                      {m.status === 'PLACED' && !alreadyReviewed(m.id) && (
                        reviewMatchId === m.id ? (
                          <div className="text-right space-y-2">
                            <div className="flex gap-1">
                              {[1,2,3,4,5].map((n) => (
                                <button key={n} type="button" onClick={() => setReviewRating(n)}
                                  className={`text-lg ${n <= reviewRating ? 'text-yellow-400' : 'text-gray-300'}`}>★</button>
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
            </div>
          )}
        </>
      )}

      {profile && locations.length === 0 && (
        <p className="text-center text-gray-400 py-6 text-sm">Add at least one location above to start posting jobs.</p>
      )}
      {!profile && (
        <p className="text-center text-gray-400 py-6 text-sm">Create your clinic profile above to get started.</p>
      )}
    </div>
  );
}
