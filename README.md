# F.E.N.I.X.

Uma cidade capaz de recomeçar.

Projeto para a etapa bônus do DSIN Coder Challenge 2026. Dentro da iniciativa F.O.G.O., o F.E.N.I.X. reúne inventário, operação e prevenção para apoiar a recuperação da cidade no universo de PROMETHEUS.

## Identidade e decisões

F.E.N.I.X. representa **Força, Evolução do Nutrir, Integração e X (Incógnita/Potencial)**. O nome e o significado foram propostos pelo participante. A referência à fênix traduz o renascimento: conhecer os recursos, recuperar o funcionamento e aprender com as falhas. Nutrir, nesse contexto, significa alimentar decisões com informações confiáveis.

A solução foi organizada a partir das três necessidades do enunciado. React/TypeScript cuida da interface; Django concentra dados e regras; PHP gera relatórios CSV sem receber acesso ao banco. Essa divisão permite demonstrar as tecnologias informadas no perfil do participante sem duplicar cadastros entre duas linguagens.

SQLite facilita a primeira execução. MySQL está configurado como alternativa no Docker Compose. O índice de atenção usa regras abertas, e não uma suposta inteligência preditiva sem dados suficientes.

## O que está implementado

Inventário: cadastro, pesquisa, filtros, detalhes, edição e exclusão lógica de equipamentos e agentes. Equipamentos incluem endereço, GPS, número de série, marca, modelo, situação, manutenção e características JSON. Agentes incluem matrícula por órgão, função, localização e situação.

Operação: mapa Leaflet/OpenStreetMap, indicadores, alertas de manutenção, visão por região e histórico. Na conexão com Django, os dados são atualizados a cada cinco segundos. Eventos manuais simulam atividade, falha e manutenção concluída. O servidor mantém histórico, rejeita eventos futuros inválidos e evita duplicação pelo identificador externo.

O histórico preserva as coordenadas enviadas e o estado informado por cada evento. Atividade, posição e estado têm ordenação independente: uma falha atrasada pode atualizar o estado se não houver outra transição posterior, mas não substitui uma recuperação mais recente. Coordenadas antigas ficam no histórico sem mover o marcador atual. Eventos sem posição ou transição exibem esses campos vazios. A busca usa conversão Unicode para minúsculas também no servidor, mantendo o filtro do CSV consistente com a interface em SQLite e MySQL; em bases maiores, essa busca precisa de índice normalizado.

Prevenção: índice de atenção de 0 a 100 com fatores e recomendações visíveis, além da comparação de falhas em duas janelas de sete dias. A pontuação não é uma probabilidade estatística de falha. Indisponibilidade atual e risco preventivo são apresentados separadamente.

Relatórios: endpoint Django autenticado chama PHP pela rede interna. PHP valida o contrato e gera CSV UTF-8 com proteção contra fórmulas de planilha. Falha do serviço é apresentada ao usuário; não há geração silenciosa em Python fingindo ser PHP.

Sessão: autenticação Django e proteção CSRF para escritas. Administração disponível em `/admin/`. O projeto ainda não passou por uma revisão de implantação em produção.

## Visualização no ChatGPT

https://fenix-interface-neitolas.pink-loach-9049.chatgpt.site

A visualização privada serve a interface compilada de React. **Ela abre em demonstração local**, com dados fictícios identificados e persistidos apenas no navegador. É possível cadastrar, editar, excluir, filtrar e registrar eventos demonstrativos. Para reiniciar os exemplos, remova a chave `fenix-demo-v1` do armazenamento local do navegador.

Esse endereço não hospeda Django nem PHP. Na execução integrada, entre em `http://127.0.0.1:8000/admin/` com o usuário criado e recarregue a interface: ela reconhece a sessão autenticada pela mesma origem. O site privado não se conecta automaticamente ao localhost do computador. Exportar CSV requer a execução integrada e fica indisponível na demonstração. Os mapas externos dependem de rede; as listas continuam disponíveis se os mapas não carregarem.

## Executar o projeto integrado

Requisitos: Python 3.12, Node.js 24, npm e PHP 8.3 ou superior. Para MySQL, Docker com Compose v2. Não é preciso contratar um serviço pago para executar localmente.

```sh
git clone https://github.com/Neitolas/fenix.git
cd fenix
python -m venv .venv
```

No Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
Copy-Item .env.example .env
```

No Linux ou macOS:

```sh
source .venv/bin/activate
cp .env.example .env
```

No primeiro terminal, com o ambiente ativado:

```sh
python -m pip install -r backend/requirements.txt
python backend/manage.py migrate
python backend/manage.py seed_demo
python backend/manage.py createsuperuser
python backend/manage.py runserver 127.0.0.1:8000
```

Escolha seu próprio usuário e senha. O comando `seed_demo` cria 12 equipamentos, seis agentes e eventos fictícios em torno de Marília; pode ser repetido sem duplicar os exemplos nem sobrescrever edições existentes. Ele não cria uma senha padrão.

No segundo terminal:

```sh
cd frontend
npm ci
npm run dev
```

Entre em http://127.0.0.1:8000/admin/ com o usuário criado. Em seguida, abra ou recarregue http://127.0.0.1:5173; a interface reconhece a sessão e carrega os dados do servidor. Use o mesmo host `127.0.0.1` nos dois endereços para compartilhar o cookie. O proxy do Vite encaminha `/api` ao Django e preserva a mesma origem para cookies e CSRF.

No terceiro terminal, com o ambiente Python ativado e PHP disponível no PATH:

```sh
python scripts/run_reports.py
```

O script carrega `.env` e inicia PHP em `127.0.0.1:9080`. O mesmo `REPORT_SERVICE_TOKEN` deve ser usado pelos dois serviços. Os valores de `.env.example` servem apenas ao desenvolvimento local. Não publique `.env`, senhas, `.venv`, bancos locais ou `node_modules`.

## Alternativa com MySQL e PHP no Docker

Com `.env` configurado e a API local desligada para liberar a porta 8000:

```sh
docker compose --profile mysql up --build
```

O Compose inicia MySQL, Django e PHP. A API aguarda o banco e aplica as migrações; o serviço PHP não expõe porta na máquina hospedeira. Em outro terminal:

```sh
docker compose --profile mysql exec api python manage.py seed_demo
docker compose --profile mysql exec api python manage.py createsuperuser
```

Execute o frontend com npm como na seção anterior. `docker compose --profile mysql down` encerra os serviços preservando o volume do banco. Não use `down -v` se quiser preservar esses dados.

## Regras do índice e dos indicadores

Manutenção imediata soma 40 pontos. Manutenção programada vencida soma 25; prevista nos próximos sete dias, 10. Cada falha nos últimos sete dias soma 10, limitada a 30. Ausência de sinal por mais de 30 minutos soma 15 somente quando já existe histórico de telemetria. Vencida e próxima não se acumulam. O total é limitado a 100.

Atenção baixa: 0–24; moderada: 25–49; alta: 50–74; crítica: 75–100. Uma falha manual muda o equipamento para mau funcionamento e manutenção imediata. A manutenção concluída encerra a pendência e devolve o equipamento à situação operacional.

Disponibilidade = operacionais ÷ (operacionais + indisponíveis). Não instalados ficam fora do denominador. Sem equipamentos elegíveis, a tela mostra “Sem dados”. Os fatores preventivos não são usados para inventar previsões de criminalidade ou de tráfego sem dados dessas ocorrências.

## Estrutura

- `backend/operations/`: modelos, formulários, API, eventos, serviços de análise, administração e testes.
- `backend/config/`: configuração e rotas do Django.
- `frontend/src/`: interface React, cliente da API, regras da demonstração e testes.
- `frontend/src/components/`: mapa, formulários e diálogos acessíveis.
- `reports-php/`: contrato CSV, serviço HTTP, Dockerfile e testes PHP.
- `scripts/run_reports.py`: inicialização local do serviço PHP.
- `docs/superpowers/`: especificação, plano e registro do desenvolvimento.
- `.github/workflows/checks.yml`: verificações de backend, frontend e relatórios.

## Testar

Para instalar as ferramentas de desenvolvimento, além das dependências da aplicação:

```sh
python -m pip install -r backend/requirements-dev.txt
ruff check backend scripts
ruff format --check backend scripts
```

```sh
python backend/manage.py check
python backend/manage.py makemigrations --check --dry-run
python backend/manage.py test config operations
php reports-php/tests.php
```

No diretório `frontend/`:

```sh
npm test
npm run lint
npm run format:check
npm run build
```

As verificações incluem regras da demonstração, navegação, cadastro persistido no navegador, evento simulado, validações e autenticação da API, histórico, indicadores, pontuação, custo das consultas e geração segura de CSV.

Neste ambiente, PHP foi executado por PHP.wasm, do WordPress Playground, inclusive no teste HTTP de integração Django→PHP→CSV. O mesmo código está preparado para PHP CLI nativo. Docker/MySQL ainda não foram executados aqui. Os testes de interface usam DOM simulado; não substituem a conferência visual em diferentes navegadores nem validam a disponibilidade dos mapas externos.

## Próximas validações

Validar o caminho Docker/MySQL em instalação limpa, conferir o mapa e os formulários em navegadores reais, revisar segurança de produção, registrar um vídeo demonstrativo e revisar a documentação com o participante. A visualização estática não equivale à hospedagem dos três serviços integrados.

O prazo do enunciado é 27/10/2026 às 23h59. O repositório está privado durante o desenvolvimento; o material deverá ficar acessível aos avaliadores antes da submissão. O limite de envio informado é 50 MB.

## Organização e qualidade do código

A refatoração mantém os fluxos de inventário, operação e prevenção e reduz as responsabilidades concentradas nos arquivos de entrada. Os princípios foram aplicados onde há uma necessidade concreta; não foram acrescentadas hierarquias de classes apenas para representar todas as letras de SOLID.

| Prática | Aplicação no projeto |
| --- | --- |
| Responsabilidade única (SRP) | `ResourceFilters` apresenta filtros; `ResourceTable` apresenta registros; `useCityConnection` coordena sessão, sincronização e dados da central. No Django, `event_data.py` valida entradas, `event_service.py` executa a ingestão e `telemetry.py` traduz resultados para HTTP. |
| Dependências explícitas | O hook recebe um cliente compatível com o contrato `CityClient`, limitado a sessão, leitura da cidade e saída. Os testes podem fornecer esse cliente sem acessar a rede. A validação de eventos recebe um relógio explícito quando necessário. |
| DRY | Equipamentos e agentes compartilham a fábrica de views CRUD. Filtros e tabelas têm componentes reutilizáveis. Tipos de transição e colunas do CSV possuem uma definição central em seus respectivos módulos. |
| KISS e coesão | Funções pequenas por tarefa, composição de componentes e serviços simples; sem camadas de repositório que apenas repassem chamadas ao ORM. |
| Validação antecipada | Identificadores, datas, coordenadas e contrato CSV são verificados antes da persistência ou geração do arquivo. Erros de contrato recebem HTTP 400; falhas internas do serviço PHP recebem HTTP 500 sem detalhes internos. |
| Comandos e consultas separados | A consulta do histórico fica separada da ingestão transacional. Isto organiza o código sem introduzir infraestrutura de CQRS. |
| Segurança de recursos e concorrência | O PHP fecha o fluxo temporário em `finally`. A sincronização React aguarda leituras em andamento antes de iniciar outro ciclo automático, ignora respostas antigas e resultados após desmontagem ou retorno à demonstração, preservando a última leitura quando a rede falha. |
| Estilo verificável | EditorConfig define convenções de edição; Ruff organiza imports, verifica e formata Python; Prettier verifica TypeScript/CSS; Oxlint verifica a interface. O PHP foi organizado com tipos estritos e convenções de apresentação da PSR-12. |

CRUD significa **Create, Read, Update e Delete**: no projeto, corresponde a cadastrar, consultar, editar e excluir logicamente os recursos. É o conjunto de operações do inventário, não um princípio de clean code. Transações, autenticação, CSRF, idempotência e histórico continuam protegendo essas operações.

Arquivos extraídos nesta etapa:

- `frontend/src/hooks/useCityConnection.ts`: cliente tipado, persistência local e sincronização.
- `frontend/src/components/ResourceFilters.tsx` e `ResourceTable.tsx`: apresentação reutilizável.
- `backend/operations/event_data.py`: contrato tipado e validação dos eventos.
- `backend/operations/event_service.py`: transação, deduplicação e atualização independente de estado, posição e manutenção.
- `pyproject.toml`, `.editorconfig` e `backend/requirements-dev.txt`: convenções e ferramentas de desenvolvimento.

Validação desta etapa: 21 testes Django, 7 testes de domínio e 8 de interface passaram. Ruff, Prettier, Oxlint e build TypeScript/Vite também passaram. As oito verificações PHP e o teste HTTP Django → PHP → CSV foram executados com PHP.wasm; respostas 400 de contrato inválido e 401 de autenticação também foram verificadas. A execução nativa com PHP 8.3 permanece no CI. Docker/MySQL e conferência visual em navegador real continuam entre as validações pendentes.

Referências oficiais: [princípios arquitetônicos e SOLID](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/architectural-principles), [hooks personalizados do React](https://react.dev/learn/reusing-logic-with-custom-hooks), [Ruff](https://docs.astral.sh/ruff/formatter/) e [PSR-12](https://www.php-fig.org/psr/psr-12/).

## Participação de inteligência artificial

ChatGPT/Codex auxiliou na interpretação dos requisitos, planejamento, configuração do ambiente e implementação de código, estilos, testes e documentação. O nome F.E.N.I.X. e seu significado foram propostos pelo participante. A declaração descreve contribuições efetivamente realizadas e deve acompanhar a evolução do projeto. A aplicação não utiliza uma API de IA em tempo de execução.

## Aparência da página inicial

O wallpaper fica em `frontend/src/assets/fenix-wallpaper.webp` e aparece apenas no Início. A interface usa escala CSS de 75% a partir de 901 px de largura, sem alterar a configuração de zoom do navegador. Em telas menores, mantém a escala normal para preservar a leitura. A faixa de demonstração e o botão de conexão foram retirados; o indicador discreto de demonstração permanece no cabeçalho.

A arte foi adaptada com a ferramenta integrada de geração de imagens, usando a imagem de fênix enviada pelo participante. Prompt utilizado:

> Use case: stylized-concept. Asset type: widescreen website homepage wallpaper for F.E.N.I.X., a dark urban mobility dashboard. Adapt the attached phoenix artwork into a refined wide landscape 16:9 painterly wallpaper. Preserve the reference's majestic phoenix with outstretched wings, painterly oil-like texture, amber and gold fire, orange crimson clouds and radiant halo. Place the entire bird and its readable outstretched wings in the RIGHT half, centered around 72% width and 43% height, with a long glowing tail downward. Left 50% should be quiet almost black charcoal-green atmospheric smoke (#141716), subtle warm embers near the bottom, and very low visual detail to allow overlay text. Seamless natural transition from dark left to luminous gold upper-right, dark crimson lower-right. Dramatic but restrained, elegant painterly concept art, not a poster. Keep most edges and lower region dark to blend with #141716 UI. No text, no typography, no logo, no borders, no UI. Output a high resolution wide landscape image.
