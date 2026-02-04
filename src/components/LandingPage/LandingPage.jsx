import { useState } from 'react';
import { Building2 } from 'lucide-react';
import './LandingPage.css';

function LandingPage() {
  const [activeTab, setActiveTab] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Implement authentication
    console.log('Login attempt:', { type: activeTab, email, password });
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

          {/* Login Type Tabs */}
          <div className="login-tabs">
            <button
              className={`login-tab ${activeTab === 'student' ? 'active' : ''}`}
              onClick={() => setActiveTab('student')}
            >
              Student Login
            </button>
            <button
              className={`login-tab ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin')}
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
              />
            </div>

            <button type="submit" className="submit-button">
              Login as {activeTab === 'student' ? 'Student' : 'Administrator'}
            </button>
          </form>

          <p className="demo-credentials">
            Demo: {activeTab === 'student' ? 'student@vitstudent.ac.in' : 'admin@vit.ac.in'} / 1234
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
