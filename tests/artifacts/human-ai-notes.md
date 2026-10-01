# Expansão da IA — validação de 01/10/2026

Pacote disponível: liderança, perfis e moral de esquadrão; intenções estáveis; recuperação local; reconhecimento com obstáculos, atraso e confiança; flanco com apoio, recuo coberto e avanço em trechos de trincheira; integração aos depósitos nativos; aprendizado contextual limitado.

## Verificação concluída

- 27 suítes de `tests/*.test.cjs` passaram, além dos casos focados em `tools/verify-human.cjs`.
- Casos novos verificam perda e substituição de líder, recuperação, prioridade humana, médico e resgate, patrulhas, exigência de apoio para flanquear, posição relatada sem rastreamento invisível, confiança e expiração, contexto aprendido sem inimigos ocultos e depósito destruído.
- Duas rodadas de integração no Edge passaram: combate de 360 segundos, outros dois mapas com atacante espelhado e 180 segundos de Conquista com economia real. A segunda rodada inclui as últimas regras de reabastecimento e as verificações extras de liderança, médico, jogador controlado, opção para desligar e reinício.
- Na rodada final, o atacante entrou em avanço nos checkpoints de 91, 151, 241 e 271 segundos, e em retirada em 181 segundos. Em 301 segundos defendia conquistas antes de retomar o ciclo. O defensor manteve defesa e respondeu com contra-ataques locais.
- Conquista: saldo mínimo 76,09; máximo de 3 obras adaptativas simultâneas; investimentos de 516 e 646 suprimentos. Sem saldo negativo.
- Verificação final: 23 esquadrões, 21 líderes, moral dentro dos limites, 140 relatos; médico e combatente controlado preservados; desligamento e limpeza de memória aprovados; nenhum erro de execução capturado.

## Custo e limites

Na última amostra, o comando geral com 314 unidades levou em média 55,18 ms e no máximo 79,20 ms, com a máquina ocupada. Esse é o custo de uma decisão do comandante, não de cada quadro nem uma medida isolada desta expansão. O relatório inclui todos os módulos atuais do jogo. Ainda falta uma comparação de desempenho e equilíbrio com sementes e configurações repetidas entre expansão ligada/desligada.

As simulações mostram integração e continuidade da ofensiva; não demonstram equilíbrio em todos os mapas, dificuldades e escalas. A matriz de 108 cenários e avaliação por partidas jogadas continuam previstas. Fintas, inteligência por sons, protocolo completo de apoio, assalto dedicado a brechas e memória entre partidas continuam no roteiro.

Reprodução: `node tools/verify-human.cjs`. Somente integração de navegador: `node tools/verify-human.cjs --browser-only`. Resultados detalhados e imagens em `battle-report.json`, `preparation.png` e `battle-tactics.png`.
