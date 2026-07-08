import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './LandingPage.css';

function LandingPage() {
  const [activeTab, setActiveTab] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signOut, user, userRole } = useAuth();
  const navigate = useNavigate();

  // Redirect when user role is determined after login (only if already logged in)
  useEffect(() => {
    if (user && userRole && !loading) {
      // logic is now handled in handleSubmit for new logins,
      // but this handles persistent sessions or redirects
      if (userRole === 'admin') {
        // If we are on landing page and already logged in as admin
        // ensure we aren't trying to access student features if were typing url manually etc
        // but for landing page generic redirect, checking role vs tab isn't possible here
        // as tab state is local.
        // So we just rely on handleSubmit for the "Login Prevention"
      }
    }
  }, [user, userRole, loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const lowerEmail = email.toLowerCase();

      // PRE-VALIDATION: Check email domain matches selected tab
      if (activeTab === 'student') {
        // Student tab: must end with @vitstudent.ac.in
        if (!lowerEmail.endsWith('@vitstudent.ac.in')) {
          setError('Not authorized for Student login. Please use your @vitstudent.ac.in email.');
          setLoading(false);
          return;
        }
      } else {
        // Admin tab: must end with @vit.ac.in (but NOT @vitstudent.ac.in)
        if (!lowerEmail.endsWith('@vit.ac.in') || lowerEmail.endsWith('@vitstudent.ac.in')) {
          setError('Not authorized for Administrator login. Please use your @vit.ac.in email.');
          setLoading(false);
          return;
        }
      }

      // Email domain is valid, proceed with login
      const { error: authError } = await signIn(email, password);

      if (authError) {
        setError('Invalid login details. Please check your email and password.');
        setLoading(false);
        return;
      }

      // Success - Navigate to dashboard
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="landing-page">
      {/* Header */}
      <header className="landing-header">
        <div className="header-logo">⚡</div>
        <div className="header-actions">
          {/* Future: Help link, etc. */}
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Institution Branding */}
        <div className="institution-branding">
          <div className="institution-icon">
            <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRoDGVT3etK4KCDmZtX8l2Uemu68hVrh9yVew&s" alt="VIT Logo" />
          </div>
          <h1 className="institution-name">VIT Chennai</h1>
          <p className="institution-subtitle">Grievance Management System</p>
        </div>

        {/* Login Card */}
        <div className="login-card">
          <h2 className="login-title">Login</h2>
          <p className="login-subtitle">Choose your login type to access the system</p>

          {/* Error Message */}
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Login Type Tabs */}
          <div className="login-tabs">
            <button
              className={`login-tab ${activeTab === 'student' ? 'active' : ''}`}
              onClick={() => setActiveTab('student')}
              type="button"
            >
              Student Login
            </button>
            <button
              className={`login-tab ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
              type="button"
            >
              Administrator
            </button>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                className="form-input"
                placeholder={activeTab === 'student' ? 'student@vitstudent.ac.in' : 'admin@vit.ac.in'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Logging in...' : `Login as ${activeTab === 'student' ? 'Student' : 'Administrator'}`}
            </button>
          </form>

          <p className="demo-credentials">
            {activeTab === 'student' ? (
              <span>Demo Student: <strong>student@vitstudent.ac.in</strong> / 1234</span>
            ) : (
              <span style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <span>Dept Admin: <strong>admin@vit.ac.in</strong> / 1234</span>
                <span>Supervisor: <strong>supervisor1@vit.ac.in</strong> / 1234</span>
              </span>
            )}
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer-info">
        <p>© 2026 VIT Chennai. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default LandingPage;
