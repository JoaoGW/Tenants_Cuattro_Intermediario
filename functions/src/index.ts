import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { db } from "./admin";

/**
 * Function de exemplo — só para você confirmar que o ambiente está rodando.
 */
export const ping = onCall(() => {
  return { ok: true, message: "pong" };
});

/**
  * Retorna o tenantId do usuário autenticado, lido do token (custom claim).
 * Usado por listAtendimentos, createAtendimento e resumoPorTenant.
  *
  * @remarks Nunca usa o payload da chamada: o tenant sempre vem do token.
  *
  * @params request, CallableRequest, a requisição recebida pela function onCall
  * @return O tenantId do token. Lança unauthenticated sem login e permission-denied sem claim válido
**/
const getTenantIdFromAuth = (request: CallableRequest): string => {
  if(!request.auth) {
    throw new HttpsError("unauthenticated", "Faça login para continuar.");
  }

  const tenantId: unknown = request.auth.token.tenantId;

  if(typeof tenantId !== "string" || tenantId === "") {
    throw new HttpsError("permission-denied", "Usuário sem tenant associado.");
  }

  return tenantId
}

/**
 * Lista os atendimentos de UM tenant.
 *
 * Os tenants agora vem do token autenticado.
 * Esse método irá listar todos os atendimentos disponíveis para aqueles tenants com
 * auth ativo naquele momento.
 *
 */
export const listAtendimentos = onCall(async (request) => {
  const tenantId = getTenantIdFromAuth(request);

  const snapshot = await db
    .collection("atendimentos")
    .where("tenantId", "==", tenantId)
    .get();

  return {
    atendimentos: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
});

/**
 * Cria um novo registro de atendimento para um tenant.
 * Implementação mínima — sem validação de schema.
 */
export const createAtendimento = onCall(async (request) => {
  const { transcricao, duracaoSegundos } = request.data ?? {};

  const tenantId = getTenantIdFromAuth(request);

  const doc = await db.collection("atendimentos").add({
    tenantId,
    transcricao: transcricao ?? "",
    duracaoSegundos: duracaoSegundos ?? 0,
    status: "novo",
    criadoEm: new Date().toISOString(),
  });

  return { id: doc.id };
});

/**
 * Retorna a quantidade de atendimentos por status para o tenant autenticado.
 */
export const resumoPorTenant = onCall(async (request) => {
  const tenantId = getTenantIdFromAuth(request);

  // Consulta base dos atendimentos pertencentes ao tenant autenticado.
  const atendimentosDoTenant = db.collection("atendimentos").where("tenantId", "==", tenantId);

  const [novo, pendente, resolvido] = await Promise.all([
    atendimentosDoTenant.where("status", "==", "novo").count().get(),
    atendimentosDoTenant.where("status", "==", "pendente").count().get(),
    atendimentosDoTenant.where("status", "==", "resolvido").count().get(),
  ]);

  return {
    novo: novo.data().count,
    pendente: pendente.data().count,
    resolvido: resolvido.data().count,
  };
});
