declare namespace NodeJS {
  interface ProcessEnv {
    SESSION_SECRET: string;
    CORS_ORIGIN: string;
    DB_URL: string;
    PORT: string;
  }
}