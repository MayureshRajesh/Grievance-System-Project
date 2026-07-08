import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
    LogOut, FileText, Clock, CheckCircle, Filter, User, 
    AlertCircle, Eye, Search, Zap, Droplet, Wrench, Sparkles, Wifi, 
    MoreHorizontal, ShieldAlert, BarChart3
} from 'lucide-react';
import GrievanceDetail from '../components/GrievanceDetail/GrievanceDetail';
import './Dashboard.css';

const CATEGORY_LABELS = {
    electrical: 'Electrical',
    plumbing: 'Plumbing',
    furniture: 'Furniture',
    cleanliness: 'Cleanliness',
    wifi_network: 'WiFi/Network',
    other: 'Other',
};

const getCategoryLabel = (category) => {
    if (!category) return '';
    const normalized = category.toLowerCase().replace('/', '_');
    return CATEGORY_LABELS[normalized] || category;
};

const normalizeCategory = (category) => {
    if (!category) return '';
    return category.toLowerCase().replace('/', '_');
};

const DEPT_ICONS = {
    electrical: Zap,
    plumbing: Droplet,
    furniture: Wrench,
    cleanliness: Sparkles,
    wifi_network: Wifi,
    other: MoreHorizontal,
};

const STATUS_COLORS = {
    pending: { bg: '#fef3c7', text: '#d97706', label: 'Pending' },
    in_review: { bg: '#dbeafe', text: '#2563eb', label: 'In Review' },
    in_progress: { bg: '#e0e7ff', text: '#4f46e5', label: 'In Progress' },
    resolved: { bg: '#d1fae5', text: '#059669', label: 'Resolved' },
    closed: { bg: '#f3f4f6', text: '#6b7280', label: 'Closed' },
};

const STATUS_OPTIONS = [
    { value: 'pending', label: 'Pending' },
    { value: 'in_review', label: 'In Review' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
];

function SupervisorDashboard() {
    const { user, signOut } = useAuth();
    const [grievances, setGrievances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGrievance, setSelectedGrievance] = useState(null);
    const [pingedIds, setPingedIds] = useState(new Set());

    // Fetch all grievances across all departments
    const fetchGrievances = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('grievances')
                .select('*');

            if (filterCategory) {
                if (filterCategory === 'wifi_network') {
                    query = query.or('category.ilike.wifi_network,category.ilike.wifi/network');
                } else {
                    query = query.ilike('category', filterCategory);
                }
            }

            query = query.order('created_at', { ascending: false });

            if (filterStatus) {
                query = query.eq('status', filterStatus);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Fetch error:', error);
            } else {
                setGrievances(data || []);
                
                // Fetch pings
                const { data: pings, error: pingError } = await supabase
                    .from('internal_notes')
                    .select('grievance_id')
                    .like('message', '[PING]%');
                
                if (!pingError && pings) {
                    setPingedIds(new Set(pings.map(p => p.grievance_id)));
                }
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGrievances();
    }, [filterCategory, filterStatus]);

    const handleLogout = async () => {
        await signOut();
    };

    const handleViewDetails = (grievance) => {
        setSelectedGrievance(grievance);
    };

    // Calculate aggregated statistics
    const stats = {
        total: grievances.length,
        pending: grievances.filter(g => g.status === 'pending').length,
        inProgress: grievances.filter(g => g.status === 'in_review' || g.status === 'in_progress').length,
        resolved: grievances.filter(g => g.status === 'resolved' || g.status === 'closed').length,
    };

    // Calculate department-wise breakdown
    const deptBreakdown = Object.keys(CATEGORY_LABELS).reduce((acc, deptKey) => {
        const deptGrievances = grievances.filter(g => normalizeCategory(g.category) === deptKey);
        const resolved = deptGrievances.filter(g => g.status === 'resolved' || g.status === 'closed').length;
        const total = deptGrievances.length;
        const rate = total > 0 ? Math.round((resolved / total) * 100) : 0;
        
        acc[deptKey] = {
            total,
            pending: deptGrievances.filter(g => g.status === 'pending').length,
            inProgress: deptGrievances.filter(g => g.status === 'in_review' || g.status === 'in_progress').length,
            resolved,
            rate
        };
        return acc;
    }, {});

    // Filter grievances by search query client-side - safe against nulls
    const filteredGrievances = grievances.filter(g => {
        const title = g.title || '';
        const description = g.description || '';
        const email = g.user_email || '';
        const query = searchQuery.toLowerCase();
        
        return title.toLowerCase().includes(query) ||
               description.toLowerCase().includes(query) ||
               email.toLowerCase().includes(query);
    });

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="dashboard supervisor-dashboard">
            {/* Header */}
            <header className="dashboard-header super-header animate-slide-down">
                <div className="header-left">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <BarChart3 size={24} />
                        <h1>Chief Grievance Supervisor Portal</h1>
                    </div>
                    <p className="welcome-text">Apex Supervision & Department Coordination</p>
                </div>
                <div className="header-right">
                    <div className="supervisor-badge">
                        <span>Apex Monitor</span>
                    </div>
                    <div className="user-info">
                        <User size={20} />
                        <span>{user?.email}</span>
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>
                        <LogOut size={18} />
                        Logout
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="dashboard-content">
                {/* Notice Alert */}
                <div className="oversight-banner animate-fade-in">
                    <ShieldAlert size={20} />
                    <p>
                        <strong>Oversight Mode Enabled:</strong> You are reviewing all departments. 
                        You have read-only access to grievances but can publish comments and instructions.
                    </p>
                </div>

                {/* Main Stats */}
                <div className="stats-grid stats-4">
                    <div className="stat-card border-left-super">
                        <div className="stat-info">
                            <span className="stat-label">Total Campus Reports</span>
                            <span className="stat-value">{stats.total}</span>
                        </div>
                        <div className="stat-icon" style={{ backgroundColor: '#e0e7ff' }}>
                            <FileText size={24} color="#4f46e5" />
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-info">
                            <span className="stat-label">Total Pending</span>
                            <span className="stat-value">{stats.pending}</span>
                        </div>
                        <div className="stat-icon" style={{ backgroundColor: '#fef3c7' }}>
                            <AlertCircle size={24} color="#d97706" />
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-info">
                            <span className="stat-label">Active (In Review/Progress)</span>
                            <span className="stat-value">{stats.inProgress}</span>
                        </div>
                        <div className="stat-icon" style={{ backgroundColor: '#dbeafe' }}>
                            <Clock size={24} color="#2563eb" />
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-info">
                            <span className="stat-label">Total Resolved</span>
                            <span className="stat-value">{stats.resolved}</span>
                        </div>
                        <div className="stat-icon" style={{ backgroundColor: '#d1fae5' }}>
                            <CheckCircle size={24} color="#059669" />
                        </div>
                    </div>
                </div>

                {/* Department Grid Supervision Panel */}
                <section className="supervision-section animate-fade-in-up">
                    <div className="section-header">
                        <h2>Department Coordination Panel</h2>
                        <p>Real-time resolution rates and grievance load across all departments</p>
                    </div>

                    <div className="dept-supervision-grid">
                        {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                            const IconComponent = DEPT_ICONS[key] || MoreHorizontal;
                            const dStats = deptBreakdown[key] || { total: 0, pending: 0, inProgress: 0, resolved: 0, rate: 0 };
                            return (
                                <div key={key} className="dept-summary-card">
                                    <div className="dept-summary-header">
                                        <div className="dept-summary-icon" data-dept={key}>
                                            <IconComponent size={20} />
                                        </div>
                                        <h3>{label}</h3>
                                    </div>
                                    <div className="dept-summary-stats">
                                        <div className="dept-stat-row">
                                            <span>Total Reports:</span>
                                            <strong>{dStats.total}</strong>
                                        </div>
                                        <div className="dept-stat-row">
                                            <span>Pending:</span>
                                            <span style={{ color: '#d97706', fontWeight: 600 }}>{dStats.pending}</span>
                                        </div>
                                        <div className="dept-stat-row">
                                            <span>Active Processing:</span>
                                            <span style={{ color: '#2563eb', fontWeight: 600 }}>{dStats.inProgress}</span>
                                        </div>
                                        <div className="dept-stat-row">
                                            <span>Resolved:</span>
                                            <span style={{ color: '#059669', fontWeight: 600 }}>{dStats.resolved}</span>
                                        </div>
                                    </div>
                                    <div className="dept-progress-section">
                                        <div className="dept-progress-header">
                                            <span>Resolution Rate:</span>
                                            <strong>{dStats.rate}%</strong>
                                        </div>
                                        <div className="progress-bar">
                                            <div 
                                                className="progress-fill" 
                                                style={{ 
                                                    width: `${dStats.rate}%`, 
                                                    backgroundColor: dStats.rate > 70 ? '#059669' : dStats.rate > 40 ? '#4f46e5' : '#d97706' 
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Supervision Filters & Table */}
                <div className="grievances-section animate-fade-in-up" style={{ marginTop: 'var(--spacing-xl)' }}>
                    <div className="section-header search-enabled-header">
                        <div>
                            <h2>Universal Grievance Ledger</h2>
                            <p>Showing {filteredGrievances.length} records</p>
                        </div>
                        <div className="search-bar-wrapper">
                            <Search size={18} className="search-icon" />
                            <input 
                                type="text" 
                                placeholder="Search grievance title, description, or student email..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input"
                            />
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="filters-section" style={{ border: 'none', paddingLeft: 0, paddingRight: 0 }}>
                        <div className="filter-group">
                            <Filter size={18} />
                            <span>Oversight Filters:</span>
                        </div>
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="filter-select"
                        >
                            <option value="">All Departments</option>
                            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="filter-select"
                        >
                            <option value="">All Statuses</option>
                            {STATUS_OPTIONS.map((status) => (
                                <option key={status.value} value={status.value}>{status.label}</option>
                            ))}
                        </select>
                        {(filterCategory || filterStatus || searchQuery) && (
                            <button
                                className="btn-clear-filters"
                                onClick={() => {
                                    setFilterCategory('');
                                    setFilterStatus('');
                                    setSearchQuery('');
                                }}
                            >
                                Reset Ledger view
                            </button>
                        )}
                    </div>

                    {/* Table of Grievances */}
                    {loading ? (
                        <div className="loading-state">Loading...</div>
                    ) : filteredGrievances.length === 0 ? (
                        <div className="empty-state">
                            <FileText size={48} />
                            <h3>No matching records found</h3>
                            <p>No grievances fit the filter criteria.</p>
                        </div>
                    ) : (
                        <div className="grievance-table">
                            <div className="table-header">
                                <div className="th">Title</div>
                                <div className="th">Department</div>
                                <div className="th">Submitted By</div>
                                <div className="th">Date</div>
                                <div className="th">Status</div>
                                <div className="th">Action</div>
                            </div>
                            {filteredGrievances.map((grievance) => (
                                <div
                                    key={grievance.id}
                                    className="table-row clickable"
                                    onClick={() => handleViewDetails(grievance)}
                                >
                                    <div className="td td-title">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <strong>{grievance.title}</strong>
                                            {pingedIds.has(grievance.id) && (
                                                <span className="urgent-ping-badge animate-pulse">
                                                    ⚡ PINGED (URGENT)
                                                </span>
                                            )}
                                        </div>
                                        <p className="description-preview">
                                            {grievance.description.substring(0, 80)}...
                                        </p>
                                    </div>
                                    <div className="td">
                                        <span className="category-tag">
                                            {getCategoryLabel(grievance.category)}
                                        </span>
                                    </div>
                                    <div className="td">
                                        {grievance.privacy === 'anonymous' ? (
                                            <span className="anonymous">Anonymous</span>
                                        ) : (
                                            grievance.user_email
                                        )}
                                    </div>
                                    <div className="td">{formatDate(grievance.created_at)}</div>
                                    <div className="td">
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
                                    <div className="td td-actions">
                                        <button
                                            className="btn-view-small-super"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleViewDetails(grievance);
                                            }}
                                            title="Inspect & Supervise"
                                        >
                                            <Eye size={14} />
                                            <span>Inspect</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

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

export default SupervisorDashboard;
