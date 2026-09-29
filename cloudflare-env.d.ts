declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    FIREBASE_PROJECT_ID?: string;
    FIREBASE_SERVICE_ACCOUNT?: string;
    FIRESTORE_EMULATOR_HOST?: string;
    BUCKET?: R2Bucket;
  }
}
