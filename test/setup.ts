import crypto from "crypto";

const testEncryptionKey = crypto.randomBytes(32).toString("hex");

process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/auth/google/callback";
process.env.PORT = "0";
process.env.SESSION_SECRET = "test-session-secret";
process.env.TOKEN_ENCRYPTION_KEY = testEncryptionKey;
process.env.SHS_SECRET = "test-shs-secret";
process.env.APP_URL = "http://localhost:3000";
process.env.SMTP_HOST = "localhost";
process.env.SMTP_PORT = "2525";
process.env.SMTP_USER = "test";
process.env.SMTP_PASS = "test";
process.env.EMAIL_FROM = "test@example.com";
