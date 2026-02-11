import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children, allowedRole }) {
    const { user, userRole, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading...</p>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/" replace />;
    }

    // If no specific role required, allow any authenticated user
    if (!allowedRole) {
        return children;
    }

    // Check if user has the required role
    if (userRole !== allowedRole) {
        // Redirect to the correct dashboard based on their actual role
        console.log('Role mismatch. Required:', allowedRole, 'Actual:', userRole);
        if (userRole === 'admin') {
            return <Navigate to="/admin" replace />;
        }
        return <Navigate to="/student" replace />;
    }

    return children;
}

export default ProtectedRoute;
