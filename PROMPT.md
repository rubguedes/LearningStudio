# LearningStudio — Prompt de implementação para Codex

## Missão
Implemente do zero o **LearningStudio**, um aplicativo **desktop exclusivo para Windows**, de uso pessoal, que centraliza estudos, trilhas de carreira em IA, inglês, metas, lições, tarefas e lembretes. Execute a implementação autonomamente, em etapas pequenas e verificáveis, até produzir um instalador `.exe` utilizável. Consulte `AGENTS.md` antes de cada etapa.

## Resultado obrigatório
- Aplicativo desktop real, sem aba de navegador e sem necessidade de iniciar Docker, servidor ou banco manualmente.
- Instalador Windows `.exe`, processo de build documentado e testes executados. Se o ambiente não for Windows ou não tiver toolchain de empacotamento, não declare que o instalador foi produzido: deixe o pipeline pronto e indique como gerá-lo em Windows.
- Interface moderna, minimalista, clara por padrão, responsiva ao redimensionamento, com navegação lateral e visão geral compacta.
- Dados persistentes em SQLite local; estudos essenciais disponíveis offline.
- Senha local antes de acessar dados; configuração inicial no primeiro uso.
- Google Calendar e envio de lembretes por Gmail, com autorização explícita do usuário.
- Integração de IA opcional e configurável, sem impedir uso sem chave de API.

## Stack escolhida
- Tauri 2 + React + TypeScript + Vite para aplicativo e interface.
- Rust para comandos nativos, persistência e integrações sensíveis; SQLite com migrações versionadas.
- UI com componentes acessíveis e estilos consistentes; escolha biblioteca pequena e estável, evitando dependências supérfluas.
- Segredos protegidos pelo armazenamento seguro do Windows, nunca no SQLite em texto puro.
- Testes unitários para regras de domínio, testes de componentes e testes de integração nos fluxos críticos.

## Experiência do usuário
### Painel inicial
Mostrar resumo de hoje, próxima sessão, tarefas vencidas, sequência de estudo (streak), tempo estudado na semana, metas ativas e progresso por trilha. Atalhos para iniciar sessão, criar tarefa e abrir lição de inglês. Evitar excesso de gráficos ou telas fragmentadas.

### Organização de estudos
- Áreas de estudo, matérias, tópicos, recursos (links e notas), sessões cronometradas e histórico.
- Tarefas com prioridade, status, estimativa de duração, prazo, recorrência e vínculo com trilha/checkpoint.
- Agenda interna semanal/mensal, com tarefas e sessões; funciona offline.
- Pesquisa, filtros, edição, arquivamento e exclusão com confirmação.

### Metas e progresso
- Metas com prazo, unidade de medida e alvo mensurável; progresso manual ou calculado a partir de atividades.
- Checkpoints com critérios explícitos de conclusão e evidências (notas, links ou projetos).
- Relatórios de estudo semanais: horas, tarefas concluídas, metas e consistência. Não inventar progresso a partir de mera abertura de páginas.

### Roadmap inicial de carreira em IA
Criar trilha editável e não prescritiva, com etapas e checkpoints:
1. Fundamentos de Python, Git, SQL, APIs e testes.
2. Engenharia de software: FastAPI, arquitetura, autenticação, Docker, CI e observabilidade.
3. Fundamentos de dados e ML: estatística, NumPy/Pandas, scikit-learn, avaliação de modelos.
4. IA aplicada: LLMs, embeddings, RAG, agentes, avaliação, segurança e custo.
5. Engenharia de produção: deploy, monitoramento, versionamento, privacidade e otimização.
6. Portfólio e empregabilidade: projetos demonstráveis, documentação, entrevistas e inglês técnico.
7. Evolução para arquitetura de soluções de IA: requisitos, trade-offs, integrações, escalabilidade, governança e desenho de sistemas.
Cada checkpoint deve ter descrição, atividade prática, critérios de aceite e opção de marcar como concluído com evidência. O usuário pode reorganizar, remover ou acrescentar itens.

### Roadmap inicial de inglês
Trilha editável de **B1/B2 rumo a C1**, sem afirmar que o nível foi medido. Checkpoints de leitura, escrita, vocabulário, gramática, listening e speaking. Permitir registrar dificuldades recorrentes e revisões espaçadas.

### Lições de inglês
Criar um gerador de lições com estrutura consistente, inclusive offline por meio de lições pré-instaladas:
1. Tema e objetivos, nível estimado B1–B2 e tempo previsto.
2. Texto original de leitura de extensão moderada.
3. Perguntas de compreensão.
4. Proposta de redação ou resposta argumentativa.
5. Área para o usuário escrever e salvar rascunho/resposta.
6. Correção e feedback: erros gramaticais, vocabulário, naturalidade, versão revisada, explicação concisa e um desafio de continuação.
7. Vocabulário útil com exemplos e opção de salvar para revisão.
8. Histórico e evolução por habilidade.
Sem IA: apresentar gabaritos/comentários pré-definidos quando houver, e permitir autocorreção e registro manual. Com IA: solicitar feedback estruturado, tratar a resposta como conteúdo não confiável, evitar inventar correções e preservar a versão original. Não copiar automaticamente conteúdo de tarefas do ChatGPT.
Adicionar modelo recorrente de prática de escrita às segundas, quartas e sextas, às 15h, **desativado até o usuário confirmar o agendamento**. Permitir personalizar dias, horários e fuso.

### Lembretes e Google
- Google Calendar: conectar conta via OAuth 2.0 com fluxo seguro para aplicativo instalado, escopos mínimos, criar/atualizar/remover **somente eventos criados pelo LearningStudio** e guardar IDs para evitar duplicação. Nunca alterar outros eventos sem autorização específica.
- Gmail: permitir lembretes por e-mail para o próprio endereço autorizado. Preferir API oficial e escopo mínimo. Exibir prévia, exigir ativação explícita e oferecer teste de envio. Implementar fila local com tentativas controladas, idempotência e log de falhas.
- Sem conexão: manter tarefas e lembretes pendentes localmente e sincronizar quando possível. Informar claramente que envios e sincronizações não ocorrem offline.
- Agendamentos automáticos dependem de o aplicativo estar aberto, salvo se for implementado um agendador nativo do Windows com consentimento e documentação. Não prometer envio em segundo plano quando o computador estiver desligado.
- Não solicitar senha do Google; usar navegador do sistema para consentimento.

### Tarefas agendadas no ChatGPT
**Não presumir API pública disponível para listar ou sincronizar tarefas do ChatGPT.**
- Criar uma área “Tarefas do ChatGPT” para cadastrar/importar manualmente título, instruções, recorrência, horário, links e observações, com marcação explícita de origem e data de última atualização.
- Aceitar colagem de texto e importação de JSON/CSV em formato documentado e validado; nunca afirmar sincronização automática inexistente.
- Permitir converter tarefas importadas em tarefas ou sessões locais, mantendo referência à origem e evitando duplicatas.
- Definir interface `ScheduledTaskProvider` para uma integração oficial futura, desativada até existir API pública documentada e credenciais autorizadas.
- Não usar scraping, cookies de sessão, endpoints privados ou automação não autorizada para extrair tarefas do ChatGPT.

### Tutores inteligentes de inglês e programação
- Implementar dois tutores separados, com histórico, rubricas, revisão e dificuldade adaptativa; IA opcional via API remota ou Ollama local, com modo offline sem modelo (exercícios pré-carregados e avaliação limitada por gabaritos/testes).
- **Inglês:** gerar lições originais com tema, nível CEFR estimado, objetivos, texto de leitura, questões de compreensão, proposta de redação, vocabulário contextualizado e desafio de continuação. Corrigir respostas com trechos originais, sugestões, explicações concisas em português, erros de gramática, naturalidade, vocabulário e coerência; destacar alternativas válidas, evitar marcar variações corretas como erro e não apresentar nível CEFR como certificação. Salvar versões originais e corrigidas, tentativas, erros recorrentes e itens para revisão espaçada. Permitir gerar nova lição com base nas dificuldades anteriores.
- **Programação:** oferecer trilhas de Python (principal) e TypeScript (secundária), do básico até algoritmos, testes, APIs, automação, integração com modelos, agentes e sistemas de IA. Gerar enunciado, exemplos de entrada/saída, restrições, dicas graduais, testes visíveis e ocultos, critérios de aceite e solução de referência guardada fora da resposta inicial. Editor de código com destaque de sintaxe, salvar rascunhos e múltiplas submissões.
- **Avaliação de código:** executar testes determinísticos em ambiente de execução isolado e restrito, com limites de CPU, memória, tempo, sistema de arquivos e rede, sem acesso a segredos ou dados pessoais. Nunca executar código arbitrário diretamente no processo Tauri ou com permissões do usuário. Se isolamento confiável não estiver disponível, desabilitar execução automática e oferecer revisão estática/por IA com aviso explícito; não declarar testes executados. IA complementa testes com feedback sobre correção, legibilidade, complexidade, segurança, testes e idiomatismo, apontando evidências concretas, sem inventar resultados. Separar falhas funcionais de recomendações estilísticas.
- Gerar recomendações de revisão e desafios seguintes conforme resultados comprovados; oferecer ajuste manual de dificuldade e opção de refazer exercício. Evitar avaliação por simples contagem de caracteres ou por resposta textual exata.
- Saídas de IA devem usar esquemas tipados validados, com fallback para respostas inválidas, limites de tamanho, tentativas controladas e indicação de incerteza. Proteger contra prompt injection contida em textos e códigos submetidos.

### IA opcional
- Configuração de provedores: OpenAI API (chave própria e cobrança separada do ChatGPT Plus) e Ollama local (sem cobrança por token de API, sujeito a hardware e instalação local). Abstrair ambos em interface tipada; selecionar provedor/modelo por tarefa e permitir desativar IA.
- Utilizar IA para gerar/corrigir lições de inglês, gerar desafios de Python/TypeScript, revisar soluções e sugerir revisões e checkpoints. Não exigir IA para tarefas básicas de organização.
- Exibir consumo de tokens de entrada/saída e custos estimados por tarefa, dia e mês quando o provedor retornar uso e houver tabela de preços configurada e atualizada pelo usuário. Nunca fixar preços de modelos como verdade permanente. Configurar teto mensal em moeda do provedor, aviso por limiar, confirmação antes de chamadas potencialmente caras e bloqueio de novas chamadas remotas ao atingir o teto; considerar estimativas imperfeitas e custos de chamadas em andamento. Ollama não possui cobrança por token de API, mas usa recursos locais.
- Sem chave, todo o restante do app continua funcional.

### Segurança e privacidade
- Primeira execução: definir senha local; armazenar apenas hash forte com salt (Argon2id ou equivalente comprovado), nunca senha em texto puro.
- Proteger tokens OAuth e chaves de API no cofre do Windows; bloquear acesso à interface antes de autenticação.
- Evitar logs com dados sensíveis, validar entradas, proteger comandos Tauri e limitar permissões nativas.
- Oferecer exportação e importação de backup local, com confirmação, validação e proteção adequada dos segredos (não exportá-los em claro).
- Dados pessoais ficam locais, exceto o que for enviado intencionalmente ao Google ou provedor de IA.

## Modelo de dados mínimo
Entidades para `StudyArea`, `Topic`, `Resource`, `StudySession`, `Task`, `Recurrence`, `Goal`, `Roadmap`, `Checkpoint`, `CheckpointEvidence`, `EnglishLesson`, `EnglishSubmission`, `VocabularyItem`, `CodingChallenge`, `CodeSubmission`, `CodeTestCase`, `EvaluationResult`, `LearningReview`, `AIUsageRecord`, `Reminder`, `SyncRecord`, `ImportedChatGPTTask`, `AppSettings` e migrações. Use IDs estáveis, timestamps e integridade referencial. Não criar tabelas inúteis.

## Ordem de execução (EPICs)
**EPIC 1 — Base funcional:** bootstrap Tauri/React/SQLite, migrações, onboarding/senha, layout, CRUD de áreas/tarefas, testes e execução local.

**EPIC 2 — Estudos e progresso:** sessões, metas, checkpoints, dashboard e relatórios básicos.

**EPIC 3 — Roadmaps e inglês:** trilhas iniciais editáveis, lições offline, redações, vocabulário e histórico.

**EPIC 4 — Agenda e ChatGPT:** calendário interno, recorrência, importação manual de tarefas agendadas e mapeamento para tarefas locais.

**EPIC 5 — Integrações:** OAuth Google, Calendar, Gmail, filas e reconciliação offline/online. Solicitar somente credenciais ou consentimentos que realmente dependam do usuário; implementar o restante com mocks testáveis.

**EPIC 6 — Tutores e entrega:** provedores OpenAI/Ollama, geração e correção de inglês, desafios Python/TypeScript, avaliação estática e testes de código somente com isolamento comprovado, revisão adaptativa, controle de tokens/custos, polimento UX, testes end-to-end, backup e empacotamento Windows. Implementar por fatias verificáveis, sem comprometer a entrega do aplicativo base.

## Forma de trabalho do Codex
1. Inspecione o repositório e leia `AGENTS.md`.
2. Faça um plano curto do EPIC atual, implemente e execute testes.
3. Corrija erros encontrados antes de avançar.
4. Registre em resposta breve o que foi implementado, testes rodados, bloqueios reais e próximo EPIC.
5. Prossiga autonomamente entre EPICs enquanto o ambiente permitir. Não solicite aprovação para escolhas triviais.
6. Nunca simule integrações como se fossem reais. Se faltarem credenciais, entregue fluxo de configuração, mocks de teste e instruções precisas.
7. Não declare conclusão sem validar os critérios de aceite.

## Critérios de aceite finais
- Instala e abre no Windows por ícone; não exige Docker ou inicialização manual de serviços.
- Bloqueia dados até autenticação; persistência após fechar e reabrir.
- Usuário cria tarefas, registra estudo, acompanha metas e conclui checkpoints.
- Lições de inglês funcionam sem IA; IA configurada gera e corrige lições com feedback estruturado e histórico de evolução.
- Desafios Python/TypeScript podem ser criados, respondidos e revisados; testes automatizados somente em sandbox validado, com execução desabilitada de modo seguro quando indisponível.
- API remota e Ollama são opcionais, consumo/custo estimado é visível quando disponível, e limite mensal impede novas chamadas remotas após ser atingido.
- Importação manual de tarefas ChatGPT funciona, com origem identificada.
- Google Calendar e Gmail operam com consentimento e conta conectada; offline não causa perda de dados ou duplicatas.
- Fluxos críticos cobertos por testes, sem erros de build conhecidos.
- Instalador `.exe` gerado e verificado em Windows, ou limitação de ambiente explicitamente documentada sem fingir entrega.

Comece imediatamente pelo EPIC 1 e avance na sequência, seguindo as regras de `AGENTS.md`.

---

## Execução e estado da implementação — 19/10/2026

Pasta principal: `C:\Dev\projetos\LearningStudio`. As 43 fontes/configurações iniciais foram copiadas e conferidas por SHA-256. A pasta anterior no OneDrive foi preservada como segurança, com aviso de redirecionamento em AGENTS.md. Git foi inicializado na nova pasta, sem remoto ou commits publicados.

### EPICs implementados e verificados

- EPIC 1: aplicativo Tauri 2/React/TypeScript, SQLite transacional, senha Argon2id com salt, limite de tentativas, bloqueio por inatividade, áreas e tarefas. Os comandos Rust exigem autenticação. Respostas anteriores ao bloqueio são descartadas pela interface.
- EPIC 2: sessões manuais e cronômetro nativo, metas manuais/automáticas, checkpoints com evidências, dashboard, sequência de estudo e relatório semanal. O cronômetro pausa após interrupções longas/reabertura; abrir telas não gera estudo.
- EPIC 3: duas trilhas editáveis com 13 etapas, duas lições originais offline, compreensão com gabarito, rascunhos e múltiplas tentativas, autocorreção separada do original, vocabulário e revisões espaçadas. B1/B2 é referência estimada, sem certificação. A redação offline não recebe nota automática.
- EPIC 4: agenda semanal/mensal, recorrência com dias/horário/fuso IANA e datas de início/fim, modelo de escrita seg/qua/sex 15h desativado, criação idempotente de tarefas por período, cadastro/importação manual JSON/CSV do ChatGPT com prévia e conversão sem duplicatas. Excluir tarefa não faz a mesma ocorrência reaparecer. Mudanças no modelo preservam tarefas existentes.
- EPIC 5: OAuth desktop com PKCE/state e navegador padrão, consentimento por recurso, tokens no cofre do Windows, calendário exclusivo do aplicativo, marcação e IDs estáveis de eventos, proteção por ETag, envio de e-mail somente para a conta autorizada, prévia, fila persistente com espera/retenção offline e estados visíveis. Envio de Gmail incerto não é repetido automaticamente. Nenhuma conta real conectada nem evento/e-mail real enviado; testes usam mocks. Aceite com serviços reais permanece pendente de credenciais/consentimento do usuário.
- EPIC 6: adaptadores OpenAI Responses e Ollama local, geração de lições/desafios e revisão estruturada com consentimento, quatro desafios offline Python/TypeScript, criação manual, editor com realce, múltiplas tentativas, referência liberada após entrega, leitura estática limitada e autorrevisão. Código submetido nunca é executado: a execução fica desabilitada sem sandbox comprovada. Consumo informado/reservas, preços definidos pelo usuário e orçamento mensal; recomendações de revisão a partir de autocorreções e compreensão comprovada. Backup validado com mesclagem transacional, sem apagar registros existentes ou exportar segredos/fila de envios. Tópicos, recursos, notas e vínculo de tarefas com checkpoints também implementados. Builds de desenvolvimento/produção e testes aprovados; instalador NSIS gerado, instalado e abertura da versão instalada conferida neste Windows. Uso de provedores reais permanece sem validação, por falta de configuração/credenciais.

Arquivos principais por EPIC: 1 — `src-tauri/src/store.rs`, `models.rs`, `validation.rs`, `App.tsx`, `Editors.tsx`, `Workspace.tsx` e migração 001; 2 — `store/progress.rs`, `ProgressPage.tsx`, `ProgressEditors.tsx`, `domain/progress.ts` e migração 002; 3 — `store/library.rs`, `LibraryPage.tsx`, `content/english.json` e migração 003; 4 — `store/agenda.rs`, `AgendaPage.tsx`, `domain/agenda.ts` e migração 004; 5 — `store/google.rs`, `vault.rs`, `network.rs`, `GooglePage.tsx` e migração 005; 6 — `ai.rs`, `store/tutors.rs`, `store/backup.rs`, `store/organizer.rs`, `content/coding.json`, `TutorPage.tsx`, `TutorSettings.tsx`, `CodeEditor.tsx`, `BackupPage.tsx`, `ResourcesPage.tsx` e migração 006. Cada área possui contratos em `src/domain`, serviços IPC e testes pertinentes. Build/permissões em `src-tauri/build.rs`, `capabilities/main.json`, `tauri.conf.json`, `scripts/native.cjs` e workflow Windows.

### Ambiente Windows e execução

Com autorização do usuário, foram instalados Microsoft Visual Studio Build Tools 2022 17.14.42, MSVC 14.44 e Windows SDK 10.0.26100.0. Rust 1.99.1, Cargo, Clippy e rustfmt estão em `.tools/cargo` e `.tools/rustup`, sem alterar PATH global. WebView2 estava disponível. `scripts/native.cjs` carrega as ferramentas locais e o ambiente C++ apenas nos processos de compilação.

Para outro computador de desenvolvimento, usar Node compatível com o lockfile (22.13 ou superior), Rust 1.99 ou superior para `x86_64-pc-windows-msvc`, ferramentas C++ e SDK. As ferramentas de desenvolvimento não são requisitos do usuário final.

```powershell
npm ci
npm run check:windows
npm run desktop
```

O servidor Vite é usado somente no desenvolvimento. O aplicativo compilado embute interface e SQLite, sem Docker ou backend HTTP de uso permanente.

### Verificações executadas

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run check:native-format
npm run test:native
npm run lint:native
python scripts/test_schema.py
npm run test:e2e
npm run tauri -- build --debug --no-bundle
```

Resultados da rodada final: formatação, lint, tipos e Clippy aprovados; 56 testes Vitest em nove arquivos e 51 testes Rust aprovados; build de produção da interface aprovado; oito testes Playwright aprovados após as correções; executáveis Windows de desenvolvimento e produção gerados. A janela Tauri de desenvolvimento foi aberta e a tela de criação de senha foi inspecionada no Windows. Após instalar o pacote final, a versão instalada abriu na tela de bloqueio e reconheceu a senha já configurada pelo usuário. A senha pessoal não foi definida ou digitada pelo agente. CRUD, senha incorreta/bloqueio e persistência após reabrir são cobertos pelos testes do armazenamento Rust; os fluxos visuais completos usam IPC explicitamente simulado no Chromium e não equivalem a teste de todo o fluxo na janela nativa. O teste de migração atualiza um banco do EPIC 2 para o esquema 6, preservando hash e tarefa. O teste do cofre Windows criou, leu e removeu uma entrada temporária isolada.

| Encerramento da etapa | Vitest | Rust | Playwright com IPC simulado |
| --- | ---: | ---: | ---: |
| EPIC 2 | 44 | 16 | 3 |
| EPIC 3 | 48 | 23 | 4 |
| EPIC 4 | 51 | 30 | 5 |
| EPIC 5 | 53 | 36 | 6 |
| EPIC 6, rodada atual | 56 | 51 | 8 |

As 24 verificações Python/SQLite dos EPICs 1–2 passaram novamente na rodada final. A integração das migrações 003–006 e persistência é testada na suíte Rust atual. Não houve execução remota de CI. Playwright usa `vite preview` e requer build anterior. Neste computador foi usado o Chromium já disponível por `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

### Dados e limitações

O banco normalmente fica em `%LOCALAPPDATA%\com.learningstudio.desktop\learningstudio.db`. A senha protege o acesso pelo aplicativo; o banco ainda não é criptografado. Não há recuperação de senha. Redações e instruções importadas permanecem locais. Conteúdo externo é exibido como texto, sem executar scripts ou código. Não há notificações/envios com o aplicativo fechado.

O CSV aceita cabeçalho exato `externalId,title,instructions,schedule,url,notes`; JSON aceita uma lista de objetos com esses seis campos. Até 200 registros/256 KiB, IDs únicos no lote, links HTTPS opcionais. Mesma externalId atualiza a importação preservando vínculo local. Horário/recorrência importados são referência textual; configurar/ativar recorrência é uma escolha separada na agenda.

### Configurar serviços opcionais

Em **Integrações Google**, cadastrar um cliente OAuth do tipo Aplicativo para computador, habilitando Calendar API/Gmail API e a conta de teste no projeto pessoal quando necessário. Informar client_id/client_secret somente no aplicativo; não enviar pelo chat. Selecionar explicitamente Calendar e/ou Gmail e concluir o consentimento no navegador padrão. São usados `openid email`, `calendar.app.created` e/ou `gmail.send`. O retorno OAuth abre temporariamente uma porta de loopback por até cinco minutos e encerra ao concluir/cancelar; não é um backend de uso do aplicativo. Tokens ficam no cofre Windows. O calendário é separado; eventos precisam de ID/marcadores do aplicativo e ETag compatível para alteração. Criação de calendário sem confirmação exige recuperar o vínculo na tela, sem criar duplicatas automaticamente. Conflitos preservam a versão remota e são exibidos como falha para revisão. O processamento automático da fila é opcional, somente enquanto a tela estiver aberta/desbloqueada. Não há envio com o aplicativo fechado.

Em **IA e consumo**, a configuração inicial é desativada. Escolher provedor/modelo; para OpenAI, guardar uma chave própria no cofre Windows, informar os preços do modelo, a moeda e o limite mensal. Não há preços/modelos fixados como verdade permanente. Preços para uso remoto precisam de revisão nos últimos 30 dias. A reserva considera dados, instruções, esquema e limite de saída; ela é estimativa conservadora, não limite de faturamento do provedor. Chamadas ambíguas mantêm a reserva, inclusive após reabrir; não há repetição automática. O limite inclui essas reservas e chamadas já em andamento são serializadas pelo núcleo. Moeda não pode mudar durante um mês com consumo remoto registrado.

Ollama usa somente `http://127.0.0.1:11434/api/chat`, com modelo local escolhido pelo usuário, sem variante cloud e sem redirecionamentos/proxy. O aplicativo não instala o serviço nem modelos e continua funcionando sem ele. Geração e feedback validam esquemas e limites; trechos citados no feedback precisam existir no original. O feedback de IA é sugestão, não prova de execução/correção. Nenhuma chamada real OpenAI/Ollama foi feita nesta implementação. Contratos consultados: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), [Ollama Structured Outputs](https://docs.ollama.com/capabilities/structured-outputs), [OAuth Google para desktop](https://developers.google.com/identity/protocols/oauth2/native-app).

Backup local: formato JSON LearningStudio v1/esquema 6, até 20 MiB. Antes da mesclagem, o arquivo é validado em SQLite temporário em memória e seus vínculos são conferidos. A gravação de dados novos ocorre em uma transação; IDs já existentes são preservados. Senha/hash, configurações de conta, segredos do cofre, filas de envio e vínculos remotos não são exportados. O conteúdo de estudo é legível no arquivo: guardar em local protegido. Importar não executa código nem envia mensagens. Backups desta versão não substituem ou apagam o banco atual.

### Empacotamento

```powershell
npm run package:windows
```

`npm run package:windows` terminou com sucesso e gerou `C:\Dev\projetos\LearningStudio\src-tauri\target\release\bundle\nsis\LearningStudio_0.1.0_x64-setup.exe`, com 3.364.002 bytes (3,21 MiB). SHA-256: `BC06A24F5DCB81F3F966909ACF13940838C00AC325F2C72BB24EFDC19C95A12A`.

O instalador foi executado por usuário, de modo silencioso, em destino previamente vazio: `C:\Users\rubem\AppData\Local\LearningStudio`. Retornou código 0 e instalou `learningstudio.exe` e `uninstall.exe`. Atalhos do menu Iniciar e da área de trabalho foram conferidos e apontam para o executável instalado. A versão instalada foi aberta; a janela nativa exibiu o bloqueio por senha já configurada. O aplicativo ficou aberto para uso do usuário. Não houve automação do diálogo de autenticação nem teste manual completo de CRUD após desbloqueio. Não houve teste em máquina limpa ou conta externa.

Integridade do executável instalado: SHA-256 `323397A8D9ABF26DE4251085C3CB4FDD65269865B9EE87611DD34BDF4C16D008`. A comparação com o executável antes do empacotamento encontrou somente os três bytes esperados da marcação Tauri `__TAURI_BUNDLE_TYPE_VAR_UNK` → `__TAURI_BUNDLE_TYPE_VAR_NSS`; os demais bytes e o tamanho de 10.507.776 bytes são iguais.

O pacote é NSIS x64, por usuário, em português, com ícone próprio e inclusão do bootstrapper WebView2 quando necessário. A assinatura Authenticode foi conferida: **NotSigned**. Nenhum certificado de assinatura foi fornecido. O workflow Windows prepara verificações e publicação do artefato quando houver repositório GitHub, usando os mesmos scripts nativos para carregar o ambiente C++; ele não foi executado remotamente.

Próximo passo de uso: abrir o atalho LearningStudio e desbloquear com a senha existente. Google e IA podem ser configurados posteriormente nas telas próprias, com consentimento. O aceite com serviços reais requer essa configuração; as funções offline e as regras nativas estão verificadas pelos resultados acima.
