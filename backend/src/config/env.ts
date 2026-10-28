import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable "${name}". Check your .env file (use .env.example as a reference).`
    );
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  loginMaxIntentosFallidos: Number(process.env.LOGIN_MAX_INTENTOS_FALLIDOS ?? 3),
  sesionInactividadMinutos: Number(process.env.SESION_INACTIVIDAD_MINUTOS ?? 3),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};
