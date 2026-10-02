import { useEffect, useState, type FormEvent } from "react";

import { onAuthStateChanged, signInWithEmailAndPassword, type User } from "firebase/auth";
import { httpsCallable } from "firebase/functions";

import { auth, functions } from "./firebase";

type Atendimento = {
  id: string;
  transcricao: string;
  status: string;
  duracaoSegundos: number;
};

export default function App() {
  // User | null - usuário autenticado no emulador do Auth - decide se mostra o login ou os atendimentos
  const [usuario, setUsuario] = useState<User | null>(null);
  // string - e-mail digitado no formulário de login - usado em entrar()
  const [email, setEmail] = useState("");
  // string - senha digitada no formulário de login - usada em entrar()
  const [senha, setSenha] = useState("");
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Acompanha o login (inclusive o que ficou salvo no navegador) e para de ouvir ao desmontar
  useEffect(() => onAuthStateChanged(auth, setUsuario), []);

  /**
    * Faz login com e-mail e senha no emulador do Auth.
    * Usado no onSubmit do formulário de login.
    *
    * @remarks O tenant não é escolhido aqui: ele vem do custom claim tenantId do usuário.
    *
    * @params evento, FormEvent<HTMLFormElement>, envio do formulário (o recarregamento da página é cancelado)
    * @return Nada. Em caso de falha, mostra a mensagem em erro
  **/
  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    }
  }

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const listAtendimentos = httpsCallable(functions, "listAtendimentos");
      const resp = await listAtendimentos();
      setAtendimentos((resp.data as { atendimentos: Atendimento[] }).atendimentos);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 720, margin: "40px auto" }}>
      <h1>AtendeAI — projeto de teste</h1>
      {!usuario ? (
        <form onSubmit={entrar}>
          <input type="email" placeholder="e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />{" "}
          <input type="password" placeholder="senha" value={senha} onChange={(e) => setSenha(e.target.value)} />{" "}
          <button type="submit">entrar</button>
        </form>
      ) : (
        <>
          <p>
            Logado como <code>{usuario.email}</code>{" "}
            <button onClick={carregar} disabled={carregando}>
              {carregando ? "carregando..." : "carregar atendimentos"}
            </button>
          </p>
          <ul>
            {atendimentos.map((a) => (
              <li key={a.id}>
                <strong>{a.status}</strong> ({a.duracaoSegundos}s) — {a.transcricao}
              </li>
            ))}
          </ul>
        </>
      )}
      {erro && <p style={{ color: "red" }}>{erro}</p>}
    </div>
  );
}
