import { z } from "zod";

export const crearSedeSchema = z.object({
  nombre: z.string().min(1, "The location name is required.").max(120),
  direccion: z.string().min(1, "The address is required.").max(255),
});
