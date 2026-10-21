import { useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, LockKeyhole, ShieldCheck } from "lucide-react";
import { passwordError } from "../domain/rules";

interface Props {
  configured: boolean;
  busy: boolean;
  error: string;
  onSubmit(password: string): Promise<void>;
}

export function AuthScreen({ configured, busy, error, onSubmit }: Props) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [localError, setLocalError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const issue = configured
      ? !password
        ? "Digite sua senha."
        : null
      : passwordError(password, confirmation);
    if (issue) {
      setLocalError(issue);
      return;
    }
    setLocalError("");
    const value = password;
    setPassword("");
    setConfirmation("");
    await onSubmit(value);
  }
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="brand">
          <span className="brand-icon">
            <BookOpen size={23} />
          </span>
          <span>
            Learning<span className="brand-light">Studio</span>
          </span>
        </div>
        <div>
          <span className="eyebrow">SEU ESPAÇO DE APRENDIZAGEM</span>
          <h1>
            Um passo por dia.
            <br />
            Um futuro inteiro
            <br />
            <em>pela frente.</em>
          </h1>
          <p>
            Organize o que quer aprender.
            <br />
            Reserve tempo para o que importa.
          </p>
        </div>
        <span className="auth-foot">
          <ShieldCheck size={18} /> Seus estudos ficam neste computador.
        </span>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form">
          <span className="round-icon">
            <LockKeyhole size={24} />
          </span>
          <span className="eyebrow">
            {configured ? "BOM TER VOCÊ DE VOLTA" : "VAMOS COMEÇAR"}
          </span>
          <h2>
            {configured ? "Seu espaço está protegido" : "Crie sua senha local"}
          </h2>
          <p>
            {configured
              ? "Digite sua senha para continuar seus estudos."
              : "Escolha uma frase longa e fácil de lembrar. Ela será pedida ao abrir o aplicativo."}
          </p>
          <form
            onSubmit={(event) => {
              void submit(event);
            }}
          >
            <label htmlFor="password">
              {configured ? "Senha" : "Nova senha"}
            </label>
            <input
              id="password"
              type="password"
              autoComplete={configured ? "current-password" : "new-password"}
              autoFocus
              value={password}
              maxLength={256}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              aria-describedby="auth-help"
              required
            />
            {!configured && (
              <>
                <label htmlFor="confirmation">Confirmar senha</label>
                <input
                  id="confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  maxLength={256}
                  onChange={(e) => setConfirmation(e.target.value)}
                  disabled={busy}
                  required
                />
              </>
            )}
            {(localError || error) && (
              <p className="error" role="alert">
                {localError || error}
              </p>
            )}
            <button
              className="button primary full"
              disabled={busy}
              type="submit"
            >
              {busy
                ? "Verificando…"
                : configured
                  ? "Desbloquear"
                  : "Criar meu espaço"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p id="auth-help" className="fine-print">
            {configured
              ? "Bloqueio automático após 15 minutos de inatividade."
              : "Mínimo de 12 caracteres. Não há recuperação de senha nesta versão; guarde-a em um local seguro."}
          </p>
          <div className="privacy-note">
            <ShieldCheck size={17} />
            <span>
              A senha protege o acesso pelo aplicativo. O banco local ainda não
              é criptografado; proteja sua conta do Windows e o disco.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
