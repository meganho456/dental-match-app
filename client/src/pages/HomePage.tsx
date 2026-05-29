import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Logged-in users skip the landing page and go straight to their dashboard
  useEffect(() => {
    if (!loading && user) {
      navigate(user.role === 'CLINIC' ? '/dashboard/clinic' : '/dashboard/assistant', { replace: true });
    }
  }, [user, loading]);

  if (loading || user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <span className="inline-block bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
          Dental Staffing Made Simple
        </span>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-4">
          Connect Dental Clinics<br />with Skilled Assistants
        </h1>
        <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto">
          Post temp shifts or permanent roles. Browse and bid on jobs that match your skills and schedule.
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/register" className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg">
            Get Started
          </Link>
          <Link to="/jobs" className="border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-6 py-3 rounded-lg">
            Browse Jobs
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-20 text-left">
          {[
            { icon: '🦷', title: 'Post in Minutes', desc: 'Clinics can post TEMP shifts or PERMANENT roles with full scheduling and pay details.' },
            { icon: '📋', title: 'Smart Matching', desc: 'Assistants browse open jobs filtered by type, location, and required skills.' },
            { icon: '⏱', title: 'Full Lifecycle', desc: 'Track bids, clock-in/out, placements, and reviews — all in one place.' },
          ].map((card) => (
            <div key={card.title} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <div className="text-2xl mb-3">{card.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{card.title}</h3>
              <p className="text-sm text-gray-500">{card.desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
