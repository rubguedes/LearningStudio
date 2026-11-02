import { useEffect, useState } from "react";
import { command, normalizeError } from "../services/tauri";
import type { AuthStatus } from "../domain/types";
export function SecurityPage({
  busy,
  run,
}: {
  busy: boolean;
  run: (fn: () => Promise<void>, message: string) => Promise<boolean>;
}) {
  const [status, setStatus] = useState<AuthStatus | null>(null),
    [error, setError] = useState(""),
    [password, setPassword] = useState(""),
    [consent, setConsent] = useState(false),
    [code, setCode] = useState("");
  useEffect(() => {
    let active = true;
    void command<AuthStatus>("auth_status")
      .then((value) => {
        if (active) setStatus(value);
      })
      .catch((e: unknown) => {
        if (active) setError(normalizeError(e).message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="library-page">
      <section className="panel">
        <h2>Proteção dos seus dados</h2>
        <p role={error ? "alert" : "status"}>
          {error ||
            (!status
              ? "Conferindo a proteção local…"
              : status.encrypted
                ? "Banco criptografado com SQLCipher. A chave está protegida pelo cofre desta conta do Windows."
                : "A criptografia do arquivo não foi confirmada pelo núcleo.")}
        </p>
        <p>
          A senha controla o acesso ao aplicativo. A criptografia do arquivo
          depende também do cofre do Windows. Para trocar de computador ou
          recuperar dados se perder esse cofre, mantenha um backup portátil
          protegido por senha, na área Backup local.
        </p>
      </section>
      <section className="panel">
        <h2>Código de recuperação de senha</h2>
        <p>
          {status?.recoveryConfigured
            ? "Há um código configurado. Seu valor não pode ser consultado novamente."
            : "Gere um código enquanto lembra sua senha. Ele permitirá redefini-la sem apagar seus estudos."}
        </p>
        <p>
          O código serve uma única vez e só redefine a senha do aplicativo; ele
          não substitui a chave do banco guardada no Windows. Guarde-o em um
          gerenciador de senhas, separado do computador. Gerar outro invalida o
          anterior.
        </p>
        <form
          className="editor-form"
          onSubmit={(event) => {
            event.preventDefault();
            const submitted = password;
            setPassword("");
            setCode("");
            let generated = "";
            void run(async () => {
              generated = await command<string>("generate_recovery_code", {
                password: submitted,
              });
            }, "Código de recuperação gerado. Guarde-o agora.").then((ok) => {
              if (ok) {
                setCode(generated);
                setConsent(false);
                setStatus((previous) =>
                  previous
                    ? { ...previous, recoveryConfigured: true }
                    : previous,
                );
              }
            });
          }}
        >
          <label>
            Confirme a senha atual
            <input
              type="password"
              required
              maxLength={128}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Entendo que o código anterior será invalidado e vou guardar o novo
            em local seguro.
          </label>
          <button className="button primary" disabled={busy || !consent}>
            Gerar novo código de recuperação
          </button>
        </form>
        {code && (
          <div className="answer-note" role="status">
            <label>
              Código exibido somente agora
              <input
                readOnly
                spellCheck={false}
                autoComplete="off"
                value={code}
                onFocus={(e) => e.target.select()}
                aria-label="Código de recuperação gerado"
              />
            </label>
            <p>
              Não compartilhe este código. Ele não é incluído nos backups nem
              salvo em texto legível.
            </p>
            <button className="button secondary" onClick={() => setCode("")}>
              Já guardei · ocultar código
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
