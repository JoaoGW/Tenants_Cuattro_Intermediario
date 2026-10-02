import * as admin from "firebase-admin";

import { AtendimentoTypes, CallableResponseTypes, LoginResponseTypes, ResumoTypes } from "./@types/callableTypes";

// Garante um único app inicializado apontando para os emuladores
// (FIRESTORE_EMULATOR_HOST e FIREBASE_AUTH_EMULATOR_HOST são definidos no script "npm test").
if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: "atendeai-teste-local" });
}

// Firestore - acesso direto ao banco do emulador - usado para gravar dados de teste e conferir o que as functions gravaram
const db = admin.firestore();

// string - id do projeto local - usado nas URLs dos emuladores
const PROJECT_ID = "atendeai-teste-local";

// string - endereço do emulador do Auth - usado no login e na limpeza dos usuários
const AUTH_URL = "http://localhost:9099";

// string - endereço do emulador do Firestore - usado na limpeza dos dados
const FIRESTORE_URL = "http://localhost:8080";

// string - endereço base das functions no emulador - usado em todas as chamadas
const FUNCTIONS_URL = `http://localhost:5001/${PROJECT_ID}/us-central1`;

// string - senha dos usuários criados pelos testes - usada no login
const SENHA = "senha-teste-123";

// Objeto - status dos atendimentos gravados em cada tenant, com contagens diferentes para que qualquer mistura apareça - usado no beforeAll e nas asserções
const STATUS_POR_TENANT: Record<string, string[]> = {
  "tenant-a": ["novo", "novo", "pendente", "resolvido", "resolvido", "resolvido"],
  "tenant-b": ["novo", "pendente", "pendente", "pendente", "pendente"],
};

/**
  * Faz login por e-mail e senha no emulador do Auth, como o front-end faria.
  * Usado no beforeAll para obter o token de cada usuário de teste.
  *
  * @remarks O token devolvido carrega o custom claim tenantId definido no beforeAll.
  *
  * @params email, string, e-mail do usuário de teste
  * @return O idToken do usuário autenticado
**/
async function login(email: string): Promise<string> {
  const resposta = await fetch(`${AUTH_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: SENHA, returnSecureToken: true }),
  });

  if (!resposta.ok) {
    throw new Error(`Falha no login de ${email}: HTTP ${resposta.status}`);
  }

  const corpo = (await resposta.json()) as LoginResponseTypes;
  return corpo.idToken;
}

/**
  * Chama uma function onCall pelo HTTP do emulador, do mesmo jeito que o SDK do front-end faz.
  * Usado em todos os testes.
  *
  * @remarks Sem idToken, a chamada vai sem o header Authorization (usuário não autenticado).
  *
  * @params nome, string, nome da function exportada
  * @params data, unknown, payload enviado à function
  * @params idToken, string opcional, token do usuário autenticado
  * @return A resposta da function: result em sucesso ou error em falha
**/
async function chamar<T>(nome: string, data: unknown, idToken?: string): Promise<CallableResponseTypes<T>> {
  // Objeto - headers da requisição - recebe o Authorization só quando há token
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  // O protocolo das functions onCall exige o campo "data" no corpo, mesmo quando é null
  const resposta = await fetch(`${FUNCTIONS_URL}/${nome}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data: data ?? null }),
  });

  return (await resposta.json()) as CallableResponseTypes<T>;
}

describe("isolamento entre tenants", () => {
  // string - token do usuário do tenant A - preenchido no beforeAll
  let tokenA = "";
  // string - token do usuário do tenant B - preenchido no beforeAll
  let tokenB = "";

  beforeAll(async () => {
    await fetch(`${FIRESTORE_URL}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: "DELETE" });
    await fetch(`${AUTH_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`, { method: "DELETE" });

    await admin.auth().createUser({ uid: "teste-a", email: "a@teste.local", password: SENHA });
    await admin.auth().setCustomUserClaims("teste-a", { tenantId: "tenant-a" });
    await admin.auth().createUser({ uid: "teste-b", email: "b@teste.local", password: SENHA });
    await admin.auth().setCustomUserClaims("teste-b", { tenantId: "tenant-b" });

    // WriteBatch - grava todos os atendimentos de teste de uma vez
    const batch = db.batch();
    for (const [tenantId, statusList] of Object.entries(STATUS_POR_TENANT)) {
      for (const status of statusList) {
        batch.set(db.collection("atendimentos").doc(), {
          tenantId,
          transcricao: "atendimento de teste",
          duracaoSegundos: 60,
          status,
          criadoEm: new Date().toISOString(),
        });
      }
    }
    await batch.commit();

    tokenA = await login("a@teste.local");
    tokenB = await login("b@teste.local");
  });

  afterAll(async () => {
    await admin.app().delete();
  });

  it("um usuário do tenant A não vê dados do tenant B, mesmo forçando tenantId na chamada", async () => {
    const resposta = await chamar<{ atendimentos: AtendimentoTypes[] }>("listAtendimentos", { tenantId: "tenant-b" }, tokenA);

    expect(resposta.error).toBeUndefined();
    // Array - atendimentos devolvidos para o usuário A
    const atendimentos = resposta.result?.atendimentos ?? [];
    expect(atendimentos).toHaveLength(STATUS_POR_TENANT["tenant-a"].length);
    expect(atendimentos.every((atendimento) => atendimento.tenantId === "tenant-a")).toBe(true);
  });

  it("resumoPorTenant retorna as contagens do tenant autenticado, ignorando tenantId no payload", async () => {
    const respostaA = await chamar<ResumoTypes>("resumoPorTenant", { tenantId: "tenant-b" }, tokenA);
    const respostaB = await chamar<ResumoTypes>("resumoPorTenant", null, tokenB);

    expect(respostaA.result).toEqual({ novo: 2, pendente: 1, resolvido: 3 });
    expect(respostaB.result).toEqual({ novo: 1, pendente: 4, resolvido: 0 });
  });

  it.each(["listAtendimentos", "createAtendimento", "resumoPorTenant"])("%s recusa chamada sem usuário autenticado", async (nome) => {
    const resposta = await chamar<unknown>(nome, { tenantId: "tenant-a" });

    expect(resposta.result).toBeUndefined();
    expect(resposta.error?.status).toBe("UNAUTHENTICATED");
  });

  it("createAtendimento grava no tenant do token, ignorando tenantId no payload", async () => {
    const resposta = await chamar<{ id: string }>("createAtendimento", { tenantId: "tenant-b", transcricao: "tentativa" }, tokenA);
    // string - id do atendimento criado pela chamada
    const id = resposta.result?.id ?? "";
    expect(id).not.toBe("");

    try {
      const criado = await db.collection("atendimentos").doc(id).get();
      expect(criado.data()?.tenantId).toBe("tenant-a");

      const listaB = await chamar<{ atendimentos: AtendimentoTypes[] }>("listAtendimentos", null, tokenB);
      expect(listaB.result?.atendimentos.map((atendimento) => atendimento.id)).not.toContain(id);
    } finally {
      // Remove o atendimento criado para não alterar as contagens dos outros testes
      await db.collection("atendimentos").doc(id).delete();
    }
  });
});
