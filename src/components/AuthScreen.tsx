import { useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, LockKeyhole, ShieldCheck } from "lucide-react";
import { passwordError } from "../domain/rules";
import { WindowControls } from "./WindowControls";

interface Props {
  configured: boolean;
  busy: boolean;
  error: string;
  onSubmit(password: string): Promise<void>;
  onRecover?(code: string, password: string): Promise<boolean>;
}

export function AuthScreen({
  configured,
  busy,
  error,
  onSubmit,
  onRecover,
}: Props) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [localError, setLocalError] = useState("");
  const [recovering, setRecovering] = useState(false),
    [code, setCode] = useState(""),
    [notice, setNotice] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const issue = recovering
      ? passwordError(password, confirmation)
      : configured
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
    if (recovering && onRecover) {
      const submitted = code;
      setCode("");
      if (await onRecover(submitted, value)) {
        setRecovering(false);
        setNotice(
          "Senha redefinida. Entre com a nova senha e gere outro código em Segurança.",
        );
      }
    } else await onSubmit(value);
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
        <WindowControls />
        <div className="auth-form">
          <span className="round-icon">
            <LockKeyhole size={24} />
          </span>
          <span className="eyebrow">
            {configured ? "BOM TER VOCÊ DE VOLTA" : "VAMOS COMEÇAR"}
          </span>
          <h2>
            {recovering
              ? "Recuperar acesso"
              : configured
                ? "Seu espaço está protegido"
                : "Crie sua senha local"}
          </h2>
          <p>
            {recovering
              ? "Use o código gerado anteriormente em Segurança. Sem ele, não há redefinição automática. O cofre da conta Windows também precisa estar disponível."
              : configured
                ? "Digite sua senha para continuar seus estudos."
                : "Escolha uma frase longa e fácil de lembrar. Ela será pedida ao abrir o aplicativo."}
          </p>
          <form
            onSubmit={(event) => {
              void submit(event);
            }}
          >
            {recovering && (
              <>
                <label htmlFor="recovery-code">Código de recuperação</label>
                <input
                  id="recovery-code"
                  type="password"
                  autoComplete="off"
                  required
                  maxLength={200}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={busy}
                />
              </>
            )}
            <label htmlFor="password">
              {recovering || !configured ? "Nova senha" : "Senha"}
            </label>
            <input
              id="password"
              type="password"
              autoComplete={
                configured && !recovering ? "current-password" : "new-password"
              }
              autoFocus
              value={password}
              maxLength={256}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              aria-describedby="auth-help"
              required
            />
            {(!configured || recovering) && (
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
                : recovering
                  ? "Redefinir senha"
                  : configured
                    ? "Desbloquear"
                    : "Criar meu espaço"}
              <ArrowRight size={18} />
            </button>
          </form>
          {configured && onRecover && (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                setRecovering(!recovering);
                setPassword("");
                setConfirmation("");
                setCode("");
                setLocalError("");
                setNotice("");
              }}
            >
              {recovering ? "Voltar para entrar" : "Esqueci minha senha"}
            </button>
          )}
          {notice && <p role="status">{notice}</p>}
          <p id="auth-help" className="fine-print">
            {configured
              ? "Bloqueio automático após 15 minutos de inatividade."
              : "Mínimo de 12 caracteres. Depois de entrar, gere seu código de recuperação em Segurança."}
          </p>
          <div className="privacy-note">
            <ShieldCheck size={17} />
            <span>
              Banco protegido com SQLCipher e chave no cofre do Windows. Guarde
              um backup portátil protegido por senha para recuperar seus dados
              em outro computador.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
