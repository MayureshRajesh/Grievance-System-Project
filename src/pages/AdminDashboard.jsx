import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { 
    LogOut, FileText, Clock, CheckCircle, Filter, User, 
    AlertCircle, Eye, Zap, Droplet, Wrench, Sparkles, Wifi, 
    MoreHorizontal, ChevronRight, LayoutDashboard 
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

const DEPT_DESCRIPTIONS = {
    electrical: 'Power failures, wiring, socket repairs, lights, and appliances.',
    plumbing: 'Water supply, pipe leaks, tap replacements, and washroom issues.',
    furniture: 'Broken chairs, classroom desks, classroom boards, and doors.',
    cleanliness: 'Waste disposal, sweeping, dusting, and general hygiene maintenance.',
    wifi_network: 'Internet connectivity, access points, speed, and portal login issues.',
    other: 'General, non-specific campus administrative or minor grievances.',
};

const DEPT_ICONS = {
    electrical: Zap,
    plumbing: Droplet,
    furniture: Wrench,
    cleanliness: Sparkles,
    wifi_network: Wifi,
    other: MoreHorizontal,
};

const STATUS_OPTIONS = [
    { value: 'pending', label: 'Pending', color: '#d97706' },
    { value: 'in_review', label: 'In Review', color: '#2563eb' },
    { value: 'in_progress', label: 'In Progress', color: '#4f46e5' },
    { value: 'resolved', label: 'Resolved', color: '#059669' },
    { value: 'closed', label: 'Closed', color: '#6b7280' },
];

const STATUS_COLORS = {
    pending: { bg: '#fef3c7', text: '#d97706', label: 'Pending' },
    in_review: { bg: '#dbeafe', text: '#2563eb', label: 'In Review' },
    in_progress: { bg: '#e0e7ff', text: '#4f46e5', label: 'In Progress' },
    resolved: { bg: '#d1fae5', text: '#059669', label: 'Resolved' },
    closed: { bg: '#f3f4f6', text: '#6b7280', label: 'Closed' },
};

function AdminDashboard() {
    const { user, signOut } = useAuth();
    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const [grievances, setGrievances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pingedIds, setPingedIds] = useState(new Set());
    const [filterStatus, setFilterStatus] = useState('');
    const [selectedGrievance, setSelectedGrievance] = useState(null);

    // Fetch all grievances for the selected department
    const fetchGrievances = async () => {
        if (!selectedDepartment) return;
        setLoading(true);
        try {
            let query = supabase
                .from('grievances')
                .select('*');

            if (selectedDepartment === 'wifi_network') {
                query = query.or('category.ilike.wifi_network,category.ilike.wifi/network');
            } else {
                query = query.ilike('category', selectedDepartment);
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
        if (selectedDepartment) {
            fetchGrievances();
        }
    }, [selectedDepartment, filterStatus]);

    const handleLogout = async () => {
        await signOut();
    };

    const handleStatusChange = async (e, grievanceId) => {
        e.stopPropagation(); // Prevent row click
        const newStatus = e.target.value;

        try {
            const progress = newStatus === 'resolved' ? 100 :
                newStatus === 'closed' ? 100 :
                    newStatus === 'in_progress' ? 65 :
                        newStatus === 'in_review' ? 30 : 0;

            const { error } = await supabase
                .from('grievances')
                .update({
                    status: newStatus,
                    progress,
                    updated_at: new Date().toISOString()
                })
                .eq('id', grievanceId);

            if (error) {
                console.error('Update error:', error);
            } else {
                fetchGrievances();
            }
        } catch (err) {
            console.error('Error:', err);
        }
    };

    const handleViewDetails = (grievance) => {
        setSelectedGrievance(grievance);
    };

    // Calculate stats
    const stats = {
        total: grievances.length,
        pending: grievances.filter(g => g.status === 'pending').length,
        inProgress: grievances.filter(g => g.status === 'in_review' || g.status === 'in_progress').length,
        resolved: grievances.filter(g => g.status === 'resolved' || g.status === 'closed').length,
    };

    // Format date
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // If department is not selected, render department selector view
    if (!selectedDepartment) {
        return (
            <div className="dept-selector-page">
                {/* Header */}
                <header className="dashboard-header animate-slide-down">
                    <div className="header-left">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <LayoutDashboard size={24} />
                            <h1>Department Admin Portal</h1>
                        </div>
                        <p className="welcome-text">Select your department area to start processing</p>
                    </div>
                    <div className="header-right">
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

                <main className="dept-selector-content">
                    <div className="selector-title-section animate-fade-in">
                        <h2>Welcome back, Administrator</h2>
                        <p>Choose the department you want to manage to view and update pending grievances.</p>
                    </div>

                    <div className="dept-cards-grid animate-fade-in-up">
                        {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                            const IconComponent = DEPT_ICONS[key] || MoreHorizontal;
                            const desc = DEPT_DESCRIPTIONS[key] || '';
                            return (
                                <div 
                                    key={key} 
                                    className="dept-select-card"
                                    onClick={() => setSelectedDepartment(key)}
                                >
                                    <div className="dept-card-icon-wrapper" data-dept={key}>
                                        <IconComponent size={28} />
                                    </div>
                                    <div className="dept-card-info">
                                        <h3>{label}</h3>
                                        <p>{desc}</p>
                                    </div>
                                    <div className="dept-card-arrow">
                                        <ChevronRight size={20} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </main>

                <footer className="footer-info">
                    <p>© 2026 VIT Chennai. All rights reserved.</p>
                </footer>
            </div>
        );
    }

    return (
        <div className="dashboard admin-dashboard">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-left">
                    <h1>{CATEGORY_LABELS[selectedDepartment]} Administration</h1>
                    <p className="welcome-text">Manage {CATEGORY_LABELS[selectedDepartment].toLowerCase()} department grievances</p>
                </div>
                <div className="header-right">
                    <button className="change-dept-btn" onClick={() => setSelectedDepartment(null)}>
                        Switch Department
                    </button>
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
                {/* Stats Cards */}
                <div className="stats-grid stats-4">
                    <div className="stat-card">
                        <div className="stat-info">
                            <span className="stat-label">Total Reports</span>
                            <span className="stat-value">{stats.total}</span>
                        </div>
                        <div className="stat-icon" style={{ backgroundColor: '#e0e7ff' }}>
                            <FileText size={24} color="#4f46e5" />
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-info">
                            <span className="stat-label">Pending</span>
                            <span className="stat-value">{stats.pending}</span>
                        </div>
                        <div className="stat-icon" style={{ backgroundColor: '#fef3c7' }}>
                            <AlertCircle size={24} color="#d97706" />
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-info">
                            <span className="stat-label">In Progress</span>
                            <span className="stat-value">{stats.inProgress}</span>
                        </div>
                        <div className="stat-icon" style={{ backgroundColor: '#dbeafe' }}>
                            <Clock size={24} color="#2563eb" />
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

                {/* Filters */}
                <div className="filters-section">
                    <div className="filter-group">
                        <Filter size={18} />
                        <span>Filters:</span>
                    </div>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="filter-select"
                    >
                        <option value="">All Status</option>
                        {STATUS_OPTIONS.map((status) => (
                            <option key={status.value} value={status.value}>{status.label}</option>
                        ))}
                    </select>
                    {filterStatus && (
                        <button
                            className="btn-clear-filters"
                            onClick={() => {
                                setFilterStatus('');
                            }}
                        >
                            Clear Filters
                        </button>
                    )}
                </div>

                {/* Grievances List */}
                <div className="grievances-section animate-fade-in">
                    <div className="section-header">
                        <h2>All Grievances ({CATEGORY_LABELS[selectedDepartment]})</h2>
                        <p>{grievances.length} total reports in this department</p>
                    </div>

                    {loading ? (
                        <div className="loading-state">Loading...</div>
                    ) : grievances.length === 0 ? (
                        <div className="empty-state">
                            <FileText size={48} />
                            <h3>No grievances found</h3>
                            <p>No grievances match your current filters or department</p>
                        </div>
                    ) : (
                        <div className="grievance-table">
                            <div className="table-header">
                                <div className="th">Title</div>
                                <div className="th">Submitted By</div>
                                <div className="th">Date</div>
                                <div className="th">Status</div>
                                <div className="th">Actions</div>
                            </div>
                            {grievances.map((grievance) => (
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
                                        <select
                                            className="status-select"
                                            value={grievance.status}
                                            onClick={(e) => e.stopPropagation()}
                                            onChange={(e) => handleStatusChange(e, grievance.id)}
                                        >
                                            {STATUS_OPTIONS.map((status) => (
                                                <option key={status.value} value={status.value}>
                                                    {status.label}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            className="btn-view-small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleViewDetails(grievance);
                                            }}
                                        >
                                            <Eye size={14} />
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

export default AdminDashboard;
