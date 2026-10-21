import { useState } from "react";
import { command } from "../services/tauri";
import { Dialog } from "./Dialog";
export function BackupPage({
  busy,
  run,
}: {
  busy: boolean;
  run(fn: () => Promise<void>, message: string): Promise<boolean>;
}) {
  const [confirm, setConfirm] = useState(false),
    [result, setResult] = useState("");
  async function perform(name: "export_backup" | "import_backup") {
    let message = "";
    const ok = await run(async () => {
      message = await command<string>(name);
    }, "Operação de backup concluída.");
    if (ok) {
      setResult(message);
      setConfirm(false);
    }
  }
  return (
    <div className="library-page">
      <section className="panel">
        <h2>Seus estudos, em uma cópia local</h2>
        <p>
          O backup inclui estudos, tarefas, trilhas, lições, redações,
          vocabulário, agenda, desafios, revisões e registros de consumo. O
          arquivo é JSON legível; guarde-o em local protegido.
        </p>
        <p>
          A senha do aplicativo, seu hash, chaves de API, tokens Google, filas
          de envio e vínculos remotos não são exportados. O conteúdo escrito por
          você continua dentro do arquivo; confira informações pessoais antes de
          compartilhá-lo.
        </p>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void perform("export_backup")}
        >
          Exportar backup local
        </button>
        <p className="helper">
          Escolha um nome novo. Um arquivo existente não será sobrescrito pelo
          aplicativo.
        </p>
      </section>
      <section className="panel">
        <h2>Mesclar um backup</h2>
        <p>
          Registros ausentes serão adicionados em uma transação. Registros
          existentes com a mesma identificação são preservados. A importação não
          apaga seu banco atual nem altera sua senha.
        </p>
        <p>
          O aplicativo valida o formato, os dados estruturados, as restrições do
          banco e os vínculos antes de gravar. Sessões em andamento voltam
          pausadas. A importação não dispara e-mails, eventos ou chamadas de IA.
        </p>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => setConfirm(true)}
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
          onClose={() => setConfirm(false)}
        >
          <p>
            Selecione somente uma cópia do LearningStudio de origem confiável.
            Os registros existentes serão preservados; novos dados serão
            adicionados após validação.
          </p>
          <div className="dialog-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Cancelar
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void perform("import_backup")}
            >
              Escolher arquivo e mesclar
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
