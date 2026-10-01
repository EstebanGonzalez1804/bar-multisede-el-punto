import { apiClient } from "./client";
import type { UsuarioAutenticado } from "./types";

export interface LoginResponse {
  token: string;
  usuario: UsuarioAutenticado;
}

export async function login(codigoUsuario: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>("/auth/login", {
    codigoUsuario,
    password,
  });
  return data;
}

export async function logout(motivo: "MANUAL" | "INACTIVIDAD"): Promise<void> {
  await apiClient.post("/auth/logout", { motivo });
}

export async function obtenerUsuarioActual(): Promise<UsuarioAutenticado> {
  const { data } = await apiClient.get<{ usuario: UsuarioAutenticado }>("/auth/me");
  return data.usuario;
}

export async function cambiarPasswordPropia(
  passwordActual: string,
  passwordNueva: string
): Promise<void> {
  await apiClient.put("/auth/password", { passwordActual, passwordNueva });
}

/** HU-005 — Cambio de contraseña de un tercero, solo Administrador. */
export async function cambiarPasswordDeTercero(idUsuario: number, passwordNueva: string): Promise<void> {
  await apiClient.put(`/auth/usuarios/${idUsuario}/password`, { passwordNueva });
}

/** HU-004 — Desbloqueo de usuario, solo Administrador. */
export async function desbloquearUsuario(idUsuario: number): Promise<void> {
  await apiClient.post(`/auth/usuarios/${idUsuario}/desbloquear`);
}
