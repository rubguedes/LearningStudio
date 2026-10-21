#LearningStudio

Seu espaço de estudos, prática e evolução profissional em um único aplicativo desktop.
O LearningStudio é um projeto de aplicativo pessoal para Windows, pensado para organizar estudos, acompanhar metas e construir trilhas de aprendizado de idiomas e de carreira em Inteligência Artificial. A proposta combina planejamento, exercícios práticos, revisões e tutores de IA opcionais, mantendo os dados principais disponíveis localmente.
Status: em desenvolvimento. Este README descreve a visão e os requisitos planejados em PROMPT.md e AGENTS.md. Funcionalidades, integrações e instalador não devem ser considerados concluídos sem validação no repositório.
Funcionalidades planejadas
Painel e organização
Dashboard com tarefas do dia, sessões, metas, checkpoints e progresso por trilha.
Áreas, matérias, tópicos, recursos, agenda, tarefas recorrentes e sessões cronometradas.
Histórico de estudos, relatórios de consistência e acompanhamento de objetivos mensuráveis.
Persistência local e acesso aos materiais já baixados mesmo sem internet.
Trilha de Idiomas
Experiência visual de progressão inspirada na dinâmica de trilhas do Duolingo, sem reproduzir sua identidade visual.
Escolha do idioma e configuração de nível atual, nível desejado, prazo e tempo diário disponível.
Solicitação de um plano de aprendizado sugerido por IA, com etapas e checkpoints editáveis.
Lições de leitura, interpretação, redação, gramática e vocabulário, com correções explicadas.
Exportação de lições em PDF com espaço para anotações, visando uso com Samsung Notes e S Pen no tablet.
Importação de PDFs respondidos para correção; a leitura de escrita manual depende de recursos de OCR ou IA multimodal e pode exigir conferência.
Reforço: identificação de erros recorrentes e exercícios direcionados.
Relembrar: revisões espaçadas de conteúdos estudados anteriormente.
Roadmap inicial editável de inglês B1/B2 rumo a C1, sem presumir avaliação formal de proficiência.
Trilha de Carreira em IA
Roadmap de competências para AI Engineer e evolução para AI Solutions Architect.
Priorização de habilidades com base em vagas e fontes identificadas, explicitando os critérios utilizados.
Sugestão de temas pelo estudante e reorganização do plano conforme pré-requisitos.
Conteúdo teórico objetivo, exemplos explicados e desafios curtos com potencial de compor um portfólio no GitHub.
Exercícios de Python e TypeScript, com testes determinísticos quando houver ambiente isolado seguro e feedback complementar por IA.
Integração autorizada com repositórios GitHub para acompanhar entregas e resultados de CI.
Área de currículo com sugestões de atualização por IA, revisão manual e histórico de versões; nenhuma alteração é aplicada sem aprovação.
Sugestões de vagas com requisitos, fontes, lacunas de competências e índice heurístico de aderência, não uma previsão de contratação.
Conteúdos e análises fundamentados em documentação, pesquisas e vagas verificáveis; sem inventar referências ou dados de mercado.
Agenda e integrações
Lembretes de estudo e sincronização autorizada com Google Calendar.
Envio opcional de lembretes ao próprio e-mail por Gmail, mediante consentimento.
Cadastro e importação manual de tarefas agendadas no ChatGPT. A sincronização automática dessas tarefas não é prometida, pois depende de uma API oficial compatível.
Operações online com estados de sincronização visíveis; sem promessa de envio quando o computador estiver desligado.
Tutores de IA opcionais
OpenAI API: uso mediante chave e cobrança separada da assinatura do ChatGPT.
Ollama: execução local de modelos compatíveis, sujeita ao hardware e à instalação/configuração do serviço.
Geração e correção de lições, explicação de erros, desafios adaptativos e recomendações de revisão.
Histórico de tentativas, estimativas de tokens e custo quando disponíveis, alertas e limite mensal para chamadas remotas.
O organizador e as lições previamente disponíveis devem funcionar sem chave de API.
Tecnologias previstas
Camada
Tecnologia
Desktop
Tauri 2
Interface
React, TypeScript e Vite
Comandos nativos e integrações sensíveis
Rust
Banco local
SQLite com migrações
IA
Adaptadores para OpenAI API e Ollama
Distribuição
Instalador Windows .exe
A arquitetura prioriza operação local, sem exigir Docker, hospedagem ou inicialização manual de um backend HTTP.
Segurança e privacidade
Acesso protegido por senha local com hash forte.
Tokens e chaves armazenados no cofre de credenciais do Windows.
Dados de estudo guardados localmente, salvo envio autorizado para integrações externas.
Confirmação antes de transmitir currículos, códigos, redações e PDFs para serviços de terceiros.
Código submetido nunca é executado diretamente no processo do aplicativo. Testes automáticos exigem isolamento comprovado; caso contrário, ficam indisponíveis.
Backups locais e migrações devem preservar os dados do usuário.
Roadmap de implementação
EPIC
Entrega prevista
1
Estrutura Tauri/React/SQLite, autenticação, layout e tarefas básicas
2
Sessões de estudo, metas, checkpoints, dashboard e relatórios
3
Trilhas editáveis, lições offline, redações e vocabulário
4
Agenda interna, recorrência e importação manual de tarefas do ChatGPT
5
Integrações autorizadas com Google Calendar e Gmail
6
Tutores IA, desafios de programação, revisões, controle de custos, testes e instalador
A ampliação da tela de Trilhas descrita em AGENTS.md detalha requisitos adicionais de idiomas, PDF, reforço, currículo, GitHub e vagas. Essas entregas devem ser implementadas incrementalmente e testadas.
Desenvolvimento
As instruções de implementação estão centralizadas em:
PROMPT.md: escopo, funcionalidades, arquitetura, EPICs e critérios de aceite.
AGENTS.md: regras permanentes de implementação, segurança, testes e requisitos detalhados das trilhas.
Para contribuir ou executar o projeto: consulte o estado real do código-fonte e as instruções de build presentes no repositório. Os comandos de instalação, execução, testes e empacotamento serão documentados após a criação e validação do projeto. Não há comandos fictícios neste README.
Princípios do projeto
Aprendizado comprovado por atividades e evidências, não por cliques.
Conteúdo confiável e fontes verificáveis, com incertezas explicitadas.
Feedback útil e personalizado, sem dependência obrigatória de IA paga.
Privacidade, controle de custos e funcionamento offline sempre que possível.
Uma experiência desktop clara, progressiva e sustentável.
LearningStudio · Projeto de aplicativo pessoal de estudos para Windows