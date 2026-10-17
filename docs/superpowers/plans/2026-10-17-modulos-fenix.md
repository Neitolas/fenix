# Módulos F.E.N.I.X. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para executar as tarefas nesta sessão. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar inventário, operação, prevenção e exportação PHP com uma interface navegável.
**Architecture:** Django concentra dados e regras; React consome a API autenticada. PHP gera CSV por contrato interno. Uma demonstração local identificada permite experimentar a interface hospedada sem fingir que o backend está conectado.
**Tech Stack:** React/TypeScript, Django 5.2, SQLite/MySQL, PHP 8.3+, Leaflet.
**Spec:** ../specs/2026-10-17-fenix-completo-design.md

## Global Constraints

- Manter apenas INICIATIVA F.O.G.O. na identificação e não restaurar descrição ou rodapé removidos.
- Reservar no mínimo 80 pixels abaixo do conteúdo.
- Separar demonstração local da API real e manter dados demonstrativos fictícios.
- Autenticar escritas com sessão e CSRF; PHP não recebe credenciais do banco.
- Índice de atenção é heurístico, nunca probabilidade validada.

## Review Focus

- Coordenadas vazias, fora do intervalo e números não finitos devem ser rejeitados.
- Falhas de rede não devem descartar dados do formulário ou mostrar conexão falsa.
- Exclusão lógica deve preservar eventos e não permitir novos eventos em recurso excluído.
- CSV precisa neutralizar fórmulas e respeitar filtros.
- Datas de manutenção e janelas temporais devem usar o mesmo fuso no backend e na demonstração.

### Task 1: Inventário e sessão
**Files:** backend/operations/{models,forms,views,urls,tests}.py; backend/config/{settings,urls}.py.
**Interfaces:** /api/session/; /api/equipment/; /api/agents/; registros serializados em JSON com paginação.
- [ ] Escrever testes de CRUD autenticado, validação, duplicatas, paginação, exclusão lógica e CSRF.
- [ ] Executar testes; confirmar 404 antes dos endpoints.
- [ ] Implementar modelos, formulários, views e migrações.
- [ ] Executar testes e confirmar aprovação; registrar commit.

### Task 2: Eventos, painel e prevenção
**Files:** backend/operations/{services,telemetry,tests}.py; management/commands/seed_demo.py.
**Interfaces:** /api/events/; /api/dashboard/; /api/prevention/; serviço attention(equipment, now).
- [ ] Escrever testes para idempotência, atualização transacional, pontuação, fronteiras de tempo e disponibilidade sem denominador.
- [ ] Verificar falha antes de implementar.
- [ ] Implementar histórico, cálculo explicável e dados idempotentes.
- [ ] Executar suíte e verificar comando de dados duas vezes; registrar commit.

### Task 3: Relatórios PHP
**Files:** reports-php/{index.php,csv.php,tests.php,Dockerfile}; backend/operations/reports.py; compose.yaml.
**Interfaces:** POST /export com segredo interno e até 5.000 linhas; GET /health; /api/reports/equipment.csv autenticado.
- [ ] Escrever testes PHP de acentos, aspas, fórmulas e limite, e teste Python de serviço indisponível.
- [ ] Confirmar falha; implementar validação e escrita CSV nativa.
- [ ] Executar PHP real e verificar download integrado; registrar commit.

### Task 4: Interface
**Files:** frontend/src/{App.tsx,types.ts,api.ts,demo.ts,index.css}; frontend/src/components/.
**Interfaces:** cliente HTTP com erros de campo; demonstração local explícita; telas Início, Inventário, Operação, Prevenção.
- [ ] Verificar regras da demonstração e filtros com testes de funções puras.
- [ ] Implementar navegação, formulários, busca, filtros, mapa, indicadores e explicações.
- [ ] Confirmar compilação e teste das funções; registrar commit.

### Task 5: Entrega
**Files:** README.md; .github/workflows/checks.yml; publicação da interface.
- [ ] Executar testes Python/PHP/TypeScript e compilar frontend.
- [ ] Fazer revisão independente, corrigir achados importantes e repetir verificações afetadas.
- [ ] Atualizar estado real do README, publicar fonte no GitHub e atualizar a visualização privada.
