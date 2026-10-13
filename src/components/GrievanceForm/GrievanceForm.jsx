import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { API_URL } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Upload, X, Image } from 'lucide-react';
import './GrievanceForm.css';

const CATEGORIES = [
    { value: '', label: 'Select a category' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'plumbing', label: 'Plumbing' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'cleanliness', label: 'Cleanliness' },
    { value: 'wifi_network', label: 'WiFi/Network' },
    { value: 'other', label: 'Other' },
];

const LOCATIONS = [
    { value: '', label: 'Select a location' },
    { value: 'academic_block_1', label: 'Academic Block 1' },
    { value: 'academic_block_2', label: 'Academic Block 2' },
    { value: 'academic_block_3', label: 'Academic Block 3' },
    { value: 'academic_block_4', label: 'Academic Block 4' },
    { value: 'library', label: 'Library' },
    { value: 'admin_block', label: 'Admin Block' },
    { value: 'north_square', label: 'North Square' },
    { value: 'gazebo', label: 'Gazebo' },
    { value: 'a_block_hostel', label: 'A Block Hostel' },
    { value: 'b_block_hostel', label: 'B Block Hostel' },
    { value: 'c_block_hostel', label: 'C Block Hostel' },
    { value: 'd1_block_hostel', label: 'D1 Block Hostel' },
    { value: 'd2_block_hostel', label: 'D2 Block Hostel' },
    { value: 'e_block_hostel', label: 'E Block Hostel' },
    { value: 'sports_ground', label: 'Sports Ground' }
];

const PRIVACY_OPTIONS = [
    { value: 'public', label: 'Public', description: 'Visible to all students and staff' },
    { value: 'private', label: 'Private', description: 'Visible only to administrators' },
    { value: 'anonymous', label: 'Anonymous', description: 'Public but your name is hidden' },
];

function GrievanceForm({ onClose, onSuccess }) {
    const { user } = useAuth();
    const fileInputRef = useRef(null);
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [privacy, setPrivacy] = useState('private');
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
                setError('Please select an image or PDF file.');
                return;
            }
            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                setError('File size must be less than 2MB.');
                return;
            }
            setSelectedFile(file);
            if (file.type.startsWith('image/')) {
                setFilePreview(URL.createObjectURL(file));
            } else {
                setFilePreview(null); // No preview for PDF
            }
            setError('');
        }
    };

    const removeFile = () => {
        setSelectedFile(null);
        setFilePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const uploadToSupabase = async () => {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `public/${user.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('grievance-images')
            .upload(filePath, selectedFile, { cacheControl: '3600', upsert: false });

        if (uploadError) {
            throw new Error(`Supabase upload failed: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
            .from('grievance-images')
            .getPublicUrl(filePath);

        return urlData.publicUrl;
    };

    const uploadToS3 = async () => {
        const response = await fetch(`${API_URL}/api/presigned-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: selectedFile.name,
                fileType: selectedFile.type,
                fileSize: selectedFile.size
            })
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to get presigned URL');
        }

        const { presignedUrl, finalUrl } = await response.json();

        const uploadResponse = await fetch(presignedUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': selectedFile.type,
            },
            body: selectedFile
        });

        if (!uploadResponse.ok) {
            throw new Error('Failed to upload file to S3');
        }

        return finalUrl;
    };

    // Upload to Supabase and S3 independently. Each URL is kept separately;
    // fails only if both uploads fail.
    const uploadFile = async () => {
        const [supabaseRes, s3Res] = await Promise.allSettled([uploadToSupabase(), uploadToS3()]);

        if (supabaseRes.status === 'rejected') console.error(supabaseRes.reason);
        if (s3Res.status === 'rejected') console.error('S3 upload failed:', s3Res.reason);

        if (supabaseRes.status === 'rejected' && s3Res.status === 'rejected') {
            throw supabaseRes.reason;
        }

        return {
            supabaseUrl: supabaseRes.status === 'fulfilled' ? supabaseRes.value : null,
            s3Url: s3Res.status === 'fulfilled' ? s3Res.value : null,
        };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!title.trim()) {
            setError('Please enter a title for your grievance.');
            return;
        }
        if (!category) {
            setError('Please select a category.');
            return;
        }
        if (!location) {
            setError('Please select a location.');
            return;
        }
        if (!description.trim()) {
            setError('Please provide a description.');
            return;
        }

        setLoading(true);

        try {
            // Upload file if attached - MUST succeed if file is selected
            let fileUrls = { supabaseUrl: null, s3Url: null };
            if (selectedFile) {
                try {
                    fileUrls = await uploadFile();
                } catch (uploadErr) {
                    console.error('File upload failed:', uploadErr);
                    setError(`File upload failed: ${uploadErr.message}. Please try again or remove the file.`);
                    setLoading(false);
                    return; // Block submission if file upload fails
                }
            }

            const grievancePayload = {
                user_id: user.id,
                user_email: user.email,
                title: title.trim(),
                category,
                location,
                description: description.trim(),
                privacy,
                image_url: fileUrls.supabaseUrl,
                ...(fileUrls.s3Url && { s3_image_url: fileUrls.s3Url }),
                status: 'pending',
                progress: 0,
            };

            let submitSuccess = false;

            // Try submitting via backend API to run AWS Comprehend sentiment analysis & priority assignment
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const headers = { 'Content-Type': 'application/json' };
                if (session?.access_token) {
                    headers['Authorization'] = `Bearer ${session.access_token}`;
                }

                const apiRes = await fetch(`${API_URL}/api/grievances`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(grievancePayload)
                });

                if (apiRes.ok) {
                    submitSuccess = true;
                } else {
                    console.warn('Backend /api/grievances failed, falling back to direct Supabase insert.');
                }
            } catch (apiErr) {
                console.warn('Backend unavailable, falling back to direct Supabase insert:', apiErr);
            }

            // Fallback to direct Supabase insert if backend wasn't reachable
            if (!submitSuccess) {
                const { error: insertError } = await supabase
                    .from('grievances')
                    .insert(grievancePayload);

                if (insertError) {
                    console.error('Insert error:', insertError);
                    setError(`Failed to submit: ${insertError.message}`);
                    setLoading(false);
                    return;
                }
            }

            // Trigger SNS notification for new grievance
            fetch(`${API_URL}/api/notify-new`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(),
                    category,
                    userEmail: user.email
                })
            }).catch(err => console.error('Failed to send new grievance notification:', err));

            // Success
            if (onSuccess) {
                onSuccess();
            }
            onClose();
        } catch (err) {
            console.error('Submit error:', err);
            setError('An unexpected error occurred. Please try again.');
            setLoading(false);
        }
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="grievance-form">
                <div className="form-header">
                    <h2>Lodge New Grievance</h2>
                    <p>Please provide details about your grievance. All fields marked with * are required.</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-body">
                        {error && <div className="form-error">{error}</div>}

                        <div className="form-group">
                            <label htmlFor="title">
                                Title <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                id="title"
                                placeholder="Brief title for your grievance"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label htmlFor="category">
                                    Category <span className="required">*</span>
                                </label>
                                <select
                                    id="category"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    disabled={loading}
                                >
                                    {CATEGORIES.map((cat) => (
                                        <option key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label htmlFor="location">
                                    Location <span className="required">*</span>
                                </label>
                                <select
                                    id="location"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    disabled={loading}
                                >
                                    {LOCATIONS.map((loc) => (
                                        <option key={loc.value} value={loc.value}>
                                            {loc.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="description">
                                Description <span className="required">*</span>
                            </label>
                            <textarea
                                id="description"
                                placeholder="Provide a detailed description of your grievance..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label>
                                Attach File <span className="optional">(Optional - Image/PDF)</span>
                            </label>
                            {!selectedFile ? (
                                <div
                                    className="image-upload-area"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload size={24} />
                                    <span>Click to upload a file</span>
                                    <span className="hint">Images & PDFs up to 2MB</span>
                                </div>
                            ) : (
                                <div className="image-preview">
                                    {filePreview ? (
                                        <img src={filePreview} alt="Preview" />
                                    ) : (
                                        <div style={{ padding: '20px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
                                            <p style={{ margin: 0, color: '#374151', fontWeight: '500' }}>{selectedFile.name}</p>
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        className="remove-image"
                                        onClick={removeFile}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label>
                                Privacy Setting <span className="required">*</span>
                            </label>
                            <div className="privacy-options">
                                {PRIVACY_OPTIONS.map((option) => (
                                    <label
                                        key={option.value}
                                        className={`privacy-option ${privacy === option.value ? 'selected' : ''}`}
                                    >
                                        <input
                                            type="radio"
                                            name="privacy"
                                            value={option.value}
                                            checked={privacy === option.value}
                                            onChange={(e) => setPrivacy(e.target.value)}
                                            disabled={loading}
                                        />
                                        <div className="privacy-option-content">
                                            <strong>{option.label}</strong>
                                            <span> - {option.description}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="form-footer">
                        <button type="submit" className="btn-submit" disabled={loading}>
                            {loading ? 'Submitting...' : 'Submit Grievance'}
                        </button>
                        <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default GrievanceForm;
