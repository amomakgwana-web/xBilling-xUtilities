// Load services/gateway/.env (if present) before anything below reads
// process.env. Real deployments set these vars through the platform instead
// of a checked-in file, so a missing .env is not an error.
try {
  process.loadEnvFile();
} catch {
  // no .env file — fall back to whatever the environment already provides
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(","),
  services: {
    billing: process.env.BILLING_SERVICE_URL ?? "http://localhost:4001",
    payments: process.env.PAYMENTS_SERVICE_URL ?? "http://localhost:4002",
    metering: process.env.METERING_SERVICE_URL ?? "http://localhost:4003",
    comms: process.env.COMMS_SERVICE_URL ?? "http://localhost:4004",
    compliance: process.env.COMPLIANCE_SERVICE_URL ?? "http://localhost:4005",
  },
} as const;

export type ServiceName = keyof typeof config.services;
