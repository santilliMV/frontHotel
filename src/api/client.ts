import axios from 'axios';

// En desarrollo (npm run dev): usa http://localhost:8080/api
// En producción (dentro del JAR): usa /api (misma URL, sin dominio)
const baseURL = import.meta.env.VITE_API_URL ?? '/api';

const client = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use((config) => {
  const stored = localStorage.getItem('hotel_user');
  if (stored) {
    const user = JSON.parse(stored);
    if (user?.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const stored = localStorage.getItem('hotel_user');
      if (stored) {
        localStorage.removeItem('hotel_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;