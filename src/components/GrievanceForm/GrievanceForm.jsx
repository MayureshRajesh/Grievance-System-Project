import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Upload, X, Image } from 'lucide-react';
import './GrievanceForm.css';

const CATEGORIES = [
    { value: '', label: 'Select a category' },
    { value: 'infrastructure', label: 'Infrastructure' },
    { value: 'food_services', label: 'Food Services' },
    { value: 'academic', label: 'Academic Issues' },
    { value: 'hostel', label: 'Hostel Related' },
    { value: 'security', label: 'Security' },
    { value: 'transportation', label: 'Transportation' },
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
    { value: 'sports_ground', label: 'Sports Ground' },
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
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                setError('Please select an image file.');
                return;
            }
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                setError('Image size must be less than 5MB.');
                return;
            }
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setError('');
        }
    };

    const removeImage = () => {
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const uploadImage = async () => {
        if (!imageFile) return null;

        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `public/${fileName}`;

        const { data, error: uploadError } = await supabase.storage
            .from('grievance-images')
            .upload(filePath, imageFile, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            throw new Error(`Image upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('grievance-images')
            .getPublicUrl(filePath);

        console.log('Image uploaded, URL:', urlData.publicUrl);
        return urlData.publicUrl;
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
            // Upload image if attached - MUST succeed if image is selected
            let imageUrl = null;
            if (imageFile) {
                try {
                    imageUrl = await uploadImage();
                    if (!imageUrl) {
                        throw new Error('Failed to get image URL');
                    }
                } catch (uploadErr) {
                    console.error('Image upload failed:', uploadErr);
                    setError(`Image upload failed: ${uploadErr.message}. Please try again or remove the image.`);
                    setLoading(false);
                    return; // Block submission if image upload fails
                }
            }

            const { error: insertError } = await supabase
                .from('grievances')
                .insert({
                    user_id: user.id,
                    user_email: user.email,
                    title: title.trim(),
                    category,
                    location,
                    description: description.trim(),
                    privacy,
                    image_url: imageUrl,
                    status: 'pending',
                    progress: 0,
                });

            if (insertError) {
                console.error('Insert error:', insertError);
                setError(`Failed to submit: ${insertError.message}`);
                setLoading(false);
                return;
            }

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
                                Attach Image <span className="optional">(Optional - recommended)</span>
                            </label>
                            {!imagePreview ? (
                                <div
                                    className="image-upload-area"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload size={24} />
                                    <span>Click to upload an image</span>
                                    <span className="hint">PNG, JPG up to 150KB</span>
                                </div>
                            ) : (
                                <div className="image-preview">
                                    <img src={imagePreview} alt="Preview" />
                                    <button
                                        type="button"
                                        className="remove-image"
                                        onClick={removeImage}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
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
