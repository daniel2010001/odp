import { z } from "zod/v4";

export const loginSchema = z.object({
	username: z.string().trim().min(1, "El nombre de usuario es obligatorio"),
	password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export type LoginInput = z.infer<typeof loginSchema>;
