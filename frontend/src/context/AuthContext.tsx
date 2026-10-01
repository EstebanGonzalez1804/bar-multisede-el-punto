import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as authApi from "../api/auth";
import { AUTH_UNAUTHORIZED_EVENT, getStoredToken, setStoredToken } from "../api/client";
import type { UsuarioAutenticado } from "../api/types";

// HU-006 CA-04: el valor es fijo (no hay parametrización del tiempo de
// inactividad) — tres minutos, siempre.
const INACTIVIDAD_MS = 3 * 60 * 1000;

const EVENTOS_DE_ACTIVIDAD = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

interface AuthContextValue {
  usuario: UsuarioAutenticado | null;
  cargando: boolean;
  iniciarSesion: (codigoUsuario: string, password: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(null);
  const [cargando, setCargando] = useState(true);
  const inactividadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limpiarSesionLocal = useCallback(() => {
    setStoredToken(null);
    setUsuario(null);
  }, []);

  const cerrarSesion = useCallback(
    async (motivo: "MANUAL" | "INACTIVIDAD" = "MANUAL") => {
      try {
        if (getStoredToken()) {
          await authApi.logout(motivo);
        }
      } catch {
        // Si la llamada falla (p. ej. ya expiró el token) igual se limpia
        // la sesión localmente: el cierre de sesión nunca debe quedar
        // bloqueado por un error de red.
      } finally {
        limpiarSesionLocal();
      }
    },
    [limpiarSesionLocal]
  );

  // ---- HU-006 CA-01: cierre automático tras 3 minutos de inactividad ----
  useEffect(() => {
    if (!usuario) return;

    const reiniciarTemporizador = () => {
      if (inactividadTimer.current) clearTimeout(inactividadTimer.current);
      inactividadTimer.current = setTimeout(() => {
        void cerrarSesion("INACTIVIDAD");
      }, INACTIVIDAD_MS);
    };

    reiniciarTemporizador();
    EVENTOS_DE_ACTIVIDAD.forEach((evento) =>
      window.addEventListener(evento, reiniciarTemporizador)
    );

    return () => {
      if (inactividadTimer.current) clearTimeout(inactividadTimer.current);
      EVENTOS_DE_ACTIVIDAD.forEach((evento) =>
        window.removeEventListener(evento, reiniciarTemporizador)
      );
    };
  }, [usuario, cerrarSesion]);

  // ---- Token inválido/expirado detectado por el interceptor de axios ----
  useEffect(() => {
    const onUnauthorized = () => setUsuario(null);
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // ---- Restaurar sesión al recargar la página, si hay un token guardado ----
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setCargando(false);
      return;
    }
    authApi
      .obtenerUsuarioActual()
      .then(setUsuario)
      .catch(() => setStoredToken(null))
      .finally(() => setCargando(false));
  }, []);

  const iniciarSesion = useCallback(async (codigoUsuario: string, password: string) => {
    const { token, usuario: usuarioAutenticado } = await authApi.login(codigoUsuario, password);
    setStoredToken(token);
    setUsuario(usuarioAutenticado);
  }, []);

  return (
    <AuthContext.Provider
      value={{ usuario, cargando, iniciarSesion, cerrarSesion: () => cerrarSesion("MANUAL") }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>.");
  return ctx;
}
