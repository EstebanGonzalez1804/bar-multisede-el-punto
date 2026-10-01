import axios, { type AxiosError } from "axios";
import type { ApiErrorBody } from "./types";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

const TOKEN_STORAGE_KEY = "bar_multisede_token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Evento que AuthContext escucha para limpiar la sesión cuando el token
 * quedó inválido/expirado del lado del servidor (p. ej. tras bloquearse). */
export const AUTH_UNAUTHORIZED_EVENT = "bar_multisede:unauthorized";

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      setStoredToken(null);
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error);
  }
);

/** Extrae un mensaje de error legible desde la respuesta de la API. */
export function getApiErrorMessage(err: unknown, fallback = "Ocurrió un error inesperado."): string {
  const axiosErr = err as AxiosError<ApiErrorBody>;
  return axiosErr.response?.data?.error?.message ?? fallback;
}
