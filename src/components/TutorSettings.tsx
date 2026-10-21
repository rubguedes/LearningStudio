import { useState } from "react";
import type { AISettings, TutorAction, TutorSnapshot } from "../domain/tutors";
import { money, monthlySpend } from "../domain/tutors";
import { dateKey } from "../domain/rules";
export function TutorSettings({
  data,
  busy,
  act,
}: {
  data: TutorSnapshot;
  busy: boolean;
  act: (a: TutorAction) => Promise<boolean>;
}) {
  const [settings, setSettings] = useState<AISettings>({
      ...data.settings,
      pricesUpdatedAt: data.settings.pricesUpdatedAt || dateKey(),
    }),
    [key, setKey] = useState(""),
    [connection, setConnection] = useState("");
  return (
    <>
      <section className="panel">
        <h2>Começar apenas com a chave</h2>
        <p>
          Ative a OpenAI com GPT-5.4 mini, orçamento de US$ 5 por mês e até
          8.192 tokens de saída por chamada. Cada envio de conteúdo ainda exige
          sua confirmação. A cobrança da API é separada do ChatGPT.
        </p>
        <p className="helper">
          Preços padrão de texto verificados em 21/10/2026: US$ 0,75 de entrada
          e US$ 4,50 de saída por milhão de tokens. A configuração vence após 30
          dias e pode ser ajustada abaixo.{" "}
          <a
            href="https://developers.openai.com/api/docs/models/gpt-5.4-mini"
            target="_blank"
            rel="noreferrer"
          >
            Fonte oficial dos preços
          </a>
          .
        </p>
        <form
          className="editor-form"
          onSubmit={(event) => {
            event.preventDefault();
            const submitted = key;
            setKey("");
            setConnection("");
            void act({ kind: "quickSetup", key: submitted });
          }}
        >
          <label>
            Chave para ativação rápida
            <input
              type="password"
              required
              minLength={20}
              maxLength={500}
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
          </label>
          <button className="button primary" disabled={busy}>
            Guardar chave e ativar OpenAI
          </button>
        </form>
        <button
          className="button secondary"
          disabled={busy || data.settings.provider === "disabled"}
          onClick={() => {
            setConnection("");
            void act({ kind: "checkConnection" }).then((ok) => {
              if (ok)
                setConnection(
                  "Conexão e modelo verificados. Nenhum conteúdo de estudo foi enviado; a geração ainda precisa de saldo e permissão no provedor.",
                );
            });
          }}
        >
          Verificar conexão e modelo
        </button>
        {connection && <p role="status">{connection}</p>}
      </section>
      <section className="panel">
        <h2>IA é opcional</h2>
        <p>
          Sem modelo, as lições, tarefas e desafios offline continuam
          funcionando. OpenAI API usa chave e cobrança próprias; a assinatura do
          ChatGPT não é usada para autenticar este aplicativo.
        </p>
        <form
          className="editor-form"
          onSubmit={(e) => {
            e.preventDefault();
            void act({ kind: "saveSettings", settings });
          }}
        >
          <label>
            Provedor
            <select
              value={settings.provider}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  provider: e.target.value as AISettings["provider"],
                })
              }
            >
              <option value="disabled">Desativado · prática offline</option>
              <option value="openai">OpenAI API</option>
              <option value="ollama">Ollama local</option>
            </select>
          </label>
          <label>
            Modelo OpenAI
            <input
              maxLength={160}
              placeholder="ID de um modelo compatível com Responses e JSON Schema"
              value={settings.openaiModel}
              onChange={(e) =>
                setSettings({ ...settings, openaiModel: e.target.value })
              }
            />
          </label>
          <label>
            Modelo instalado no Ollama
            <input
              maxLength={160}
              placeholder="Nome exato do modelo local"
              value={settings.ollamaModel}
              onChange={(e) =>
                setSettings({ ...settings, ollamaModel: e.target.value })
              }
            />
          </label>
          <p className="helper">
            Ollama usa somente 127.0.0.1:11434. Instale e escolha um modelo
            local por sua conta. O modelo e o computador precisam comportar a
            tarefa; o aplicativo não instala modelos nem executa código
            submetido.
          </p>
          <div className="form-grid">
            <label>
              Moeda (ISO)
              <input
                required
                pattern="[A-Z]{3}"
                maxLength={3}
                value={settings.currency}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    currency: e.target.value.toUpperCase(),
                  })
                }
              />
            </label>
            <label>
              Limite mensal remoto
              <input
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                required
                value={settings.monthlyLimitMicros / 1_000_000}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    monthlyLimitMicros: Math.round(
                      Number(e.target.value) * 1_000_000,
                    ),
                  })
                }
              />
            </label>
            <label>
              Preço por milhão de tokens de entrada
              <input
                type="number"
                min="0"
                max="10000"
                step="0.000001"
                required
                value={settings.inputPricePerMillion}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    inputPricePerMillion: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Preço por milhão de tokens de saída
              <input
                type="number"
                min="0"
                max="10000"
                step="0.000001"
                required
                value={settings.outputPricePerMillion}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    outputPricePerMillion: Number(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Data da sua revisão dos preços
              <input
                type="date"
                required
                max={dateKey()}
                value={settings.pricesUpdatedAt}
                onChange={(e) =>
                  setSettings({ ...settings, pricesUpdatedAt: e.target.value })
                }
              />
            </label>
            <label>
              Máximo de tokens de saída
              <input
                type="number"
                min="512"
                max="12000"
                required
                value={settings.maxOutputTokens}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxOutputTokens: Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
          <p className="helper">
            A ativação rápida preenche preços datados; você pode revisá-los
            aqui. Chamadas remotas exigem preços positivos, revisados nos
            últimos 30 dias, e orçamento disponível. A reserva é conservadora,
            mas não substitui os limites de cobrança do provedor. Chamadas sem
            consumo confirmado mantêm a reserva.
          </p>
          <button className="button primary" disabled={busy}>
            Salvar configuração de IA
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>Chave OpenAI no cofre do Windows</h2>
        <p>
          {data.hasKey
            ? "Uma chave está configurada. Seu valor não é exibido."
            : "Nenhuma chave configurada."}
        </p>
        <form
          className="editor-form"
          onSubmit={(e) => {
            e.preventDefault();
            const submitted = key;
            setKey("");
            void act({ kind: "saveKey", key: submitted });
          }}
        >
          <label>
            Nova chave de API
            <input
              type="password"
              minLength={20}
              maxLength={500}
              required
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <div className="inline-actions">
            <button className="button primary" disabled={busy}>
              Guardar chave no Windows
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy || !data.hasKey}
              onClick={() => void act({ kind: "removeKey" })}
            >
              Remover chave local
            </button>
          </div>
        </form>
      </section>
      <UsagePanel data={data} />
    </>
  );
}
export function UsagePanel({ data }: { data: TutorSnapshot }) {
  const spent = monthlySpend(data.usage),
    cap = data.settings.monthlyLimitMicros;
  const month = new Date().toISOString().slice(0, 7),
    today = new Date().toISOString().slice(0, 10),
    todayUsage = data.usage.filter((u) => u.createdAt.startsWith(today));
  return (
    <section className="panel">
      <h2>Consumo e reservas · mês {month} (UTC)</h2>
      <p>
        <strong>{money(spent, data.settings.currency)}</strong> de{" "}
        {money(cap, data.settings.currency)} no orçamento remoto.
      </p>
      {cap > 0 && spent >= cap * 0.8 && (
        <p role="status" className="answer-note">
          O consumo e as reservas atingiram {Math.floor((spent / cap) * 100)}%
          do limite. Novas chamadas são bloqueadas se a reserva não couber.
        </p>
      )}
      <p>
        {todayUsage.length} chamadas registradas hoje ·{" "}
        {data.usage.filter((u) => u.createdAt.startsWith(month)).length} neste
        mês. Tokens ausentes são mostrados como não informados.
      </p>
      {data.usage.length === 0 ? (
        <p>Nenhuma chamada de IA registrada.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data/tarefa</th>
                <th>Modelo</th>
                <th>Entrada/saída</th>
                <th>Custo ou reserva</th>
              </tr>
            </thead>
            <tbody>
              {data.usage.slice(0, 30).map((u) => (
                <tr key={u.id}>
                  <td>
                    {new Date(u.createdAt).toLocaleString("pt-BR")}
                    <br />
                    {u.task}
                  </td>
                  <td>
                    {u.provider} · {u.model}
                  </td>
                  <td>
                    {u.inputTokens ?? "não informado"} /{" "}
                    {u.outputTokens ?? "não informado"}
                  </td>
                  <td>
                    {u.provider === "ollama"
                      ? "Local · sem tarifa de API"
                      : u.costMicros === null
                        ? `${money(u.reservedMicros, u.currency)} reservados`
                        : `${money(u.costMicros, u.currency)} estimados`}
                    <br />
                    {u.state === "invalid"
                      ? "Resposta recusada; consumo registrado"
                      : u.state === "unknown" || u.state === "reserved"
                        ? "Consumo não confirmado"
                        : u.state === "confirmed"
                          ? "Uso informado pelo provedor"
                          : u.state}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="helper">
        Estimativas usam os preços configurados na data da chamada. Não são uma
        fatura. Conteúdo pessoal não é gravado no registro de consumo.
      </p>
    </section>
  );
}
