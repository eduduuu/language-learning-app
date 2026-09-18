import axios from 'axios';
import { supabase } from './supabase';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080/api/v1',
});

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;

  if (userId) {
    config.headers['x-user-id'] = userId;
  }

  return config;
});