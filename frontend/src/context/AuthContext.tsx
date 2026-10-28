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
// Aviso previo: 30 segundos antes del cierre se muestra una advertencia con
// cuenta regresiva (no cambia la regla de los 3 minutos; cualquier actividad
// —mover el mouse, tocar o escribir— mantiene la sesión abierta).
const AVISO_PREVIO_MS = 30 * 1000;

// Frecuencia con la que se verifica que la sesión siga siendo la vigente.
const LATIDO_SESION_MS = 10 * 1000;

const EVENTOS_DE_ACTIVIDAD = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"] as const;

interface AuthContextValue {
  usuario: UsuarioAutenticado | null;
  cargando: boolean;
  iniciarSesion: (codigoUsuario: string, password: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
  /** Segundos que faltan para el cierre por inactividad, o null si no hay aviso activo. */
  segundosParaCierre: number | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioAutenticado | null>(null);
  const [cargando, setCargando] = useState(true);
  const inactividadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avisoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cuentaRegresiva = useRef<ReturnType<typeof setInterval> | null>(null);
  const [segundosParaCierre, setSegundosParaCierre] = useState<number | null>(null);
  const avisoVisible = useRef(false);

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

    const limpiarTimers = () => {
      if (inactividadTimer.current) clearTimeout(inactividadTimer.current);
      if (avisoTimer.current) clearTimeout(avisoTimer.current);
      if (cuentaRegresiva.current) clearInterval(cuentaRegresiva.current);
    };

    const reiniciarTemporizador = () => {
      limpiarTimers();
      if (avisoVisible.current) {
        avisoVisible.current = false;
        setSegundosParaCierre(null);
      }
      avisoTimer.current = setTimeout(() => {
        avisoVisible.current = true;
        let restantes = Math.round(AVISO_PREVIO_MS / 1000);
        setSegundosParaCierre(restantes);
        cuentaRegresiva.current = setInterval(() => {
          restantes -= 1;
          setSegundosParaCierre(Math.max(restantes, 0));
        }, 1000);
      }, INACTIVIDAD_MS - AVISO_PREVIO_MS);
      inactividadTimer.current = setTimeout(() => {
        limpiarTimers();
        avisoVisible.current = false;
        setSegundosParaCierre(null);
        void cerrarSesion("INACTIVIDAD");
      }, INACTIVIDAD_MS);
    };

    reiniciarTemporizador();
    EVENTOS_DE_ACTIVIDAD.forEach((evento) =>
      window.addEventListener(evento, reiniciarTemporizador)
    );

    return () => {
      limpiarTimers();
      avisoVisible.current = false;
      setSegundosParaCierre(null);
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

  // ---- Sesión única: si otro dispositivo ingresó con este usuario, este se
  // entera en pocos segundos (el interceptor de axios cierra la sesión local
  // al recibir SESION_REEMPLAZADA). Sin esto, solo se notaría al hacer clic.
  useEffect(() => {
    if (!usuario) return;
    const id = setInterval(() => {
      authApi.obtenerUsuarioActual().catch(() => undefined);
    }, LATIDO_SESION_MS);
    return () => clearInterval(id);
  }, [usuario]);

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
      value={{
        usuario,
        cargando,
        iniciarSesion,
        cerrarSesion: () => cerrarSesion("MANUAL"),
        segundosParaCierre,
      }}
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
