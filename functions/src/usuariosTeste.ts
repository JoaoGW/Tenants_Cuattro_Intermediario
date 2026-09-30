// Array de usuários de teste fixos, um por tenant, com o tenantId que vira custom claim login no front e demonstração do isolamento
export const usuariosTeste = [
  { uid: "usuario-alfa", email: "alfa@teste.local", senha: "senha123", tenantId: "tenant-alfa" },
  { uid: "usuario-beta", email: "beta@teste.local", senha: "senha123", tenantId: "tenant-beta" },
];
