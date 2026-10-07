# Refino geral — 03/10/2026

## Batalha e IA

Os setores continuam definindo o acesso de um ataque, mas a infantaria converge para a posição real da bandeira após atravessar a linha avançada inimiga. Progresso e consolidação usam o objetivo real. Chegar à retaguarda em uma altura diferente deixa de ser confundido com alcançar a base. Metralhadoras acompanham a infantaria avançada, inclusive quando ela começa a convergir. O minimapa marca a bandeira como objetivo final.

A seleção de alvos deixa de escolher soldados caídos. Um alvo que cai, morre ou sai de alcance provoca nova busca imediatamente. Tropas sem alvo respeitam o intervalo de 0,4–0,52 segundos já usado pelo sistema, evitando repetir uma busca vazia a cada quadro. O soldado controlado pelo jogador mantém sua própria mira.

O comando aéreo consulta aviões e pilotos efetivamente prontos antes de escolher uma missão. A indisponibilidade de caças não bloqueia um observador ou bombardeiro disponível. Regras de clima, orçamento, manutenção, reserva terrestre e proteção de aliados continuam valendo.

## Controle e informação

Ordens gerais e formações incluem combatentes disponíveis, preservando médicos, pioneiros e resgates. Pioneiros e médicos podem receber uma ordem quando selecionados explicitamente e disponíveis. Feridos, mortos, transportados e equipes em resgate ficam fora dessas ordens. Destinos de movimento respeitam o mapa e uma nova ordem descarta o caminho anterior.

As bandeiras da interface são botões que levam a câmera até a base, mostram disputa e progresso de captura e conservam o foco de teclado entre atualizações. Um aviso informa quando a própria base entra em disputa. O contador de unidades explica combatentes, pioneiros, médicos e feridos que ainda ocupam vagas.

Cartões informam falta de suprimentos, espaço para o grupo inteiro, preparação, clima ou ausência de aviões prontos. Conversas, rádio e intenção tática acompanham a altura da barra de comandos. Atalhos do jogo respeitam campos de formulário e ativação de botões pelo teclado. Cancelar um gesto de seleção limpa seu estado.

## Campanha e modo soldado

Capítulos que começam como soldado usam comando aliado automático. Operações no modo comandante mantêm o comando manual da facção do jogador. A campanha usa 80 unidades por lado na introdução, 120 nas operações intermediárias e 160 na ofensiva final; o sandbox conserva todas as escalas disponíveis. Textos foram alinhados às duas bandeiras na retaguarda e à remoção anterior da neblina visual.

## Verificação

As 44 suítes de testes passaram. O teste de integração `tools/verify-game-refinement.cjs` cobre comandos e serviços, cartões, foco de teclado, captura, disponibilidade aérea, visibilidade e três partidas de 180 segundos simulados com economia finita. Um cenário de passagem pelo flanco foi reproduzido para ambas as facções: tropas alcançaram e capturaram a bandeira real, encerrando a partida em vitória.

No cenário isolado de 240 fuzileiros separados e sem alvos próximos, foram contadas 28.800 buscas no comportamento anterior e 1.104 com o intervalo corrigido em dois segundos simulados: redução de aproximadamente 96%. Essa medida se refere a buscas de alvo naquele cenário; não representa ganho de FPS em toda partida. Tempos de atualização e resultados das partidas estão em `tests/artifacts/game-refinement-report.json`.

`tools/ui-geometry.cjs` verificou menu, campanha e abas de tropas, construções e apoio em 1280×720 e 1366×768, sem sobreposições nos painéis medidos. As amostras confirmam funcionamento e desempenho local; não estabelecem equilíbrio de vitória em campanhas longas.
