import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: "atendeai-teste-local" });
}

export const db = admin.firestore();

// Cliente Admin do Firebase Auth usa o emulador quando FIREBASE_AUTH_EMULATOR_HOST está definido
export const auth = admin.auth();
