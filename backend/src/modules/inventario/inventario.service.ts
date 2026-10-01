import { pool, withTransaction } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { aplicarMovimientoInventario, type MotivoAjuste } from "../../utils/inventario";
import { registrarEvento } from "../../utils/trazabilidad";
import type { JwtPayload } from "../../types/auth";

export interface ItemInventario {
  idProducto: number;
  codigoProducto: string;
  nombreProducto: string;
  nombreTipoProducto: string;
  estadoProducto: "ACTIVO" | "INACTIVO";
  idSede: number;
  nombreSede: string;
  cantidadDisponible: number;
}

interface ItemInventarioRow {
  id_producto: number;
  codigo_producto: string;
  nombre_producto: string;
  nombre_tipo_producto: string;
  estado_producto: "ACTIVO" | "INACTIVO";
  id_sede: number;
  nombre_sede: string;
  cantidad_disponible: number;
}

function mapItem(row: ItemInventarioRow): ItemInventario {
  return {
    idProducto: row.id_producto,
    codigoProducto: row.codigo_producto,
    nombreProducto: row.nombre_producto,
    nombreTipoProducto: row.nombre_tipo_producto,
    estadoProducto: row.estado_producto,
    idSede: row.id_sede,
    nombreSede: row.nombre_sede,
    cantidadDisponible: row.cantidad_disponible,
  };
}

/**
 * HU-020 — Consulta de inventario disponible por sede. `idSedeEfectiva` ya
 * viene resuelto por `resolveSedeScope`: null = Administrador sin filtrar
 * (ve el cruce producto × sede completo, CA-02); número = acotado a esa
 * sede (Cajero/Mesero siempre, o Administrador si filtró).
 *
 * Se parte de PRODUCTO (CROSS JOIN SEDE cuando no hay filtro) y se hace
 * LEFT JOIN a INVENTARIO: un producto sin fila todavía en INVENTARIO para
 * esa sede (nunca recibió mercancía ahí) se muestra con 0, no se omite —
 * así CA-05 ("existencia en cero se muestra como no disponible") es
 * consultable incluso antes de la primera recepción. No se filtra por
 * estado del producto: uno inactivado (HU-016) conserva su existencia
 * visible, solo deja de poder agregarse a pedidos nuevos.
 */
export async function listarInventario(idSedeEfectiva: number | null): Promise<ItemInventario[]> {
  const { rows } = await pool.query<ItemInventarioRow>(
    `SELECT p.id_producto, p.codigo AS codigo_producto, p.nombre AS nombre_producto,
            t.nombre AS nombre_tipo_producto, p.estado AS estado_producto,
            s.id_sede, s.nombre AS nombre_sede,
            COALESCE(i.cantidad_disponible, 0) AS cantidad_disponible
     FROM producto p
     JOIN tipo_producto t ON t.id_tipo_producto = p.id_tipo_producto
     CROSS JOIN sede s
     LEFT JOIN inventario i ON i.id_producto = p.id_producto AND i.id_sede = s.id_sede
     WHERE ($1::int IS NULL OR s.id_sede = $1)
     ORDER BY s.nombre, p.nombre`,
    [idSedeEfectiva]
  );
  return rows.map(mapItem);
}

interface DatosAjuste {
  idProducto: number;
  idSede: number;
  cantidadAjuste: number;
  motivo: MotivoAjuste;
}

/**
 * HU-022 — Registro de ajuste de inventario. Motivo obligatorio (CA-02);
 * sin flujo de aprobación, se aplica directo (CA-07). La validación de "no
 * puede dejar el inventario negativo" (CA-03) la hace
 * aplicarMovimientoInventario, que es la misma ruta que usan recepciones y
 * ventas, así que el comportamiento es idéntico en los tres casos.
 */
export async function registrarAjuste(usuario: JwtPayload, datos: DatosAjuste): Promise<ItemInventario> {
  return withTransaction(async (client) => {
    const { rows: productoRows } = await client.query<{
      codigo: string;
      nombre: string;
      estado: "ACTIVO" | "INACTIVO";
      nombre_tipo_producto: string;
    }>(
      `SELECT p.codigo, p.nombre, p.estado, t.nombre AS nombre_tipo_producto
       FROM producto p JOIN tipo_producto t ON t.id_tipo_producto = p.id_tipo_producto
       WHERE p.id_producto = $1`,
      [datos.idProducto]
    );
    if (!productoRows[0]) {
      throw ApiError.notFound("El producto indicado no existe.");
    }

    const { rows: sedeRows } = await client.query<{ nombre: string }>(
      `SELECT nombre FROM sede WHERE id_sede = $1`,
      [datos.idSede]
    );
    if (!sedeRows[0]) {
      throw ApiError.notFound("La sede indicada no existe.");
    }

    const { cantidadAnterior, cantidadResultante } = await aplicarMovimientoInventario(
      {
        idProducto: datos.idProducto,
        idSede: datos.idSede,
        idUsuario: usuario.idUsuario,
        tipoMovimiento: "AJUSTE",
        cantidad: datos.cantidadAjuste,
        motivo: datos.motivo,
      },
      client
    );

    // CA-08 HU-022: cantidad anterior, ajuste, cantidad resultante, motivo,
    // producto, usuario, sede, fecha y hora. Usuario/sede/fecha/hora ya
    // quedan en la propia fila de trazabilidad.
    await registrarEvento(
      {
        idUsuario: usuario.idUsuario,
        tipoEvento: "INVENTARIO_AJUSTADO",
        entidadAfectada: "INVENTARIO",
        idAfectado: datos.idProducto,
        idSede: datos.idSede,
        detalle: {
          cantidadAnterior,
          ajuste: datos.cantidadAjuste,
          cantidadResultante,
          motivo: datos.motivo,
        },
      },
      client
    );

    return {
      idProducto: datos.idProducto,
      codigoProducto: productoRows[0].codigo,
      nombreProducto: productoRows[0].nombre,
      nombreTipoProducto: productoRows[0].nombre_tipo_producto,
      estadoProducto: productoRows[0].estado,
      idSede: datos.idSede,
      nombreSede: sedeRows[0].nombre,
      cantidadDisponible: cantidadResultante,
    };
  });
}
