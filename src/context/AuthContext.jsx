import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

// Helper to determine role from email
const getRoleFromEmail = (email) => {
    if (!email) return 'student';
    const lowerEmail = email.toLowerCase();
    // Admin if ends with @vit.ac.in (not vitstudent)
    if (lowerEmail.endsWith('@vit.ac.in') && !lowerEmail.endsWith('@vitstudent.ac.in')) return 'admin';
    return 'student';
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        // Get initial session with timeout
        const initAuth = async () => {
            try {
                // Add timeout to prevent hanging
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Session timeout')), 5000)
                );

                const sessionPromise = supabase.auth.getSession();

                const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

                if (!isMounted) return;

                if (session?.user) {
                    setUser(session.user);
                    const role = getRoleFromEmail(session.user.email);
                    setUserRole(role);
                } else {
                    // No session - clear state
                    setUser(null);
                    setUserRole(null);
                }
            } catch (err) {
                console.error('Auth init error:', err);
                // On error, clear state and allow login
                if (isMounted) {
                    setUser(null);
                    setUserRole(null);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                console.log('Auth event:', event);

                if (!isMounted) return;

                if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setUserRole(null);
                    setLoading(false);
                    return;
                }

                if (session?.user) {
                    setUser(session.user);
                    const role = getRoleFromEmail(session.user.email);
                    setUserRole(role);
                } else {
                    setUser(null);
                    setUserRole(null);
                }
                setLoading(false);
            }
        );

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const signIn = async (email, password) => {
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setLoading(false);
                return { data, error };
            }

            let role = 'student';
            if (data.user) {
                setUser(data.user);
                role = getRoleFromEmail(data.user.email);
                setUserRole(role);
            }

            setLoading(false);
            return { data, error, role };
        } catch (err) {
            setLoading(false);
            return { data: null, error: err };
        }
    };

    const signUp = async (email, password, role = 'student', fullName = '') => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    role,
                    full_name: fullName,
                },
            },
        });
        return { data, error };
    };

    const signOut = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signOut();
            // Always clear state on logout attempt
            setUser(null);
            setUserRole(null);
            setLoading(false);
            return { error };
        } catch (err) {
            // Even on error, clear state
            setUser(null);
            setUserRole(null);
            setLoading(false);
            return { error: err };
        }
    };

    const value = {
        user,
        userRole,
        loading,
        signIn,
        signUp,
        signOut,
        isStudent: userRole === 'student',
        isAdmin: userRole === 'admin',
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
