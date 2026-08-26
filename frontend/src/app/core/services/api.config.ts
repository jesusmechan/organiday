function apiBaseUrl(): string {
  if (typeof location === 'undefined') {
    return 'http://127.0.0.1:8000/api';
  }
  if (location.port === '4200') {
    return 'http://127.0.0.1:8000/api';
  }
  return `${location.origin}/api`;
}

export const API_BASE_URL = apiBaseUrl();
