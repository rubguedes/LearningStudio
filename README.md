# LearningStudio

Aplicativo pessoal de estudos para Windows, com organização offline, trilhas de idiomas e carreira e tutores de IA opcionais.

## Ativar a IA apenas com a chave

1. Instale o aplicativo e desbloqueie seu espaço com a senha local.
2. Abra **IA e consumo** e preencha **Chave para ativação rápida**.
3. Escolha **Guardar chave e ativar OpenAI**. O aplicativo configura o modelo, preços datados e orçamento mensal de US$ 5; esses valores podem ser ajustados no formulário avançado.
4. Use **Verificar conexão e modelo**. Cada geração ou correção ainda exige consentimento para enviar o conteúdo.

> [!IMPORTANT]
> A OpenAI API tem cobrança separada do ChatGPT. A chave fica no cofre do Windows, fora do código e do SQLite. Os preços padrão vencem após 30 dias e precisam de revisão. O limite local não substitui os controles de faturamento do provedor.

Ollama é uma alternativa opcional para quem já possui o serviço e um modelo local instalados. Sem IA, organização, lições pré-instaladas, histórico, vocabulário e revisões continuam disponíveis.

## Recursos implementados

- Senha Argon2id, bloqueio por inatividade, SQLite e migrações transacionais.
- Áreas, tópicos, recursos, tarefas, cronômetro, metas, evidências, relatórios e agenda.
- Perfis de idioma por nível, prazo e disponibilidade; propostas de plano editáveis e aprovadas antes de criar etapas.
- Percursos visuais, lições offline, redações versionadas, vocabulário, reforço de erros e repetição espaçada.
- PDF A4 para anotação, importação e preservação de versões; correção da transcrição confirmada pelo estudante.
- Conteúdo de carreira com fontes declaradas, currículo versionado e vagas com comparação transparente de competências.
- Consulta autorizada de commits e CI de repositórios públicos GitHub, sem publicar nem executar workflows pelo aplicativo.
- OpenAI Responses e Ollama com contratos tipados, consentimento, reservas de custo e orçamento mensal.
- Google Calendar/Gmail com OAuth e filas locais; importação manual de tarefas do ChatGPT; backup validado sem segredos.

## Limites atuais

PDFs anotados têm limite de 512 KiB por arquivo. OCR manuscrito e compatibilidade específica com Samsung Notes/S Pen ainda não estão validados. A correção usa a transcrição confirmada e preserva o PDF original. A exportação atual suporta alfabeto latino.

Vagas e fontes são cadastradas manualmente; sua disponibilidade não é afirmada pelo aplicativo. A comparação é uma heurística, não probabilidade de contratação. Currículos importam texto `.txt`; sugestões da IA não substituem versões sem aprovação. Revisões periódicas geram lembretes enquanto o aplicativo está aberto; não há coleta automática de vagas.

Código do estudante não é executado sem sandbox comprovada. Análise estática/IA é distinta de testes determinísticos. OpenAI, Ollama e Google foram testados com contratos e mocks; o aceite com contas reais depende da configuração do usuário. A consulta GitHub do aplicativo é somente pública e de leitura.

## Desenvolvimento e instalador

Execute em PowerShell, na raiz do repositório. Pré-requisitos: Node.js 22, Rust compatível com `src-tauri/Cargo.toml`, Microsoft C++ Build Tools e Windows SDK. O aplicativo não exige Docker nem backend HTTP local.

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:native
npm run lint:native
npm run check:native-format
python scripts/test_schema.py
npx playwright install chromium
npm run test:e2e
npm run package:windows
```

O instalador NSIS é gerado em `src-tauri/target/release/bundle/nsis/`. O [workflow Windows](.github/workflows/windows.yml) executa as verificações e disponibiliza o instalador como artefato quando termina com sucesso. O pacote local não possui assinatura Authenticode.

Consulte a [especificação e resultados de validação](PROMPT.md) e as [regras de desenvolvimento](AGENTS.md).
