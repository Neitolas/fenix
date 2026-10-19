# F.E.N.I.X.

**Uma cidade capaz de recomeçar.**

Projeto para a etapa bônus do **DSIN Coder Challenge 2026**, inspirado na iniciativa F.O.G.O. e no universo de PROMETHEUS. A proposta é reunir os recursos da cidade em uma única visão: conhecer o que está disponível, acompanhar a operação e identificar situações que exigem atenção antecipada.

## O que o projeto faz

| Módulo | O que permite fazer |
| --- | --- |
| Inventário | Cadastrar, consultar, editar e excluir logicamente equipamentos e agentes. Registrar localização, situação, características e manutenção. |
| Operação | Localizar recursos no mapa, aplicar filtros, acompanhar indicadores e alertas e consultar o histórico de eventos. |
| Prevenção | Consultar um índice de atenção, entender os fatores da pontuação e comparar falhas recentes com o período anterior. |

A solução também oferece relatórios CSV na execução integrada, autenticação e interface adaptada a celulares. Os exemplos são fictícios e compartilhados entre os três módulos: câmeras Sentinela 360, radares Via Segura 60, viaturas Patrulha Urbana e agentes como Ana Martins e Bruno Lima.

## Como a solução foi pensada

F.E.N.I.X. representa **Força, Evolução do Nutrir, Integração e X (Incógnita/Potencial)**. O nome remete ao renascimento: reconstruir, recuperar o funcionamento e aprender com as falhas. “Nutrir” significa alimentar decisões com informações confiáveis.

React e TypeScript cuidam da interface. Django centraliza os cadastros, o histórico e as regras. PHP gera relatórios CSV sem acessar diretamente o banco. A execução completa utiliza MySQL; o desenvolvimento local também pode usar SQLite.

A prevenção usa regras explicáveis de manutenção e histórico. O índice vai de 0 a 100 e **não representa uma probabilidade estatística de falha**. A tela apresenta os motivos da pontuação e recomendações para apoiar a decisão.

## Conjunto completo com HTTPS

Este é o caminho recomendado para avaliar todos os recursos, incluindo banco de dados, autenticação e relatórios. Tenha **Git, Python 3.12, Docker com Compose e OpenSSL** disponíveis. No Windows, mantenha o Docker Desktop iniciado.

### 1. Baixe o projeto

```sh
git clone --branch refactor/qualidade-codigo https://github.com/Neitolas/fenix.git
cd fenix
```

### 2. Prepare a configuração

Copie o arquivo de exemplo para criar sua configuração local.

No Windows PowerShell:

```powershell
Copy-Item .env.full.example .env.full
```

No Linux ou macOS:

```sh
cp .env.full.example .env.full
```

Abra `.env.full` em um editor. Preencha os quatro campos de segredo: `DJANGO_SECRET_KEY`, `REPORT_SERVICE_TOKEN`, `MYSQL_PASSWORD` e `MYSQL_ROOT_PASSWORD`. Gere um valor diferente para cada campo executando este comando quatro vezes:

```sh
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

Mantenha os hosts locais informados no exemplo. Não compartilhe esse arquivo nem suas senhas.

### 3. Inicie a aplicação

Execute na pasta principal do projeto:

```sh
python scripts/create_local_tls.py
docker compose --env-file .env.full -f compose.full.yaml up --build --detach --wait
docker compose --env-file .env.full -f compose.full.yaml exec api python manage.py seed_demo
docker compose --env-file .env.full -f compose.full.yaml exec api python manage.py createsuperuser
```

A primeira inicialização pode demorar enquanto o Docker baixa e constrói os serviços. A carga de exemplos cria 12 equipamentos, seis agentes e eventos fictícios. Pode ser repetida sem duplicar registros nem substituir personalizações. Escolha seu próprio usuário e senha no último comando.

### 4. Abra e entre no sistema

Abra [a administração local](https://localhost:8443/admin/) e entre com o usuário criado. Depois, acesse [a aplicação](https://localhost:8443/) ou recarregue a página para que ela reconheça a sessão.

O certificado é autoassinado e exclusivo para teste local; o navegador exibirá um aviso. Use `localhost` nos dois endereços para manter a mesma sessão.

### 5. Encerre quando terminar

```sh
docker compose --env-file .env.full -f compose.full.yaml down
```

Os dados permanecem no banco para a próxima execução. Não acrescente `-v` se quiser preservá-los.

## Roteiro rápido de avaliação

1. No **Inventário**, consulte os exemplos, filtre por bairro e cadastre um equipamento. Edite sua situação e confira os dados nos detalhes.
2. Na **Operação**, localize o recurso no mapa e registre uma falha. Observe a mudança de situação, o alerta e o histórico. Na conexão com o servidor, os dados são atualizados a cada cinco segundos.
3. Na **Prevenção**, consulte a pontuação, os fatores e as recomendações. Registre uma manutenção concluída e acompanhe a mudança.
4. Exporte um **CSV** para conferir o relatório dos recursos filtrados. Essa função exige a execução integrada e uma sessão autenticada.

## Demonstração da interface

A [visualização no ChatGPT](https://fenix-interface-neitolas.pink-loach-9049.chatgpt.site) tem acesso restrito ao proprietário. Para avaliadores externos, utilize as instruções de execução acima.

A demonstração usa exemplos salvos apenas no navegador. Permite experimentar cadastros, filtros e eventos, mas não hospeda Django, PHP ou MySQL e não oferece exportação CSV. Alterações nesse modo não são enviadas ao servidor.

## Qualidade e validação

O código separa interface, validação e regras por responsabilidade, reutiliza componentes e evita duplicação desnecessária. As operações de cadastro incluem validação, autenticação e proteção CSRF. A exclusão é lógica, preservando o histórico, e o recebimento de eventos evita duplicações.

Na validação integrada foram aprovados 30 testes do frontend, 30 testes Django com integração HTTP habilitada, oito verificações PHP e oito cenários de navegador. O conjunto completo com HTTPS foi validado em Chromium e WebKit, com tamanhos de tela de desktop e celular, incluindo 320 px. Os [resultados da validação](https://github.com/Neitolas/fenix/actions/runs/39189329717) estão disponíveis no GitHub Actions.

## Limitações conhecidas

- O mapa depende de um provedor externo. Se o fundo não carregar, a aplicação informa a falha e mantém os pontos e as listas disponíveis.
- A análise preventiva usa exemplos fictícios e regras explícitas; não é um modelo de aprendizado de máquina nem uma previsão de criminalidade ou tráfego.
- O histórico apresenta os 200 eventos mais recentes. O inventário é carregado na memória do navegador; bases maiores exigem evolução dos filtros e indicadores no servidor.
- Os testes de celular utilizam emulação. A conferência em aparelhos físicos permanece pendente.
- A execução Docker está configurada para acesso local. Uma implantação pública exige servidor, domínio, certificado válido e política de backup.

## Para desenvolver ou aprofundar

O [guia técnico](docs/guia-tecnico.md) reúne a execução manual, as regras de pontuação, os comandos de teste e as orientações de produção.

## Participação de inteligência artificial

O desenvolvimento contou com apoio do **ChatGPT/Codex** na interpretação dos requisitos, planejamento, configuração do ambiente, implementação e refatoração de código, ajustes de interface, testes e documentação. A arte de fundo foi adaptada com geração de imagens a partir de uma referência enviada pelo participante.

O participante propôs o nome F.E.N.I.X. e seu significado, direcionou a proposta e solicitou os ajustes funcionais e visuais. A contribuição da IA incluiu implementação, além do apoio ao raciocínio. A aplicação não utiliza uma API de IA durante sua execução.
