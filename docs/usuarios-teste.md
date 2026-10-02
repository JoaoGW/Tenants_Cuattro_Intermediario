# Usuários de teste

O `npm run seed` também cria estes usuários no emulador do Auth, cada um com o `tenantId` como *custom claim* (só existem no emulador local). Eles são definidos em `functions/src/usuariosTeste.ts`.

| E-mail | Senha | `tenantId` (custom claim) |
| --- | --- | --- |
| `alfa@teste.local` | `senha123` | `tenant-alfa` |
| `beta@teste.local` | `senha123` | `tenant-beta` |
