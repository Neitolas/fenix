# Progresso — plano: 2026-10-17-modulos-fenix.md

Execução direta solicitada pelo participante em 17/10/2026. A especificação existente orienta a implementação. Interface hospedada continuará sem backend Python/PHP; demonstração local será identificada explicitamente.

Pré-verificação: equipamentos e agentes são os recursos dos eventos; os mesmos filtros devem alimentar inventário, mapa e indicadores. Relatórios consomem somente a lista filtrada já autorizada no Django.

Task 1: complete — CRUD, validações, sessão e CSRF passaram em testes Django.
Task 2: complete — histórico idempotente, pontuação e painel passaram; seed executado duas vezes sem duplicação.
Task 3: complete — oito verificações PHP passaram, e chamada Django→PHP com download HTTP 200 foi executada com PHP.wasm (WordPress Playground). Docker não disponível para testar a distribuição em contêiner.
Decisão: demonstração local fica isolada e identificada na interface; exportação PHP permanece indisponível nesse modo, pois depende do serviço real.
Decisão: falha simulada marca manutenção imediata; por isso, o teste desse fluxo considera 40 pontos de manutenção e 10 da falha, sem acumular a pontuação de manutenção programada.

Task 4: complete — três módulos navegáveis, formulários, mapa e histórico; demonstração persistida e identificação explícita. Folga inferior de 96 px (80 px no celular), sem rodapé.
Task 5: complete — revisão independente identificou cinco problemas corrigidos: estrutura Compose, ordenação independente da telemetria, identidade da demonstração, persistência histórica de coordenadas/estado e busca Unicode consistente com CSV. Testes regressivos adicionados.
Validação final: 19 testes Django, 7 de domínio e 4 de interface passaram; lint, build TypeScript/Vite e 8 verificações PHP passaram. Migração 0002 aplicada no SQLite local. YAML Compose analisado com estrutura de serviços/dependências verificada; validação oficial docker compose config incluída no CI, pois Docker não está instalado aqui. Conferência visual em navegador real e execução MySQL/Docker continuam pendentes conforme README.
