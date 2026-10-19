# Guia técnico

[Voltar à apresentação do projeto](../README.md)

Este guia reúne opções de desenvolvimento, regras de cálculo, testes e implantação. Para uma primeira avaliação, siga a execução Docker no README.

## Executar o projeto integrado

Requisitos: Python 3.12, Node.js 24, npm e PHP 8.3 ou superior. Para MySQL, Docker com Compose v2. Não é preciso contratar um serviço pago para executar localmente.

```sh
git clone --branch refactor/qualidade-codigo https://github.com/Neitolas/fenix.git
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

Neste ambiente, PHP foi executado por PHP.wasm, do WordPress Playground, inclusive na integração HTTP Django→PHP→CSV. O CI também executa PHP 8.3 nativo e o conjunto Docker com MySQL. Testes de componentes usam DOM simulado; os testes E2E descritos neste guia usam Chromium e WebKit reais. Nenhum deles garante disponibilidade dos mapas externos.

## Configuração para produção

`config.settings_production` mantém a configuração local separada e exige uma chave Django aleatória de pelo menos 50 caracteres, token de relatórios com pelo menos 32 e uma lista explícita de hosts, sem curinga. O perfil desativa DEBUG, exige HTTPS e usa cookies seguros. O exemplo `.env.production.example` contém campos vazios para os segredos; preencha uma cópia `.env.production`, que está ignorada pelo Git. Não copie as credenciais locais para produção.

Em Linux, depois de preparar banco, serviço PHP e um proxy HTTPS que sirva a interface e encaminhe `/api` e `/admin` à API na mesma origem:

```sh
python -m pip install -r backend/requirements-production.txt
set -a
. ./.env.production
set +a
python backend/manage.py check --deploy
python backend/manage.py migrate
python backend/manage.py collectstatic --noinput
python -m gunicorn --chdir backend config.wsgi:application --bind 127.0.0.1:8000 --workers 2 --no-control-socket
```

As dependências MySQL podem exigir compilador, `pkg-config` e cabeçalhos do cliente MySQL; o Dockerfile já instala esses pacotes. A imagem da API usa Gunicorn e usuário sem privilégios por padrão. O Compose existente continua sendo uma alternativa de desenvolvimento e seleciona explicitamente `config.settings` com `runserver`.

Configure o proxy para servir `backend/staticfiles` em `/static/`. `DJANGO_TRUST_PROXY_SSL_HEADER` começa desativado: só o habilite se o proxy remover o cabeçalho enviado pelo cliente e definir `X-Forwarded-Proto` corretamente. Sem isso, o redirecionamento HTTPS pode entrar em ciclo atrás do proxy.

HSTS começa com 3.600 segundos. Inclusão de subdomínios e preload são decisões explícitas: ficam desativados no exemplo e geram os avisos W005/W021 de implantação. Só ative ambos após garantir HTTPS em todos os subdomínios; preload também exige `DJANGO_HSTS_SECONDS` de pelo menos 31536000. Os testes verificam o perfil completo com essas opções habilitadas, além da rejeição de credenciais inadequadas. Nenhum aviso de segurança foi silenciado no projeto.

Essa preparação não implanta Django/PHP no site estático do ChatGPT. O serviço PHP do Compose usa o servidor CLI para desenvolvimento; uma implantação pública completa ainda requer hospedagem adequada do PHP, TLS, backup e validação da infraestrutura real. Referência: [checklist oficial do Django 5.2](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/).

## Testes em navegadores reais

`frontend/e2e/central.spec.ts` verifica navegação, ausência de rolagem horizontal na página, cadastro persistido, sessão autenticada, cadastro/exclusão no servidor, evento de falha e download CSV pelo PHP-FPM. A configuração cobre Chromium de desktop, Chromium com emulação de celular, WebKit com emulação de iPhone e uma tela de 320 px. Emulação não substitui teste em um aparelho físico.

O job `integrated-browser` constrói as imagens do conjunto completo, aguarda os serviços, cria um usuário temporário e instala os navegadores somente no runner do GitHub. Capturas da área visível de cada aba, do mapa e do histórico, rastros de falhas e relatório HTML são publicados no artefato `browser-validation`. As capturas usam escala CSS e são divididas por área para respeitar o limite de tamanho de imagem do WebKit em páginas longas. O comando, com o conjunto já em execução e um usuário temporário configurado por `E2E_USERNAME`/`E2E_PASSWORD`, é:

```sh
cd frontend
npm ci
npx playwright install --with-deps chromium webkit
npm run test:e2e
```

Os testes usam um perfil de navegador isolado e aceitam apenas para essa execução o certificado local autoassinado. Não alteram a configuração de certificados do navegador pessoal.


### Ajustes encontrados pela revisão visual

Os seletores usam aparência própria e esquema escuro para evitar fundos claros com texto de baixo contraste no WebKit. O indicador da aba ativa não herda a borda do estado de hover de outro botão.

Quando o fundo do mapa falha, a camada é removida e um aviso explica que pontos e listas continuam disponíveis. O provedor padrão usa a URL oficial `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. O Nginx mantém `strict-origin-when-cross-origin` para não suprimir a referência de origem em solicitações legítimas de mapas. Disponibilidade do serviço externo não é garantida.

Os testes de navegador interceptam e abortam as solicitações ao provedor externo para testar explicitamente a alternativa sem mapa base, sem gerar tráfego automatizado nos servidores comunitários. Isso valida o componente Leaflet, seus pontos e os fluxos da aplicação, mas não certifica o serviço de mapas externo. Referência: [política oficial de mapas do OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/).
