import { apiClient } from "./client";
import type { Estado, Perfil, Usuario } from "./types";

export interface FiltrosUsuarios {
  busqueda?: string;
  idSede?: number;
  perfil?: Perfil;
  estado?: Estado;
}

export async function listarUsuarios(filtros: FiltrosUsuarios = {}): Promise<Usuario[]> {
  const { data } = await apiClient.get<{ usuarios: Usuario[] }>("/usuarios", { params: filtros });
  return data.usuarios;
}

export interface DatosUsuario {
  nombre: string;
  idSede: number | null;
  perfil: Perfil;
}

export async function crearUsuario(datos: DatosUsuario & { password: string }): Promise<Usuario> {
  const { data } = await apiClient.post<{ usuario: Usuario }>("/usuarios", datos);
  return data.usuario;
}

export async function modificarUsuario(idUsuario: number, datos: DatosUsuario): Promise<Usuario> {
  const { data } = await apiClient.put<{ usuario: Usuario }>(`/usuarios/${idUsuario}`, datos);
  return data.usuario;
}

export async function cambiarEstadoUsuario(idUsuario: number, estado: Estado): Promise<Usuario> {
  const { data } = await apiClient.put<{ usuario: Usuario }>(`/usuarios/${idUsuario}/estado`, { estado });
  return data.usuario;
}
