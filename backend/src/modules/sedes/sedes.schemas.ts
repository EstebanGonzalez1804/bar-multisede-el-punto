import { z } from "zod";

export const crearSedeSchema = z.object({
  nombre: z.string().min(1, "El nombre de la sede es obligatorio.").max(120),
  direccion: z.string().min(1, "La dirección es obligatoria.").max(255),
});
