// Resposta HTTP de uma function onCall: "result" em caso de sucesso, "error" em caso de falha
export type CallableResponseTypes<T> = {
  result?: T;
  error?: { status: string; message: string };
};

// Resposta do login por e-mail e senha no emulador do Auth
export type LoginResponseTypes = {
  idToken: string;
};

// Campos de um atendimento que os testes conferem
export type AtendimentoTypes = {
  id: string;
  tenantId: string;
};

// Retorno da function resumoPorTenant
export type ResumoTypes = {
  novo: number;
  pendente: number;
  resolvido: number;
};
