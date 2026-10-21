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

## Tela de Trilhas — requisitos obrigatórios

### Design e navegação
- Inspirar-se na experiência de progressão do Duolingo: percurso visual, checkpoints, estados bloqueado/disponível/concluído, feedback imediato e sensação clara de evolução. Não copiar marca, mascote, ilustrações, textos ou identidade visual proprietária.
- Manter duas áreas distintas: **Trilha de Idiomas** e **Trilha de Carreira**. Exibir progresso real, próxima ação recomendada e critérios objetivos para concluir cada etapa.
- Garantir acessibilidade por teclado, contraste, leitura confortável e navegação eficiente no desktop. Evitar gamificação que distorça a avaliação de aprendizado.

### Trilha de Idiomas
- A tela inicial permite escolher o idioma; a estrutura deve aceitar novos idiomas sem exigir mudanças profundas no código.
- Para cada idioma, oferecer configuração de nível atual e nível-alvo (preferencialmente CEFR quando aplicável), prazo desejado, minutos disponíveis por dia e disponibilidade semanal.
- Disponibilizar ação explícita **“Sugerir plano com IA”**. A IA deve produzir proposta editável com etapas, carga horária, revisões, marcos e premissas; validar a viabilidade do prazo e nunca prometer fluência.
- Gerar lições offline em PDF, adequadas para anotação com S Pen no Samsung Notes: páginas A4 com margens amplas, espaços de resposta, campos identificáveis, tipografia legível e exportação/importação simples. Priorizar PDF padrão interoperável; não alegar compatibilidade total com recursos proprietários sem teste real.
- Permitir importar o PDF anotado e enviá-lo para correção mediante confirmação. Preservar o arquivo original e as versões. PDFs manuscritos exigem OCR ou leitura multimodal configurada; quando a extração não for confiável, pedir transcrição ou confirmação e indicar incertezas.
- Em cada lição, redação e teste, registrar erros com categoria, explicação, correção sugerida, contexto, recorrência e vínculo com o tópico. Não confundir divergência estilística com erro objetivo.
- Criar **Área de Reforço** com exercícios personalizados baseados nos erros, priorizados por frequência, gravidade e desempenho posterior. Permitir corrigir classificações equivocadas da IA.
- Criar **Área de Relembrar** com revisões periódicas por repetição espaçada, dando atenção a conteúdos antigos e aos esquecidos. Registrar datas, acertos e evolução; funcionar offline com fila de geração/sincronização quando necessário.
- Para inglês, manter leitura, interpretação, redação, vocabulário e correção explicada, com progressão adaptativa e histórico de versões.

### Trilha de Carreira
- Exibir uma síntese objetiva de competências pedidas em vagas relevantes de IA, ordenadas por importância **calculada a partir de fontes e critérios explícitos**: frequência nas vagas analisadas, relevância para o cargo-alvo, atualidade e lacunas do estudante. Mostrar amostra, período, região e data da atualização; não apresentar ranking subjetivo como estatística de mercado.
- Oferecer campo **“Sugerir tema”** para o estudante propor assuntos; a IA encaixa a sugestão no roadmap, explicando pré-requisitos e prioridades, sem substituir automaticamente o plano.
- Cada tópico deve incluir: resumo teórico conciso, conceitos-chave, exemplos executáveis ou verificáveis, explicação dos exemplos e um desafio curto e prático. Sempre que apropriado, orientar um artefato publicável no GitHub para evolução do portfólio, com README e critérios de aceite.
- Gerar conteúdo de IA usando fontes verificáveis: documentação oficial, publicações acadêmicas identificáveis e vagas reais quando disponíveis. Registrar título, autoria/instituição, URL/DOI, data e trechos/alegações sustentados; distinguir fatos, interpretações e sugestões. **Nunca inventar fontes, citações, requisitos de vagas, resultados de pesquisas ou dados de mercado.** Se não houver evidência, declarar a limitação.
- Manter integração autorizada com repositório remoto (preferencialmente GitHub) para consultar código, commits e resultados de CI e vincular evidências aos desafios. Não publicar código, alterar branches, criar PRs nem executar workflows sem consentimento e escopos adequados.
- Corrigir exercícios em duas etapas: testes determinísticos em ambiente isolado/CI confiável e análise pedagógica da IA. Exibir separadamente falhas verificadas, qualidade, segurança, complexidade e sugestões; nunca afirmar que o código passou em testes não executados.
- Incluir **Área do Currículo** com importação, edição, versionamento e sugestões da IA. Oferecer atualização manual e revisão periódica configurável; alterações propostas precisam de aprovação antes de substituir o currículo. Não inventar experiência, competências, certificações ou resultados.
- Incluir **Sugestões de Vagas** com origem, URL, data, localidade, modalidade, senioridade, requisitos e evidências. Calcular proximidade do currículo por critérios transparentes, exibindo competências atendidas, lacunas e confiança; o percentual é uma heurística, não uma probabilidade de contratação ou visto. Não afirmar que uma vaga está aberta sem verificação recente.
- Atualizações periódicas de currículo/vagas só devem ocorrer quando a aplicação estiver em execução ou por mecanismo de agendamento explicitamente configurado e autorizado; não prometer execução com o computador desligado.

### Regras transversais e aceite
- Persistir configurações, trilhas, versões de lições, erros, revisões, projetos, fontes, currículo e avaliações no SQLite com migrações e integridade referencial.
- Permitir uso offline de materiais já gerados e progresso; deixar visíveis operações que dependem de internet, APIs, OCR, Google ou GitHub.
- Pedir consentimento antes de transmitir currículos, redações, PDFs anotados ou código a provedores externos; minimizar dados enviados e respeitar limites de custo de IA.
- Priorizar entrega incremental: percurso e persistência; configuração e lições; reforço/relembrar; conteúdo de carreira e desafios; GitHub e currículo; vagas e automações. Cada etapa deve ter testes e critérios de aceite observáveis.
- Tratar este capítulo como ampliação dos requisitos de `PROMPT.md` para a tela de Trilhas. Em caso de divergência específica sobre esta tela, aplicar estas regras sem descartar as demais funcionalidades do projeto.

## Entrega e comunicação
- Ao finalizar cada EPIC, resumir arquivos principais alterados, funcionalidades, comandos de teste e resultados, riscos e próximo passo.
- Manter instruções de execução e empacotamento claras em `PROMPT.md` ou comentários/configurações apropriadas, sem multiplicar documentos de orientação.
- O alvo final é instalador Windows `.exe`. Se o ambiente não suportar build Windows, preparar pipeline reproduzível e declarar a limitação.
- Considerar um EPIC concluído somente quando sua funcionalidade principal for demonstrável e os testes pertinentes passarem.

## Formatação de arquivos .md — GitHub Flavored Markdown

Aplicar estas regras ao criar ou editar arquivos `.md`, preservando as instruções e os requisitos existentes. Usar GitHub Flavored Markdown (GFM), com os alertas suportados pelo GitHub.

### Hierarquia de títulos e espaçamento

- Usar um único título principal `#` por arquivo, seções `##` e subseções `###`, sem saltar níveis. Escrever títulos descritivos; não substituir títulos por texto em negrito.
- Separar títulos, parágrafos, listas, tabelas e blocos de código com linhas em branco. Salvar em UTF-8, encerrar com uma nova linha e evitar espaços finais desnecessários.

### Listas e checklists

- Usar `-` em listas sem ordem e numeração em procedimentos sequenciais. Alinhar subitens e continuações ao início do conteúdo do item pai, usando espaços.
- Usar `- [ ]` para tarefas pendentes e `- [x]` apenas para tarefas concluídas e verificadas. Cada item deve ter um resultado observável; distinguir planejamento de entrega realizada.

### Tabelas

- Usar tabelas para dados comparáveis, com cabeçalho, linha separadora contendo pelo menos três hífens por coluna e o mesmo número de células em cada linha.
- Separar colunas com `|`, escapar barras verticais no conteúdo como `\|` e usar `:---`, `:---:` ou `---:` quando o alinhamento ajudar. Evitar células extensas e tabelas para organizar parágrafos.

### Código e comandos

- Usar crases para nomes de arquivos, símbolos, opções e comandos curtos. Delimitar exemplos de várias linhas com cercas de código e informar a linguagem: `powershell`, `bash`, `json`, `typescript`, `rust`, `sql` ou `markdown`; usar `text` para saídas e texto sem linguagem.
- Ao demonstrar cercas de código, usar uma cerca externa mais longa que as internas. Não deixar blocos abertos.
- Indicar diretório de execução, pré-requisitos e shell quando relevantes; preferir PowerShell nos comandos para Windows. Exemplos devem corresponder aos scripts, contratos e configurações existentes, sem segredos reais.

### Links e imagens

- Usar texto descritivo nos links. Para arquivos e imagens do repositório, usar caminhos relativos ao documento, com `/`, como [especificação funcional](PROMPT.md); evitar caminhos absolutos locais e URLs que fixem uma branch desnecessariamente.
- Usar âncoras correspondentes aos títulos renderizados e atualizar referências quando títulos ou arquivos mudarem. Imagens devem ter texto alternativo útil.

### Alertas GitHub

- Usar com moderação `> [!NOTE]` para contexto, `> [!TIP]` para sugestões, `> [!IMPORTANT]` para requisitos essenciais, `> [!WARNING]` para avisos urgentes e `> [!CAUTION]` para riscos de uma ação.
- Colocar o marcador em uma linha própria e o conteúdo nas linhas seguintes, todas iniciadas por `>`. Não aninhar alertas em listas, citações ou outros alertas.

Exemplo de sintaxe:

```markdown
> [!IMPORTANT]
> Confirme os pré-requisitos antes de executar o comando documentado.
```

### Validação e fidelidade ao código

- Antes de concluir, revisar o diff e a renderização Markdown, conferir hierarquia, listas, checklists, tabelas e fechamento e linguagem dos blocos. Executar o formatador ou linter de Markdown se disponível, respeitando a configuração do projeto.
- Conferir a existência e a capitalização dos destinos relativos, imagens e âncoras. Verificar URLs externas adicionadas ou alteradas quando houver acesso; registrar links não verificados e limitações de autenticação ou rede, sem afirmar validação que não ocorreu.
- Manter a documentação fiel ao código: conferir comandos, scripts, caminhos, versões, variáveis de ambiente, contratos e comportamento descritos. Atualizar a documentação afetada junto da implementação e identificar funcionalidades planejadas, limitações conhecidas e exemplos ilustrativos.
- Não inventar resultados de testes, compatibilidade, integrações ou funcionalidades. Não criar documentos adicionais sem necessidade, conforme a seção Qualidade.
