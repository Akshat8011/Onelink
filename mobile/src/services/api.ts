import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = __DEV__
  ? 'http://localhost:10000/api'  // Dev
  : 'https://onelink-fkqd.onrender.com/api'; // Production

// The backend runs on Render's free tier, which sleeps after ~15 min idle and
// takes 30-60s to cold-start. A short timeout aborts that legitimate wake-up and
// surfaces as a false "invalid credentials" / "connection error". Allow a
// generous window and retry once on transport failures.
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await AsyncStorage.getItem('onelink_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.warn('Error reading token', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Retry once on network/timeout errors (no HTTP response) — typically a cold
// backend. The pause lets the server finish waking before the retry. Requests
// that got a real HTTP response (401, 400, 5xx) are returned as-is.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const cfg: any = error?.config;
    const noResponse = !error?.response;
    if (cfg && noResponse && !cfg.__retried) {
      cfg.__retried = true;
      await new Promise((r) => setTimeout(r, 2500));
      return api(cfg);
    }
    return Promise.reject(error);
  }
);

/**
 * Wake the (possibly sleeping) backend without blocking the UI. Call on app /
 * login-screen mount so the server is warm by the time the user acts.
 */
export async function warmUp(): Promise<void> {
  try {
    await axios.get(`${API_BASE_URL}/v1/kiosk/stations`, { timeout: 60000 });
  } catch {
    /* ignore — best-effort */
  }
}

export default api;
