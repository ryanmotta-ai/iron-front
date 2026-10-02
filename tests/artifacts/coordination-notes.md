# Ações conjuntas da IA — segundo pacote

Implementação em `dist/coordination.js`, integrada ao comandante, sapadores, intenções, formações e painel IA. Nenhuma tropa, estoque ou informação inimiga é criada pela coordenação.

- Apoio contra MG: a infantaria pede cobertura e um grupo de MG assume tarefa distinta. O flanco depende de tropas disponíveis e de contato recente.
- Brecha: usa passagens de arame ou sacos de areia registradas pelo sistema real de sapadores. Requer observação local, apoio de fogo, ausência de arame remanescente e de impacto iminente. Reunião dura no máximo 8 segundos, depois começa a travessia. Prazo total de 34 segundos.
- Defesa: destaca uma equipe para conter um acesso ameaçado. Preserva guarnições e libera a equipe quando o contra-ataque principal assume a prioridade. Prazo de 24 segundos.
- Limite de duas ações simultâneas; participantes persistentes, interrupção com mais de 30% de perda efetiva, ausência de apoio ou indisponibilidade da equipe; 6 segundos de intervalo após encerramento.
- Aprendizado por tipo de manobra e visibilidade, com memória de 16 resultados. Perdas dos participantes originais continuam contando após reforços. Ordens humanas, socorro, mudança de missão e perda de contato cancelam sem registrar derrota ou vitória fictícia. Maus resultados aumentam a força exigida em novas tentativas.
- Corrigida a marca de reserva quando só há um esquadrão de infantaria; ele pode atuar e não fica preso nessa marca após receber reforços.

## Verificações

As 29 suítes disponíveis passaram durante esta entrega. Testes específicos de coordenação cobrem pedidos, apoio indisponível, controle humano, brecha não observada/fechada/bombardeada, preparação e travessia, perdas com reforços, contenção, aprendizado e desligamento. As suítes de operações e aprendizado passaram novamente após os refinamentos finais.

A integração de batalhas completas passou nos três mapas, com papéis espelhados, preparação, economia e controle humano. O cenário focado de navegador verifica o registro nativo de uma brecha, tarefas de reunião, assalto e apoio, painel e desligamento dinâmico sem reiniciar a partida. Resultados focados em `joint-report.json`; reprodução: `node tools/verify-human.cjs --browser-only --joint-only`.

O segundo percurso completo também passou pelas verificações de batalha, mas seu primeiro cenário de brecha falhou porque o próprio teste reinicializava os sapadores e transformava toda a infantaria em pioneiros. Corrigido o cenário, ele revelou a marca indevida de reserva do único esquadrão; a correção foi feita no comandante e recebeu regressão própria.

Ainda não foi executada a matriz completa de equilíbrio entre mapas, clima, escalas e sementes. Fintas, inteligência por sons e memória entre partidas continuam futuras.
