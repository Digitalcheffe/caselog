import { apiRequest } from './client';

export const api = {
  getProfile: () => apiRequest('/api/profile'),
  getShelves: () => apiRequest('/api/shelves'),
  search: (query: string) => apiRequest(`/api/search?q=${encodeURIComponent(query)}`)
};
