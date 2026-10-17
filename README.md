# F.E.N.I.X.

Uma cidade capaz de recomeçar.

Base de desenvolvimento para a etapa bônus do DSIN Coder Challenge 2026. O F.E.N.I.X. faz parte da iniciativa F.O.G.O., no universo do Protocolo PROMETHEUS. A proposta é reunir informações sobre equipamentos e agentes para apoiar a recuperação e a prevenção de falhas na mobilidade urbana.

## Identidade e origem da proposta

F.E.N.I.X. representa **Força, Evolução do Nutrir, Integração e X (Incógnita/Potencial)**. O nome e essa interpretação foram propostos pelo participante. A referência à fênix aproxima o projeto da ideia de renascer das cinzas: recuperar o controle da cidade e usar o aprendizado das falhas para melhorar sua operação. Aqui, nutrir significa alimentar as decisões com informações confiáveis.

A leitura do enunciado organizou o problema em três necessidades: conhecer os recursos, acompanhar o presente e antecipar riscos. Essa divisão orienta as futuras áreas de Inventário, Operação e Prevenção. A narrativa dá identidade ao projeto; as telas devem continuar objetivas para quem trabalha na central.

## Estado atual

Este repositório contém o ambiente inicial, e não a solução completa do desafio.

Disponível: frontend React com TypeScript e Vite; tela inicial responsiva; API Django com verificação de conexão ao banco; SQLite para desenvolvimento; configuração opcional de MySQL com Docker; testes da API e workflow de verificações para GitHub Actions.

Ainda não implementado: cadastros de equipamentos e agentes, mapa, autenticação da central, telemetria, indicadores, manutenção, histórico e análises preditivas. Os três cartões da tela inicial são informativos e estão identificados como em desenvolvimento. Nenhum indicador operacional fictício é apresentado como real.

## Decisões técnicas

React e TypeScript organizam a interface em componentes e tornam os contratos de dados explícitos. Django fornece uma base conhecida para regras de negócio, banco de dados e administração. Essas tecnologias foram escolhidas considerando as competências informadas pelo participante e a necessidade de conseguir explicar a solução.

SQLite permite executar a base sem instalar um servidor de banco. MySQL é a alternativa prevista para integração. O proxy do Vite encaminha `/api` para o Django em desenvolvimento, evitando configuração desnecessária de CORS. Isso não representa uma configuração de produção.

As futuras previsões começarão com regras e estatísticas explicáveis. A intenção é mostrar os dados considerados, o motivo do alerta e a ação sugerida, sem apresentar um índice arbitrário como probabilidade validada. A primeira hipótese a avaliar será o risco de indisponibilidade de equipamentos a partir de falhas recentes e manutenção vencida. Essa regra ainda será especificada e implementada.

## Estrutura

- `frontend/`: interface, estilos e configuração do Vite.
- `backend/config/`: configuração Django, URLs, endpoint de saúde e testes.
- `backend/requirements.txt`: versões instaladas no ambiente Python.
- `backend/requirements-mysql.txt`: dependências adicionais de MySQL.
- `compose.yaml`: banco e API para desenvolvimento com MySQL.
- `.github/workflows/checks.yml`: verificações para pushes e pull requests.
- `.env.example`: valores de exemplo, exclusivos para desenvolvimento local.

## Requisitos

Python 3.12, Node.js 24 e npm. Para a opção MySQL, Docker com Compose v2. As fontes externas da interface são opcionais; se não houver rede, o navegador usa uma fonte local.

## Execução local com SQLite

Execute os comandos a partir da raiz do projeto.

```sh
python -m venv .venv
```

Ative o ambiente no Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
Copy-Item .env.example .env
```

No Linux ou macOS:

```sh
source .venv/bin/activate
cp .env.example .env
```

Instale as dependências e inicie o Django no primeiro terminal:

```sh
python -m pip install -r backend/requirements.txt
python backend/manage.py migrate
python backend/manage.py runserver 127.0.0.1:8000
```

No segundo terminal:

```sh
cd frontend
npm ci
npm run dev
```

Abra http://127.0.0.1:5173. Com o Django e o banco disponíveis, a página deve mostrar “Conexão estabelecida”. O endpoint http://127.0.0.1:8000/api/health/ consulta o banco e devolve `status: ok`; uma falha de banco resulta em HTTP 503, sem revelar dados de conexão.

A administração padrão do Django está em http://127.0.0.1:8000/admin/. Para criar um usuário, execute `python backend/manage.py createsuperuser`. Os modelos de equipamentos e agentes ainda não existem.

## Execução alternativa com MySQL

Copie `.env.example` para `.env`. Mantenha o backend local desligado para liberar a porta 8000. Em seguida:

```sh
docker compose --profile mysql up --build
```

O Compose inicia MySQL e a API, aguarda o banco responder e aplica as migrações. O Dockerfile instala as bibliotecas nativas necessárias ao mysqlclient. Em outro terminal, execute `npm ci` e `npm run dev` em `frontend/` como na opção anterior. Não é necessário alterar `DB_ENGINE` no arquivo `.env`: o Compose define MySQL dentro do contêiner da API.

Para usar Python local com o banco do Docker, instale as bibliotecas de compilação do mysqlclient apropriadas ao seu sistema, instale `backend/requirements-mysql.txt`, altere `DB_ENGINE=mysql` em `.env`, inicie somente `docker compose --profile mysql up -d db` e execute as migrações localmente.

Os dados do MySQL ficam no volume `fenix_mysql`. `docker compose --profile mysql down` encerra os serviços e preserva o volume. As senhas de exemplo servem apenas ao desenvolvimento; configure credenciais próprias antes de qualquer publicação.

## Verificações

Com o ambiente Python ativo:

```sh
python backend/manage.py check
python backend/manage.py test config
```

No diretório `frontend/`:

```sh
npm run lint
npm run build
```

Os testes cobrem banco disponível, banco indisponível e rejeição de métodos de escrita no endpoint de saúde. O build verifica os tipos e gera os arquivos estáticos. GitHub Actions está configurado para executar essas verificações após a publicação do repositório.

O fluxo SQLite foi verificado neste ambiente. A opção MySQL/Docker está configurada, mas não foi executada aqui, pois Docker não está instalado. Ainda é necessário validá-la em uma máquina com Docker antes de considerá-la pronta para entrega.

## Desenvolvimento e entrega

O prazo informado no enunciado é 27/10/2026 às 23h59, no horário da organização. A solução deve evoluir com funcionalidades que o participante consiga demonstrar e explicar. Não enviar `.env`, `.venv`, `node_modules`, bancos locais nem credenciais.

O desenvolvimento previsto seguirá esta ordem: modelos e cadastros; mapa e filtros; manutenção e alertas; eventos simulados com identificação explícita; histórico e prevenção; revisão dos fluxos e vídeo demonstrativo. Essa lista é planejamento, não um histórico de funcionalidades concluídas.

O repositório de desenvolvimento está em https://github.com/Neitolas/fenix e foi criado como privado. Para conectar uma cópia local ainda sem remoto, execute:

```sh
git remote add origin https://github.com/Neitolas/fenix.git
git push -u origin main
```

O acesso remoto usa as credenciais do próprio desenvolvedor. O histórico registra a preparação do ambiente, sem simular etapas ou datas anteriores. Antes da submissão, será necessário disponibilizar o código aos avaliadores conforme as instruções do desafio.

## Participação de inteligência artificial

ChatGPT/Codex foi utilizado para auxiliar na interpretação dos requisitos, organização do raciocínio, proposta de arquitetura, configuração do ambiente e geração da base inicial de código, estilos, testes e documentação. A identidade F.E.N.I.X. e o significado do nome foram fornecidos pelo participante. Esta declaração descreve o trabalho realizado até esta versão e deve ser atualizada conforme novas contribuições ocorrerem.

O uso da ferramenta não se limitou ao planejamento. O participante ainda precisa revisar, executar, compreender e validar o material antes da submissão. Não se presume revisão humana de etapas que ainda não ocorreram. A ferramenta não foi integrada ao funcionamento da aplicação: esta base não usa uma API de IA em tempo de execução.
