import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { X, MapPin, Tag, Clock, Send, Image, User, AlertTriangle } from 'lucide-react';
import './GrievanceDetail.css';

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

const getRoleFromEmail = (email) => {
    if (!email) return 'student';
    const lowerEmail = email.toLowerCase();
    if (lowerEmail === 'supervisor1@vit.ac.in' || lowerEmail === 'supervisor@vit.ac.in' || lowerEmail === 'chiefadmin@vit.ac.in') return 'supervisor';
    if (lowerEmail.endsWith('@vit.ac.in') && !lowerEmail.endsWith('@vitstudent.ac.in')) return 'admin';
    return 'student';
};

const LOCATION_LABELS = {
    academic_block_1: 'Academic Block 1',
    academic_block_2: 'Academic Block 2',
    academic_block_3: 'Academic Block 3',
    academic_block_4: 'Academic Block 4',
    library: 'Library',
    admin_block: 'Admin Block',
    north_square: 'North Square',
    gazebo: 'Gazebo',
    a_block_hostel: 'A Block Hostel',
    b_block_hostel: 'B Block Hostel',
    c_block_hostel: 'C Block Hostel',
    d1_block_hostel: 'D1 Block Hostel',
    d2_block_hostel: 'D2 Block Hostel',
    e_block_hostel: 'E Block Hostel',
    sports_ground: 'Sports Ground'
};

const STATUS_COLORS = {
    pending: { bg: '#fef3c7', text: '#d97706', label: 'Pending' },
    in_review: { bg: '#dbeafe', text: '#2563eb', label: 'In Review' },
    in_progress: { bg: '#e0e7ff', text: '#4f46e5', label: 'In Progress' },
    resolved: { bg: '#d1fae5', text: '#059669', label: 'Resolved' },
    closed: { bg: '#f3f4f6', text: '#6b7280', label: 'Closed' },
};

function GrievanceDetail({ grievance, onClose, onUpdate }) {
    const { user, userRole } = useAuth();
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loadingComments, setLoadingComments] = useState(true);
    const [sending, setSending] = useState(false);
    const commentsEndRef = useRef(null);

    // Internal Notes states
    const [activeCommentTab, setActiveCommentTab] = useState('public');
    const [internalNotes, setInternalNotes] = useState([]);
    const [loadingNotes, setLoadingNotes] = useState(true);

    // Fetch comments
    const fetchComments = async () => {
        try {
            const { data, error } = await supabase
                .from('comments')
                .select('*')
                .eq('grievance_id', grievance.id)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error fetching comments:', error);
            } else {
                setComments(data || []);
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoadingComments(false);
        }
    };

    // Fetch internal notes
    const fetchInternalNotes = async () => {
        try {
            const { data, error } = await supabase
                .from('internal_notes')
                .select('*')
                .eq('grievance_id', grievance.id)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Error fetching internal notes:', error);
            } else {
                setInternalNotes(data || []);
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setLoadingNotes(false);
        }
    };

    useEffect(() => {
        fetchComments();
        if (userRole === 'admin' || userRole === 'supervisor') {
            fetchInternalNotes();
        }
    }, [grievance.id]);

    // Scroll to bottom when new comments/notes arrive
    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments, internalNotes, activeCommentTab]);

    const handleSendComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || sending) return;

        setSending(true);
        try {
            const { error } = await supabase.from('comments').insert({
                grievance_id: grievance.id,
                user_id: user.id,
                user_email: user.email,
                user_role: userRole,
                message: newComment.trim(),
            });

            if (error) {
                console.error('Error sending comment:', error);
            } else {
                setNewComment('');
                fetchComments();
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setSending(false);
        }
    };

    const handleSendInternalNote = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || sending) return;

        setSending(true);
        try {
            const { error } = await supabase.from('internal_notes').insert({
                grievance_id: grievance.id,
                sender_email: user.email,
                message: newComment.trim(),
            });

            if (error) {
                console.error('Error sending internal note:', error);
                alert(`Failed to send internal note: ${error.message}`);
            } else {
                setNewComment('');
                fetchInternalNotes();
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setSending(false);
        }
    };

    const handleSendPing = async () => {
        if (sending) return;
        setSending(true);
        try {
            const { error } = await supabase.from('internal_notes').insert({
                grievance_id: grievance.id,
                sender_email: user.email,
                message: '[PING] ⚠️ CHIEF SUPERVISOR ESCALATION: Please review and address this grievance immediately.',
            });

            if (error) {
                console.error('Error sending ping:', error);
                alert(`Failed to send ping: ${error.message}`);
            } else {
                fetchInternalNotes();
                if (onUpdate) {
                    onUpdate(); // Triggers parent dashboard to refresh pings
                }
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
            setSending(false);
        }
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatCommentTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    const isSupervisorOrAdmin = userRole === 'admin' || userRole === 'supervisor';

    return (
        <div className="modal-overlay detail-overlay" onClick={handleOverlayClick}>
            <div className="grievance-detail">
                <button className="close-btn" onClick={onClose}>
                    <X size={20} />
                </button>

                <div className="detail-content">
                    {/* Left: Grievance Info */}
                    <div className="detail-main">
                        <div className="detail-header">
                            <h2>{grievance.title}</h2>
                            <span
                                className="status-badge large"
                                style={{
                                    backgroundColor: STATUS_COLORS[grievance.status]?.bg,
                                    color: STATUS_COLORS[grievance.status]?.text,
                                }}
                            >
                                {STATUS_COLORS[grievance.status]?.label || grievance.status}
                            </span>
                        </div>

                        <div className="detail-meta">
                            <div className="meta-item">
                                <Tag size={16} />
                                <span>{getCategoryLabel(grievance.category)}</span>
                            </div>
                            <div className="meta-item">
                                <MapPin size={16} />
                                <span>{LOCATION_LABELS[grievance.location] || grievance.location}</span>
                            </div>
                            <div className="meta-item">
                                <Clock size={16} />
                                <span>{formatDate(grievance.created_at)}</span>
                            </div>
                        </div>

                        {grievance.privacy !== 'anonymous' && (
                            <div className="detail-submitter">
                                <User size={16} />
                                <span>Submitted by: {grievance.user_email}</span>
                            </div>
                        )}

                        <div className="detail-description">
                            <h3>Description</h3>
                            <p>{grievance.description}</p>
                        </div>

                        {grievance.image_url && (
                            <div className="detail-image">
                                <h3>
                                    <Image size={16} />
                                    Attached Image
                                </h3>
                                <img src={grievance.image_url} alt="Grievance attachment" />
                            </div>
                        )}

                        <div className="detail-progress">
                            <h3>Progress</h3>
                            <div className="progress-container">
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{ width: `${grievance.progress}%` }}
                                    />
                                </div>
                                <span>{grievance.progress}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Comments & Notes */}
                    <div className="detail-comments">
                        {isSupervisorOrAdmin ? (
                            <div className="comments-tabs">
                                <button
                                    type="button"
                                    className={`comment-tab-btn ${activeCommentTab === 'public' ? 'active' : ''}`}
                                    onClick={() => setActiveCommentTab('public')}
                                >
                                    Public Comments
                                </button>
                                <button
                                    type="button"
                                    className={`comment-tab-btn ${activeCommentTab === 'internal' ? 'active' : ''}`}
                                    onClick={() => setActiveCommentTab('internal')}
                                >
                                    Internal Notes
                                </button>
                            </div>
                        ) : (
                            <h3>Comments & Updates</h3>
                        )}

                        {activeCommentTab === 'public' ? (
                            // Public Comments view
                            <>
                                <div className="comments-list">
                                    {loadingComments ? (
                                        <div className="loading-comments">Loading comments...</div>
                                    ) : comments.length === 0 ? (
                                        <div className="no-comments">
                                            <p>No comments yet. Start the conversation!</p>
                                        </div>
                                    ) : (
                                        comments.map((comment) => (
                                            <div
                                                key={comment.id}
                                                className={`comment ${comment.user_role === 'supervisor' ? 'supervisor admin' : comment.user_role === 'admin' ? 'admin' : 'student'} ${comment.user_id === user.id ? 'own' : ''}`}
                                            >
                                                <div className="comment-header">
                                                    <span className="comment-author">
                                                        {comment.user_role === 'supervisor' ? '👑 Supervisor' : comment.user_role === 'admin' ? '👔 Admin' : '🎓 Student'}
                                                        {comment.user_id === user.id && ' (You)'}
                                                    </span>
                                                    <span className="comment-time">{formatCommentTime(comment.created_at)}</span>
                                                </div>
                                                <p className="comment-message">{comment.message}</p>
                                            </div>
                                        ))
                                    )}
                                    <div ref={commentsEndRef} />
                                </div>

                                <form className="comment-input" onSubmit={handleSendComment}>
                                    <input
                                        type="text"
                                        placeholder="Type a public message..."
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        disabled={sending}
                                    />
                                    <button type="submit" disabled={!newComment.trim() || sending}>
                                        <Send size={18} />
                                    </button>
                                </form>
                            </>
                        ) : (
                            // Internal Notes view
                            <>
                                <div className="comments-list">
                                    {userRole === 'supervisor' && (
                                        <div className="ping-action-wrapper">
                                            <button
                                                type="button"
                                                className="btn-ping-department"
                                                onClick={handleSendPing}
                                                disabled={sending}
                                            >
                                                ⚡ Ping Department (Remind ASAP)
                                            </button>
                                        </div>
                                    )}

                                    {loadingNotes ? (
                                        <div className="loading-comments">Loading notes...</div>
                                    ) : internalNotes.length === 0 ? (
                                        <div className="no-comments">
                                            <p>No internal notes yet. Use this section to discuss with standard admins/supervisors privately.</p>
                                        </div>
                                    ) : (
                                        internalNotes.map((note) => {
                                            const isPing = note.message.startsWith('[PING]');
                                            if (isPing) {
                                                return (
                                                    <div key={note.id} className="ping-banner-comment animate-fade-in">
                                                        <div className="ping-banner-header">
                                                            <AlertTriangle size={14} />
                                                            <span>Escalation Ping</span>
                                                        </div>
                                                        <p className="ping-banner-msg">{note.message.replace('[PING] ', '')}</p>
                                                        <span className="ping-banner-time">Posted {formatCommentTime(note.created_at)}</span>
                                                    </div>
                                                );
                                            }
                                            const noteRole = getRoleFromEmail(note.sender_email);
                                            const isOwn = note.sender_email === user.email;
                                            return (
                                                <div
                                                    key={note.id}
                                                    className={`comment ${noteRole === 'supervisor' ? 'supervisor admin' : 'admin'} ${isOwn ? 'own' : ''}`}
                                                >
                                                    <div className="comment-header">
                                                        <span className="comment-author">
                                                            {noteRole === 'supervisor' ? '👑 Supervisor' : '👔 Dept Admin'}
                                                            {isOwn && ' (You)'}
                                                        </span>
                                                        <span className="comment-time">{formatCommentTime(note.created_at)}</span>
                                                    </div>
                                                    <p className="comment-message">{note.message}</p>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={commentsEndRef} />
                                </div>

                                <form className="comment-input" onSubmit={handleSendInternalNote}>
                                    <input
                                        type="text"
                                        placeholder="Type an internal note..."
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        disabled={sending}
                                    />
                                    <button type="submit" disabled={!newComment.trim() || sending}>
                                        <Send size={18} />
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default GrievanceDetail;
