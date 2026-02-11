import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { LogOut, FileText, Clock, CheckCircle, Plus, Eye } from 'lucide-react';
import GrievanceForm from '../components/GrievanceForm/GrievanceForm';
import GrievanceDetail from '../components/GrievanceDetail/GrievanceDetail';
import './Dashboard.css';

const CATEGORY_LABELS = {
    infrastructure: 'Infrastructure',
    food_services: 'Food Services',
    academic: 'Academic Issues',
    hostel: 'Hostel Related',
    security: 'Security',
    transportation: 'Transportation',
    other: 'Other',
};

const STATUS_COLORS = {
    pending: { bg: '#fef3c7', text: '#d97706', label: 'Pending' },
    in_review: { bg: '#dbeafe', text: '#2563eb', label: 'In Review' },
    in_progress: { bg: '#e0e7ff', text: '#4f46e5', label: 'In Progress' },
    resolved: { bg: '#d1fae5', text: '#059669', label: 'Resolved' },
    closed: { bg: '#f3f4f6', text: '#6b7280', label: 'Closed' },
};

function StudentDashboard() {
    const { user, signOut } = useAuth();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [showForm, setShowForm] = useState(false);
    const [selectedGrievance, setSelectedGrievance] = useState(null);
    const [grievances, setGrievances] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch grievances
    const fetchGrievances = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('grievances')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Fetch error:', error);
            } else {
                setGrievances(data || []);
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchGrievances();
        }
    }, [user]);

    const handleLogout = async () => {
        await signOut();
    };

    const handleFormSuccess = () => {
        fetchGrievances();
    };

    const handleViewDetails = (grievance) => {
        setSelectedGrievance(grievance);
    };

    // Calculate stats
    const stats = {
        total: grievances.length,
        pending: grievances.filter(g => g.status === 'pending' || g.status === 'in_review').length,
        resolved: grievances.filter(g => g.status === 'resolved' || g.status === 'closed').length,
    };

    // Format date
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    return (
        <div className="dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-left">
                    <h1>Student Dashboard</h1>
                    <p className="welcome-text">Welcome back, {user?.email?.split('@')[0]}</p>
                </div>
                <div className="header-right">
                    <button className="btn-primary" onClick={() => setShowForm(true)}>
                        <Plus size={18} />
                        Lodge New Grievance
                    </button>
                    <button className="logout-btn" onClick={handleLogout}>
                        <LogOut size={18} />
                        Logout
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="dashboard-tabs">
                <button
                    className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setActiveTab('dashboard')}
                >
                    Dashboard
                </button>
                <button
                    className={`tab ${activeTab === 'my-grievances' ? 'active' : ''}`}
                    onClick={() => setActiveTab('my-grievances')}
                >
                    My Grievances
                </button>
            </div>

            {/* Main Content */}
            <main className="dashboard-content">
                {activeTab === 'dashboard' && (
                    <>
                        {/* Stats Cards */}
                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-info">
                                    <span className="stat-label">Total Grievances</span>
                                    <span className="stat-value">{stats.total}</span>
                                </div>
                                <div className="stat-icon" style={{ backgroundColor: '#fee2e2' }}>
                                    <FileText size={24} color="#dc2626" />
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-info">
                                    <span className="stat-label">Pending</span>
                                    <span className="stat-value">{stats.pending}</span>
                                </div>
                                <div className="stat-icon" style={{ backgroundColor: '#fef3c7' }}>
                                    <Clock size={24} color="#d97706" />
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-info">
                                    <span className="stat-label">Resolved</span>
                                    <span className="stat-value">{stats.resolved}</span>
                                </div>
                                <div className="stat-icon" style={{ backgroundColor: '#d1fae5' }}>
                                    <CheckCircle size={24} color="#059669" />
                                </div>
                            </div>
                        </div>

                        {/* Recent Grievances */}
                        <div className="grievances-section">
                            <div className="section-header">
                                <h2>Recent Grievances</h2>
                                <p>Track the progress of your recent submissions</p>
                            </div>

                            {loading ? (
                                <div className="loading-state">Loading...</div>
                            ) : grievances.length === 0 ? (
                                <div className="empty-state">
                                    <FileText size={48} />
                                    <h3>No grievances yet</h3>
                                    <p>Lodge your first grievance to get started</p>
                                    <button className="btn-primary" onClick={() => setShowForm(true)}>
                                        <Plus size={18} />
                                        Lodge New Grievance
                                    </button>
                                </div>
                            ) : (
                                <div className="grievance-list">
                                    {grievances.slice(0, 5).map((grievance) => (
                                        <div key={grievance.id} className="grievance-item">
                                            <div className="grievance-main">
                                                <h3>{grievance.title}</h3>
                                                <span className="grievance-category">
                                                    {CATEGORY_LABELS[grievance.category] || grievance.category}
                                                </span>
                                                <div className="grievance-progress">
                                                    <span>Progress</span>
                                                    <div className="progress-bar">
                                                        <div
                                                            className="progress-fill"
                                                            style={{ width: `${grievance.progress}%` }}
                                                        />
                                                    </div>
                                                    <span>{grievance.progress}%</span>
                                                </div>
                                                <p className="grievance-date">
                                                    Submitted on {formatDate(grievance.created_at)}
                                                </p>
                                            </div>
                                            <div className="grievance-side">
                                                <span
                                                    className="status-badge"
                                                    style={{
                                                        backgroundColor: STATUS_COLORS[grievance.status]?.bg,
                                                        color: STATUS_COLORS[grievance.status]?.text,
                                                    }}
                                                >
                                                    <Clock size={14} />
                                                    {STATUS_COLORS[grievance.status]?.label || grievance.status}
                                                </span>
                                                <button
                                                    className="btn-view"
                                                    onClick={() => handleViewDetails(grievance)}
                                                >
                                                    <Eye size={16} />
                                                    View Details
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'my-grievances' && (
                    <div className="grievances-section">
                        <div className="section-header">
                            <h2>My Grievances</h2>
                            <p>All your submitted grievances</p>
                        </div>

                        {loading ? (
                            <div className="loading-state">Loading...</div>
                        ) : grievances.length === 0 ? (
                            <div className="empty-state">
                                <FileText size={48} />
                                <h3>No grievances yet</h3>
                                <p>Lodge your first grievance to get started</p>
                            </div>
                        ) : (
                            <div className="grievance-list">
                                {grievances.map((grievance) => (
                                    <div key={grievance.id} className="grievance-item clickable" onClick={() => handleViewDetails(grievance)}>
                                        <div className="grievance-main">
                                            <h3>{grievance.title}</h3>
                                            <span className="grievance-category">
                                                {CATEGORY_LABELS[grievance.category] || grievance.category}
                                            </span>
                                            <p className="grievance-description">{grievance.description.substring(0, 100)}...</p>
                                            <p className="grievance-date">
                                                Submitted on {formatDate(grievance.created_at)}
                                            </p>
                                        </div>
                                        <div className="grievance-side">
                                            <span
                                                className="status-badge"
                                                style={{
                                                    backgroundColor: STATUS_COLORS[grievance.status]?.bg,
                                                    color: STATUS_COLORS[grievance.status]?.text,
                                                }}
                                            >
                                                {STATUS_COLORS[grievance.status]?.label || grievance.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Grievance Form Modal */}
            {showForm && (
                <GrievanceForm
                    onClose={() => setShowForm(false)}
                    onSuccess={handleFormSuccess}
                />
            )}

            {/* Grievance Detail Modal */}
            {selectedGrievance && (
                <GrievanceDetail
                    grievance={selectedGrievance}
                    onClose={() => setSelectedGrievance(null)}
                    onUpdate={fetchGrievances}
                />
            )}
        </div>
    );
}

export default StudentDashboard;
