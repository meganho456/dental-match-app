import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';

interface Job {
  id: string;
  type: 'TEMP' | 'PERMANENT';
  status: string;
  hourlyRate: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  slots: number;
  requiredTier: string | null;
  description: string | null;
  location: { id: string; name: string | null; city: string | null; state: string | null; country?: string };
  clinic: { id: string; companyName: string };
  _count: { matches: number };
}

export default function JobsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Bid state per job
  const [biddingJob, setBiddingJob] = useState<string | null>(null);
  const [bidRate, setBidRate] = useState('');
  const [bidLoading, setBidLoading] = useState(false);

  const notify = (msg: string, type: 'success' | 'error' = 'success') => setToast({ msg, type });

  const fetchJobs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ status: 'OPEN', limit: '50' });
    if (typeFilter) params.set('type', typeFilter);
    if (cityFilter) params.set('city', cityFilter);
    api.get(`/jobs?${params}`)
      .then((r) => setJobs(r.data.data))
      .catch(() => notify('Failed to load jobs', 'error'))
      .finally(() => setLoading(false));
  }, [typeFilter, cityFilter]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const placeBid = async (job: Job) => {
    if (!user) { navigate('/login'); return; }
    if (user.role !== 'ASSISTANT') {
      notify('Only assistants can place bids', 'error');
      return;
    }
    setBidLoading(true);
    try {
      await api.post('/matches', {
        jobId: job.id,
        ...(job.type === 'TEMP' ? { bidRate: Number(bidRate) } : {}),
      });
      notify('Bid placed! Check your dashboard to track it.');
      setBiddingJob(null);
      setBidRate('');
      fetchJobs();
    } catch (err: any) {
      notify(err.response?.data?.error ?? 'Failed to place bid', 'error');
    } finally {
      setBidLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Open Jobs</h1>
        <div className="flex gap-2 flex-wrap">
          {/* Type filter */}
          {(['', 'TEMP', 'PERMANENT'] as const).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                typeFilter === t
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400 bg-white'
              }`}>
              {t === '' ? 'All' : t}
            </button>
          ))}
        </div>
      </div>

      {/* City search */}
      <div className="flex gap-2 mb-6">
        <input
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setCityFilter(cityInput.trim()); }}
          placeholder="Filter by city…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <button onClick={() => setCityFilter(cityInput.trim())}
          className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg">Search</button>
        {cityFilter && (
          <button onClick={() => { setCityFilter(''); setCityInput(''); }}
            className="text-sm text-gray-500 hover:text-gray-700 px-2">Clear</button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-1">No open jobs found.</p>
          {cityFilter && <p className="text-sm">Try a different city or clear the filter.</p>}
        </div>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <div key={job.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      job.type === 'TEMP' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                    }`}>{job.type}</span>
                    {job.requiredTier && (
                      <span className="text-xs bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded-full">
                        {job.requiredTier} required
                      </span>
                    )}
                    {job.slots > 1 && (
                      <span className="text-xs bg-gray-100 text-gray-600 font-medium px-2 py-0.5 rounded-full">
                        {job.slots} slots
                      </span>
                    )}
                  </div>

                  <h2 className="text-base font-semibold text-gray-900">{job.clinic.companyName}</h2>
                  <p className="text-sm text-gray-500">
                    {[job.location.city, job.location.state].filter(Boolean).join(', ')}
                    {job.location.country && job.location.country !== 'US' ? ` · ${job.location.country}` : ''}
                    {job.location.name ? ` · ${job.location.name}` : ''}
                  </p>

                  {job.type === 'TEMP' && job.shiftStart && (
                    <p className="text-sm text-gray-600 mt-1">
                      {new Date(job.shiftStart).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' · '}
                      {new Date(job.shiftStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      {' – '}
                      {new Date(job.shiftEnd!).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  )}

                  {job.description && (
                    <p className="text-sm text-gray-500 mt-2 line-clamp-2">{job.description}</p>
                  )}

                  <p className="text-xs text-gray-400 mt-2">
                    {job._count.matches} bid{job._count.matches !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Pay */}
                <div className="text-right shrink-0">
                  {job.hourlyRate && (
                    <p className="text-xl font-bold text-gray-900">
                      ${parseFloat(job.hourlyRate).toFixed(0)}
                      <span className="text-sm font-normal text-gray-400">/hr</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Bid actions — assistants only */}
              {user?.role === 'ASSISTANT' && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  {biddingJob === job.id ? (
                    <div className="flex gap-2 items-center flex-wrap">
                      {job.type === 'TEMP' && (
                        <input
                          type="number"
                          placeholder="Your rate ($/hr)"
                          value={bidRate}
                          onChange={(e) => setBidRate(e.target.value)}
                          min="1" step="0.5"
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-44 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                      <button
                        onClick={() => placeBid(job)}
                        disabled={bidLoading || (job.type === 'TEMP' && !bidRate)}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg"
                      >
                        {bidLoading ? 'Submitting…' : 'Submit Bid'}
                      </button>
                      <button onClick={() => { setBiddingJob(null); setBidRate(''); }}
                        className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setBiddingJob(job.id)}
                      className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium px-4 py-1.5 rounded-lg"
                    >
                      Place Bid
                    </button>
                  )}
                </div>
              )}

              {!user && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <Link to="/login" className="text-sm text-blue-600 hover:underline font-medium">
                    Sign in to place a bid →
                  </Link>
                </div>
              )}

              {user?.role === 'CLINIC' && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400">Switch to an assistant account to bid on jobs.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
