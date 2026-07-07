import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { X, MapPin, Tag, Clock, Send, Image, User } from 'lucide-react';
import './GrievanceDetail.css';

const CATEGORY_LABELS = {
    infrastructure: 'Infrastructure',
    food_services: 'Food Services',
    academic: 'Academic Issues',
    hostel: 'Hostel Related',
    security: 'Security',
    transportation: 'Transportation',
    other: 'Other',
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

    useEffect(() => {
        fetchComments();
    }, [grievance.id]);

    // Scroll to bottom when new comments arrive
    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments]);

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
                                <span>{CATEGORY_LABELS[grievance.category] || grievance.category}</span>
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

                    {/* Right: Comments */}
                    <div className="detail-comments">
                        <h3>Comments & Updates</h3>

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
                                        className={`comment ${comment.user_role === 'admin' ? 'admin' : 'student'} ${comment.user_id === user.id ? 'own' : ''}`}
                                    >
                                        <div className="comment-header">
                                            <span className="comment-author">
                                                {comment.user_role === 'admin' ? '👔 Admin' : '🎓 Student'}
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
                                placeholder="Type a message..."
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                disabled={sending}
                            />
                            <button type="submit" disabled={!newComment.trim() || sending}>
                                <Send size={18} />
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default GrievanceDetail;
