import axios from 'axios';

// Get base URL from env, or default to a commonly used local port for jiotv-go
const baseURL = import.meta.env.VITE_JIOTV_API_URL || 'http://localhost:5001';

export const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// We'll add interceptors later to inject the token if needed,
// though JioTV-Go primarily uses the session established during login.
