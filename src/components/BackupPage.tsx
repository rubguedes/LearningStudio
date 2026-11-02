import { useState } from "react";
import { command } from "../services/tauri";
import { passwordError } from "../domain/rules";
import { Dialog } from "./Dialog";
export function BackupPage({
  busy,
  run,
}: {
  busy: boolean;
  run(fn: () => Promise<void>, message: string): Promise<boolean>;
}) {
  const [confirm, setConfirm] = useState(false),
    [result, setResult] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [importPassword, setImportPassword] = useState(""),
    [legacy, setLegacy] = useState(false),
    [error, setError] = useState("");
  async function perform(
    name: "export_backup" | "import_backup",
    submitted: string,
  ) {
    let message = "";
    const ok = await run(async () => {
      message = await command<string>(name, {
        password: submitted,
        allowLegacy: legacy,
      });
    }, "Operação de backup concluída.");
    if (ok) {
      setResult(message);
      setConfirm(false);
      setLegacy(false);
    }
  }
  return (
    <div className="library-page">
      <section className="panel">
        <h2>Backup portátil protegido por senha</h2>
        <p>
          Estudos, tarefas, trilhas, lições, redações, vocabulário, agenda,
          desafios e revisões são exportados com criptografia AES-256-GCM. O
          arquivo .lsbackup pode ser aberto em outra instalação do
          LearningStudio com a senha escolhida aqui, sem depender do cofre deste
          computador.
        </p>
        <p>
          Senha do aplicativo, código de recuperação, chaves de API, tokens e
          filas de envio não são exportados. Guarde a senha do backup em um
          gerenciador separado: não há recuperação dessa senha.
        </p>
        <form
          className="editor-form"
          onSubmit={(event) => {
            event.preventDefault();
            const issue = passwordError(password, confirmation);
            if (issue) {
              setError(issue);
              return;
            }
            const submitted = password;
            setPassword("");
            setConfirmation("");
            setError("");
            void perform("export_backup", submitted);
          }}
        >
          <label>
            Senha do novo backup
            <input
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Confirmar senha do backup
            <input
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="button primary" disabled={busy}>
            Exportar backup protegido
          </button>
        </form>
        <p className="helper">
          Escolha um nome novo. Arquivos existentes não são sobrescritos.
          Backups JSON exportados em versões anteriores continuam sem
          criptografia.
        </p>
      </section>
      <section className="panel">
        <h2>Mesclar um backup</h2>
        <p>
          Novos registros são adicionados em uma transação após autenticação e
          validação. Registros já existentes e sua senha atual são preservados.
          A importação não envia e-mails, eventos ou solicitações de IA.
        </p>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            setConfirm(true);
            setImportPassword("");
          }}
        >
          Selecionar backup para mesclar
        </button>
      </section>
      {result && (
        <p className="answer-note" role="status">
          {result}
        </p>
      )}
      {confirm && (
        <Dialog
          title="Mesclar dados do backup?"
          busy={busy}
          onClose={() => {
            setConfirm(false);
            setImportPassword("");
          }}
        >
          <p>
            Selecione somente uma cópia do LearningStudio de origem confiável.
          </p>
          <form
            className="editor-form"
            onSubmit={(event) => {
              event.preventDefault();
              const submitted = importPassword;
              setImportPassword("");
              void perform("import_backup", submitted);
            }}
          >
            <label>
              Senha do backup
              <input
                type="password"
                required={!legacy}
                minLength={12}
                maxLength={128}
                autoComplete="off"
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={legacy}
                onChange={(e) => setLegacy(e.target.checked)}
              />
              Permitir importar JSON legado sem criptografia. Entendo que esse
              arquivo antigo é legível.
            </label>
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  setConfirm(false);
                  setImportPassword("");
                }}
              >
                Cancelar
              </button>
              <button className="button primary" disabled={busy}>
                Escolher arquivo e mesclar
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
