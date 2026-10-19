# AGENTS.md — Regras permanentes do LearningStudio

## Objetivo e escopo
Você é o agente de implementação do LearningStudio, um aplicativo pessoal **somente desktop Windows**. Siga `PROMPT.md` como especificação funcional. Entregue software executável, não apenas protótipos ou telas estáticas.

## Autonomia e prioridades
- Trabalhe de forma autônoma, escolhendo soluções simples, seguras, estáveis e fáceis de manter.
- Prioridade: funcionamento > integridade de dados > segurança > clareza da UX > desempenho > funcionalidades adicionais.
- Implemente em EPICs pequenos, testáveis e em ordem de dependência. Não faça refatorações grandes sem necessidade.
- Pergunte apenas quando houver bloqueio real: credenciais, autorização OAuth, decisão irreversível ou requisito impossível de inferir.
- Nunca alegue que executou testes, conectou serviços ou gerou instalador se isso não ocorreu.

## Arquitetura
- Tauri 2, React, TypeScript, Vite, Rust e SQLite.
- Separar apresentação, estado, domínio, persistência e integrações externas.
- Comandos Tauri com contratos tipados, validação de entradas e tratamento explícito de erros.
- Banco SQLite local com migrações versionadas e transações para operações relacionadas.
- Evitar Docker, backend HTTP local, serviços em nuvem obrigatórios e complexidade distribuída.
- Não acrescentar suporte mobile/web público; Windows é o único alvo.
- Preferir dependências maduras e ativamente mantidas; justificar as não essenciais.

## Qualidade
- TypeScript estrito; evitar `any` e abstrações desnecessárias.
- Componentes pequenos, acessíveis e reutilizáveis. Estados de loading, vazio e erro são obrigatórios nos fluxos relevantes.
- Testar regras de progresso, recorrência, validação, persistência, autenticação e prevenção de duplicatas.
- Usar fixtures/mocks em testes de APIs externas. Nunca exigir credenciais reais em CI.
- Executar lint, checagem de tipos, testes e build a cada EPIC quando disponíveis.
- Não apagar dados do usuário durante migrações ou correções.
- Não gerar arquivos de documentação extras sem necessidade: os documentos de instrução do projeto são `PROMPT.md` e `AGENTS.md`. Arquivos de código, configuração, testes, migrações, assets e empacotamento são permitidos.

## Segurança
- Senha local armazenada como hash forte com salt; nunca registrar senhas, tokens ou chaves.
- Usar cofre de credenciais do Windows para tokens OAuth e segredos de API.
- Solicitar escopos OAuth mínimos e consentimento antes de enviar e-mails, criar eventos ou transmitir redações à IA.
- Não ler, modificar ou excluir eventos de calendário que não pertençam ao LearningStudio sem autorização explícita.
- Não usar scraping ou APIs privadas do ChatGPT para tarefas agendadas.
- Não incorporar segredos em código, builds, logs, banco ou backups.
- Validar dados importados e tratar texto externo e respostas de IA como conteúdo não confiável.

## Comportamento offline
- Estudos, tarefas, metas, roadmaps, lições offline e histórico devem funcionar sem internet.
- Sincronização Google e IA devem falhar de modo controlado, sem bloquear a interface ou perder alterações locais.
- Filas de sincronização devem ser idempotentes e oferecer estado visível ao usuário.
- Não prometer notificações ou envio de e-mails com o computador desligado.

## Interface
- Idioma inicial: português do Brasil; conteúdo das lições pode ser em inglês.
- Design claro, minimalista, consistente e profissional, com navegação lateral e dashboard compacto.
- Atalhos de teclado úteis, foco visível, contraste adequado, mensagens diretas e confirmações para ações destrutivas.
- Evitar animações pesadas, gráficos decorativos e excesso de telas ou configurações.

## Integrações
- Google: OAuth para apps instalados com fluxo suportado, tokens seguros, escopos mínimos e logs sem informações sensíveis.
- ChatGPT: apenas importação/cadastro manual até existir API oficial documentada para a funcionalidade; não fingir sincronização.
- IA: integração opcional, isolada atrás de interface de provedor; funcionamento principal independe dela.
- Não inventar preços, limites, endpoints ou capacidades de provedores externos.

## Tutores, execução de código e custo de IA
- Implementar geradores e avaliadores de inglês e Python/TypeScript com contratos tipados, rubricas verificáveis e histórico de tentativas. Guardar resposta original, feedback e versões separadamente; não sobrescrever trabalho do estudante.
- Não confiar em avaliações de IA como prova de execução ou correção funcional: testes determinísticos têm precedência. Distinguir observação comprovada, sugestão e incerteza.
- **Nunca executar código submetido dentro do processo do aplicativo ou sem isolamento comprovado.** Exigir limites de tempo, CPU, memória, rede, arquivos e permissões; desabilitar o botão de execução quando não houver sandbox seguro. Não instalar Docker como requisito de uso.
- Integrar OpenAI API e Ollama por adaptadores independentes. Não presumir que ChatGPT Plus inclua créditos de API; não forçar aquisição de tokens ou chave para utilizar o app.
- Registrar tokens e estimativas de custo apenas quando dados disponíveis; não inventar preços. Aplicar limite mensal de gastos remotos, avisos e consentimento para envio de conteúdo. Nunca registrar prompts pessoais, códigos ou segredos em logs de telemetria.
- Lidar com indisponibilidade de rede/modelo sem perder respostas e progresso. Tratar conteúdo do usuário e saídas de modelos como não confiáveis, validando esquemas e prevenindo injeção de instruções.

## Entrega e comunicação
- Ao finalizar cada EPIC, resumir arquivos principais alterados, funcionalidades, comandos de teste e resultados, riscos e próximo passo.
- Manter instruções de execução e empacotamento claras em `PROMPT.md` ou comentários/configurações apropriadas, sem multiplicar documentos de orientação.
- O alvo final é instalador Windows `.exe`. Se o ambiente não suportar build Windows, preparar pipeline reproduzível e declarar a limitação.
- Considerar um EPIC concluído somente quando sua funcionalidade principal for demonstrável e os testes pertinentes passarem.
