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
