# F.E.N.I.X. — Especificação da solução

Data: 17/10/2026. Estado: proposta para revisão, anterior à implementação dos módulos.

## Objetivo

Implementar as três partes do F.O.G.O. do DSIN Coder Challenge: inventário dos recursos urbanos, central de operações e prevenção baseada em histórico. O nome F.E.N.I.X. e a ligação com a recuperação da cidade sob PROMETHEUS permanecem na identidade. Os fluxos de trabalho devem usar linguagem operacional clara.

A base existente usa React/TypeScript e Django. A inclusão de PHP foi solicitada pelo participante. A implementação será compatível com uma apresentação técnica de desenvolvedor júnior: módulos pequenos, regras explícitas e instruções reproduzíveis. Esta especificação não descreve funcionalidades já entregues.

## Divisão das tecnologias

React implementará a interface. Django será responsável pelo banco, autenticação, validação, cadastros, eventos e cálculos. PHP será responsável pela geração dos relatórios CSV, consumido exclusivamente pelo Django.

O relatório é a fronteira recomendada para PHP: entrega uma funcionalidade útil, permite demonstrar a linguagem e evita duplicar regras de cadastro. Colocar a ingestão de telemetria em PHP acrescentaria outra fronteira transacional; substituir telas por páginas PHP duplicaria a navegação existente em React. Essas duas alternativas ficam fora desta proposta.

SQLite será o caminho simples de execução; MySQL será disponibilizado pelo Compose. Não haverá dependência obrigatória de serviços pagos. A versão completa precisará de Python, Node e PHP para execução sem Docker; o Compose oferecerá o caminho integrado.

## Inventário

Equipamento terá tipo, número de série único, marca, modelo, órgão responsável, CEP, bairro, região, cidade, UF, rua, referência, latitude, longitude, situação, necessidade de manutenção, data da próxima manutenção e características específicas.

Os tipos incluirão radar, câmera, balança, fiscalização de estacionamento, cancela, veículo de transporte, totem, patinete, moto de agente, viatura e outro. As situações serão não instalado, operacional, mau funcionamento, em manutenção, desativado e furtado. A manutenção será nenhuma, imediata ou programada; programada exige uma data válida.

Características ficarão em um objeto JSON com validação por tipo, mantendo a primeira versão simples. Exemplos: limite de velocidade do radar, resolução e visão noturna da câmera. Limites GPS serão validados, número de série duplicado será rejeitado e características inválidas não serão persistidas.

Agente terá nome, matrícula única por órgão, órgão, função, situação, bairro, região, coordenadas e momento da última atualização. Os órgãos incluirão trânsito, guarda municipal e polícia militar. Situações: em atividade, disponível, em ocorrência e fora de serviço. Dados de demonstração serão fictícios.

A interface permitirá listar, pesquisar, filtrar, criar, consultar, editar e excluir registros, com confirmação de exclusão. O histórico usará exclusão lógica dos recursos para preservar eventos. Campos inválidos devem mostrar mensagens junto ao campo; uma falha de rede não deve apagar o formulário.

## Central de operações

A tela principal reunirá indicadores, mapa, lista de recursos e alertas. O mapa usará Leaflet com atribuição ao provedor dos mapas; filtros serão compartilhados com a lista e os indicadores. A lista continuará utilizável se os mapas externos não carregarem. Ícones e rótulos distinguirão equipamento e agente, e situação será comunicada por texto além de cor.

Indicadores: total de equipamentos ativos no inventário, operacionais, indisponíveis, disponibilidade percentual e agentes em atividade. Indisponíveis serão os equipamentos em mau funcionamento, manutenção, desativados ou furtados. Não instalados aparecerão separadamente. Disponibilidade será operacionais dividido por operacionais mais indisponíveis, excluindo não instalados. Sem denominador, exibir “sem dados”, não 100%.

Filtros: busca textual, tipo, situação, bairro, região e órgão. O clique num marcador abrirá os detalhes do recurso. Uma visão por região mostrará totais e recursos críticos. Manutenção imediata e programada para os próximos sete dias terão destaque; datas anteriores ao dia atual serão vencidas.

Atualizações ocorrerão por consulta automática a cada cinco segundos, com botão de atualização e horário da última resposta. A interface chamará isso de atualização periódica, sem prometer transmissão instantânea. Erros de consulta manterão os últimos dados, identificados como desatualizados.

## Eventos e telemetria

Evento conterá recurso, tipo, momento registrado, situação, coordenadas opcionais e origem. Tipos mínimos: sinal de atividade, falha, recuperação, atualização de posição e manutenção concluída. A aplicação atualizará o estado atual e registrará o evento na mesma transação. Eventos de recurso inexistente serão rejeitados.

Um comando de demonstração produzirá eventos controlados a partir de uma semente, sem depender de equipamentos físicos. A simulação será claramente identificada e acionada pelo operador; não deve iniciar silenciosamente nem criar resultados aleatórios a cada renderização. Eventos repetidos com o mesmo identificador externo não serão contados duas vezes.

O histórico dos eventos alimentará o painel e a prevenção. Datas terão fuso America/Sao_Paulo na apresentação e armazenamento com informação de fuso.

## Prevenção explicável

A primeira análise antecipará necessidade de intervenção em equipamentos e concentração de indisponibilidade por região. Será uma regra heurística, não uma probabilidade estatística de falha.

Pontuação de atenção do equipamento, limitada a 100: 40 pontos para manutenção imediata; 25 para manutenção programada vencida; 10 para manutenção prevista nos próximos sete dias; 10 por falha nos últimos sete dias, até 30; 15 para ausência de sinal por mais de 30 minutos quando houver histórico de telemetria. Manutenção vencida e próxima não se acumulam. Equipamentos sem telemetria não recebem automaticamente penalidade por ausência de sinal.

Classes: baixa de 0 a 24, moderada de 25 a 49, alta de 50 a 74 e crítica de 75 a 100. Equipamentos furtados ou desativados serão apresentados como indisponíveis para ação operacional, sem fingir que sua indisponibilidade atual é uma previsão futura. O índice será separado do estado atual.

Cada avaliação mostrará fatores, janela temporal, instante do cálculo e ação sugerida. A região terá contagem de equipamentos em atenção e disponibilidade; isso não será apresentado como previsão de criminalidade ou de trânsito sem dados dessas ocorrências. Uma tendência comparará falhas nos últimos sete dias com os sete anteriores. Sem dados suficientes, exibir essa limitação.

## Serviço PHP de relatórios

PHP receberá um JSON validado com os equipamentos já filtrados e os metadados do relatório. Gerará CSV UTF-8 com cabeçalho e resposta de download. A aplicação Django exporá o download autenticado ao navegador e chamará o serviço PHP pela rede interna. PHP não receberá credenciais do banco nem consultará diretamente o banco Django.

O contrato terá versão, instante de geração, filtros e linhas. Cada linha conterá identificação, tipo, situação, órgão, bairro, região e manutenção. O limite será 5.000 linhas por solicitação; excesso retornará mensagem solicitando filtros mais restritos. Campos que possam ser interpretados como fórmulas de planilha serão neutralizados, aspas e quebras de linha serão escapadas pela função CSV nativa e campos desconhecidos serão ignorados.

O serviço aceitará somente POST no endpoint de exportação e GET no endpoint de saúde. Um segredo de serviço configurado por ambiente autenticará a chamada Django→PHP. Não haverá chamada direta do navegador para o segredo. Falha do serviço produzirá HTTP 503 com mensagem útil na interface, sem bloquear cadastros e mapa. Um timeout de cinco segundos evitará espera indefinida. Não haverá fallback que gere CSV em Python e o apresente como se tivesse sido produzido por PHP.

## API e autenticação

Endpoints planejados: sessão e CSRF; equipamentos; agentes; eventos; resumo do painel; alertas; prevenção; relatório CSV e saúde. Listagens terão paginação e filtros. Os cálculos e regras ficarão em serviços Python separados das views. As respostas padronizarão erros de campo e erros gerais.

A central usará sessão Django. Escritas exigirão CSRF e usuário autenticado. O proxy de desenvolvimento preservará a mesma origem; credenciais de demonstração serão criadas por comando explícito e documentadas como locais. Senhas e segredos não serão versionados. A aplicação não será apresentada como pronta para produção apenas por executar localmente.

## Experiência visual

Manter grafite, âmbar e a identidade F.E.N.I.X. A página inicial evoluirá para uma central funcional, com navegação entre visão geral, equipamentos, agentes, eventos e prevenção. Formulários terão rótulos, estados de carregamento e mensagens acessíveis. O mapa não será a única forma de acessar informações. Telas pequenas mostrarão indicadores e listas em uma coluna, preservando os formulários.

## Dados de demonstração

Um comando idempotente criará equipamentos de tipos variados, agentes e quatorze dias de eventos fictícios em Marília. A semente e os dados serão identificados no README. Haverá exemplos de operacional, falha, manutenção vencida, manutenção próxima e recurso sem histórico. Reexecutar o comando não duplicará os dados. Os dados não representarão a localização real de equipes policiais ou equipamentos críticos.

## Verificação e critérios de aceite

Inventário: criar e editar os dois recursos; rejeitar coordenadas inválidas e duplicatas; preservar eventos de recurso excluído logicamente.

Operação: aplicar filtros coerentes em mapa/lista/indicadores; consultar detalhes; refletir um evento de falha na atualização seguinte; preservar estado anterior em erro de rede.

Prevenção: testar limites de pontuação, janelas de sete dias, ausência de histórico e explicações; não exibir pontuações como probabilidades validadas.

Relatórios: executar PHP de verdade; testar autenticação interna, conteúdo CSV, acentuação, fórmulas, limite de linhas e indisponibilidade. Validar o arquivo baixado pelos filtros da central.

Entrega: verificar instalação limpa, migrações, testes Python e PHP, tipos e compilação React, fluxo MySQL no Compose e instruções do README. Gravar vídeo somente quando os fluxos estiverem funcionais; até lá, documentar o estado parcial.

## Limitações de hospedagem e visualização

A visualização privada disponível no ChatGPT serve a compilação estática de React. Ela não hospeda Django ou PHP. Nela, a indicação de central indisponível é esperada até existir backend externo alcançável. Não será usado um arquivo estático que responda “ok” para simular uma API real.

A solução integrada será executada localmente ou em hospedagem compatível com Python, PHP e banco. Escolha de provedor pago e publicação pública não fazem parte desta especificação.
