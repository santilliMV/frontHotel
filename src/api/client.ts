import axios from 'axios';


const client = axios.create({
  baseURL: 'http://localhost:8080/api',
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
      // Solo redirigir si había sesión activa (token expirado)
      // Si no hay sesión, es un login fallido — dejar que el catch del Login maneje el error
      if (stored) {
        localStorage.removeItem('hotel_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;