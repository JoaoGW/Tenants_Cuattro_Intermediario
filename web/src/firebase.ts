import { initializeApp } from "firebase/app";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getAuth, connectAuthEmulator } from "firebase/auth";

// O Firebase Auth exige uma apiKey mesmo com o emulador; qualquer valor serve, pois nada vai para produção.
const app = initializeApp({ projectId: "atendeai-teste-local", apiKey: "fake-api-key" });

export const functions = getFunctions(app);
export const auth = getAuth(app);

// Sempre conecta no emulador local — este projeto nunca fala com Firebase de produção.
connectFunctionsEmulator(functions, "localhost", 5001);
connectAuthEmulator(auth, "http://localhost:9099");