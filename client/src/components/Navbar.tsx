import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <Link to="/" className="text-blue-600 font-bold text-xl tracking-tight">
        DentalMatch
      </Link>
      <div className="flex items-center gap-4">
        <Link to="/jobs" className="text-gray-600 hover:text-blue-600 text-sm font-medium">
          Browse Jobs
        </Link>
        <Link to="/explore" className="text-sm font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors">
          ✦ Explore
        </Link>
        {user ? (
          <>
            {user.role === 'CLINIC' && (
              <Link to="/dashboard/clinic" className="text-gray-600 hover:text-blue-600 text-sm font-medium">
                My Dashboard
              </Link>
            )}
            {user.role === 'ASSISTANT' && (
              <Link to="/dashboard/assistant" className="text-gray-600 hover:text-blue-600 text-sm font-medium">
                My Dashboard
              </Link>
            )}
            <span className="text-xs text-gray-400 hidden sm:block">{user.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md text-gray-700 font-medium"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-sm text-gray-600 hover:text-blue-600 font-medium">
              Login
            </Link>
            <Link
              to="/register"
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md font-medium"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
