# Iron Front — Diagnóstico do passe de polish (Soldier Mode & imersão)

Data: 01/10/2026. Etapas 1–4 do pedido: auditoria, bugs/placeholders, review de UI e brainstorm do Soldier Mode. A implementação vem depois deste documento e está descrita no README (seção "Versão 1.9").

## 0. Baseline medido antes de qualquer mudança

| Medida | Valor |
|---|---|
| Suítes `tests/*.test.cjs` | 15/15 OK (frontline 9,7 s; fortify 2,1 s; demais < 0,6 s) |
| `tools/verify-battle.cjs` (Edge headless, saída redirecionada para o scratchpad) | OK; 317 unidades, 18,55 ms/quadro em média, máx. 20,5 ms |
| Navegador (sandbox, 156 unidades) | `update` 2,29 ms, `render` 4,79 ms |

## 1. Auditoria: o que existe

**Arquitetura.** `game.js` define funções e estado globais (`let units, player, mode, weapon, ammo…`). Os outros módulos fazem `wrap` de `window.update/damage/shoot/explode/protectedBy/render/hud/newUnit`. O desenho é feito no `pixel.js`, que projeta com `ox+round(x*PX.Z)` (Z=.5). O gancho `PHYS.draw` é encadeado por art-medics → medics → assault → sappers → physics.

| Sistema | Onde | Estado |
|---|---|---|
| Unidades | `defs` game.js:10 — rifle, mg, tank, cavalry; pioneiro = rifle com `u.sap` (sappers.js:407) | Só 4 tipos reais; o pioneiro é o único "classe" |
| Feridos | medics.js — `u.down`, `u.bleed`, padioleiros abstratos (`crews`), 2 postos base + `aid` construído; 78% voltam | Funciona, mas é binário: caído → maca → leito → volta/morre. Sem resgate por companheiros, sem estabilização, sem evacuação, sem incapacitação |
| Modo soldado | soldier-combat (ADS, apoio, baioneta, escopeta, snap-crack), soldier-tactics (apito, ping, caído, bandagem, saque), soldier-hud, assault (Z deitar, Q melee, máscara, Over the Top) | Rico em teclas, pobre em contexto: sem arrastar feridos, sem operar MG, sem estado de travessia, supressão = vinheta + texto |
| Construção | sappers/fortify/engineering: trench, sap, comm, wire, sandbag, nest, bunker, pillbox, dugout, aid, mortar, aa, gunf, gunh | Catálogo amplo (14) com estágios e IA construtora |
| Artilharia | battery.js: guarnição de 4 com ciclo aim→load→ready→fire→recoil→eject, contra-bateria, operação manual (E) | Boa. Morteiro do sappers.js:176 dispara sem projétil em voo |
| Aviões | fighter (metralha), bomber (só jogador), recon (frontline.js: −75% dispersão de artilharia, revela névoa) | 3 papéis; sem caça interceptador, sem ataque ao solo distinto, sem observação de artilharia dedicada |
| Áudio | `sound()` game.js:195 (6 sons), sons espalhados em 8 módulos; assault.js:50 intercepta `AudioNode.connect` para um master | Sem mixer, sem prioridade/limite de vozes, sem distância comum, sem ambiente calmo; tiro só toca a < 450 px com 12% de chance |
| Água | `PXW.depth` (weather.js:21); ≥.25 molhado, ≥.55 fundo (nado, afogamento) | Sem estado de travessia; a unidade atira normalmente em água funda |
| Trincheiras | `protectedBy` (game.js:127) e `fieldTrenches`; sem `inTrench` global | Soldado dentro da trincheira usa o mesmo sprite em pé de campo aberto |

## 2. Bugs e placeholders encontrados

| # | Prioridade | Onde | Problema |
|---|---|---|---|
| B1 | P1 | ww1-ambient.js:39 `flag()` (usado em ww1-scene.js:70 QG e :108 posto) | Bandeira **azul/vermelha lisa** no mastro do QG e do posto, em vez da bandeira nacional |
| B2 | P1 | assault.js:275-277 | Bandeira de setor tomado em azul/terracota lisos |
| B3 | P1 | ui-fix.js:9 | Zera `screenShake` antes de todo `render`: a opção "Tremor de tela: SIM" não tem efeito (e o recuo e as explosões do soldado não tremem) |
| B4 | P1 | soldier-tactics.js (caído) | A troca para pistola escreve `window.weapon/ammo/reload`, que não alteram os `let` do game.js: "PISTOLA DE BOLSO" é só texto |
| B5 | P1 | medics.js:22 + soldier-tactics.js:323 | Dois estados de caído (o do jogador e o da IA); `eligible()` exclui o jogador, então padioleiros só o atendem via `callForHelp` |
| B6 | P1 | game.js:144 (sem trava) | Em água funda (≥.55) a unidade continua atirando normalmente |
| B7 | P2 | game.js:67 | `setMode('soldier')` assume o primeiro fuzileiro da lista, muitas vezes na retaguarda longe de tudo |
| B8 | P2 | sappers.js:176-186 | Poço de morteiro: tiro sem projétil em voo (só partícula de 0,25 s) |
| B9 | P2 | frontline.js:222 | Avião de reconhecimento usa sprite genérico, não o modelo citado no cartão (Salmson/Rumpler) |
| B10 | P2 | game.js:7 / index | "Thompson" como SMG americana em 1917–18 é anacrônico (produção 1921) |
| B11 | P3 | title (rodapé) | "VERSÃO 1.2" no rodapé enquanto o README já está na 1.8 |
| B12 | P3 | sappers.js:166 | Comentário diz "x3,2" e o código usa outro fator |

## 3. Review completo da UI

Telas inspecionadas no navegador a 1280×720: título, campanha, briefing, batalha (comandante: abas Tropas/Defesas/Apoio), pausa, opções, resultado (vitória), Modo História, Guia de Campo e modo soldado.

| # | Pri. | Tela / estado | Problema | Ação |
|---|---|---|---|---|
| U1 | P1 | Campanha a 720p | O briefing e o botão INICIAR ficam abaixo da dobra (y=868 em 720 px); a roda do mouse sobre os cartões não rola a vista | Pendente (ui.css é de outra sessão) |
| U2 | P1 | Batalha: canto superior esquerdo | Botões de clima (DINÂMICO/LIMPO/GAROA/CHUVA/TEMPESTADE) aparecem na campanha: controle de depuração que quebra a imersão e o desafio. O painel de clima sobrepõe a linha "A Última Trincheira · Terra de Ninguém" | Pendente |
| U3 | P1 | Soldado | O painel do soldado cobre a linha de dicas ("…S · R RECARREGAR · G GRANADA · E TANQUE/CANHÃO"), e a dica está desatualizada (não cita X, Z, Q, T, F, H, 4, V nem as novas interações) | **Feito**: dica contextual própria (ver README 1.9) |
| U4 | P1 | Soldado | Sem prompt de interação: E faz 4 coisas diferentes (tanque, canhão, saque, socorro) sem dizer qual vai acontecer | **Feito**: prompt "[E] …" sobre o alvo |
| U5 | P1 | Opções | "Tremor de tela" não funciona (B3) | **Feito** no modo soldado: tremor próprio que respeita a opção |
| U6 | P1 | Soldado | Supressão comunicada por texto/barra `SUPRIMIDO ▮▮▮▮` | **Feito**: tremor de mira, dispersão, poeira, vinheta direcional, abafamento |
| U7 | P2 | Comandante | Toast e banner de preparação se sobrepõem ("Operação 1…" sob "PREPARAÇÃO 4:59") | Pendente |
| U8 | P2 | Comandante | Painel de seleção grande mesmo com 0 selecionados | Pendente |
| U9 | P2 | Comandante | Texto de renda truncado ("+12 por segun…") | Pendente |
| U10 | P2 | Aba Defesas | 14 cartões em 3 linhas; nomes truncados ("Comunica…", "Saco de…", "Obuseiro 1…"); cartão "Socorro" sem ícone; atalhos 1–0 não cobrem todos | Pendente |
| U11 | P2 | Resultado | Só tempo e baixas inimigas; faltam baixas próprias, feridos salvos/evacuados, pontos tomados | **Feito**: relatório médico no resultado |
| U12 | P2 | Guia de Campo | Desatualizado (faltam X, Z, Q, T, F, H, V e o socorro) | Pendente (title.js/ui.js de outra sessão) |
| U13 | P2 | Soldado | Ao entrar no modo, o soldado nasce na retaguarda (B7) sem indicação de onde está a frente | Pendente |
| U14 | P3 | Pausa | Ícone de "Reiniciar operação" é a bandeira dos EUA mesmo jogando de Alemanha | Pendente |
| U15 | P3 | Campanha | Operação 01 se passa no mapa "A Última Trincheira" e a operação 06 tem esse mesmo nome | Pendente |
| U16 | P3 | Geral | Textos em Silkscreen a ~6 px reais em 1280×720 (rótulos de cartões, abas, rodapé) | Pendente; a opção "Tamanho da interface" ajuda |

Não houve P0 (nada impede jogar). A identidade visual (madeira escura, dourado, pixel art) está consistente e foi preservada.

## 4. Brainstorm do Soldier Mode × arquitetura real

O brainstorm foi feito por um subagente dedicado, com a missão do pedido. Ele propôs cerca de 45 mecânicas; o TOP 10 dele está resumido abaixo, junto com o que decidi depois de comparar com o código.

| Proposta | O que muda na batalha | Decisão |
|---|---|---|
| Supressão sentida (mira, dispersão, áudio, poeira, vinheta direcional) | Ficar exposto a uma MG custa precisão real e empurra o jogador para a cobertura | **Implementado** (soldier-feel.js) |
| Interação contextual única com prioridade (E) | O soldado passa a fazer trabalho de guerra: arrastar, entregar ao posto, municiar MG | **Implementado** (resolvedor em soldier-feel.js) |
| Arrastar feridos (jogador e IA) | Salvar um ferido custa tempo e exposição; feridos param de sangrar sob cobertura | **Implementado** (casualty.js) |
| Estado caído unificado | Um só `u.down`; o jogador também pode ser arrastado | **Parcial**: o resgate e o arraste tratam o `u.down` do jogador; o caído próprio do soldier-tactics continua |
| Ferrolho, pentes e munição finita | — | Adiado: mexe na economia de munição de 3 módulos |
| Fôlego e peso | — | Adiado |
| Espiar o parapeito | A trincheira protege de verdade quando abaixado | **Implementado** para a IA (postura de trincheira em soldier-life.js) |
| Granada cozida | — | Adiado |
| IA reage e grita (abaixar com explosão, "MÉDICO!", "MG!") | A linha "respira" com a artilharia; os feridos são vistos e socorridos | **Implementado** (soldier-life.js + casualty.js) |
| Operar MG / morteiro | — | MG: adiado (o E de tanque/canhão já existe; falta assumir a unidade mg); artilharia já é operável (battery.js) |
| Cone de visão | — | Adiado (custo de render) |

## 5. Plano deste passe (o que cabe com profundidade)

1. **casualty.js — feridos, resgate e cadeia médica** (seções 2 e 3).
2. **classes.js — classes com função própria** (seção 1): médico, granadeiro, atirador designado, observador de artilharia e tropa de assalto, cada uma com efeito medido em teste.
3. **soldier-life.js — vida e estados contextuais** (seções 4, 5, 13 e 16): travessia de água, postura de trincheira, reação a explosões e microanimações.
4. **soldier-feel.js — Soldier Mode** (seção 12): supressão sentida, E contextual, arrastar, entregar ao posto, dicas.
5. **Bandeiras** (seção 7): QG, posto e setores com as bandeiras nacionais.
6. **soundscape.js — mixer** (seção 15), depois de um brainstorm de áudio dedicado.

Fora deste passe, registrados como pendentes: suporte aéreo expandido, construção expandida, transições de bunker, revisão de sprites de armas coletivas e os itens de UI marcados como pendentes.

## 6. Status depois da implementação

| Item | Status | Onde |
|---|---|---|
| B1 bandeira do QG e do posto | **Corrigido**: bandeiras nacionais | `ww1-ambient.js` `flag()` + `IFK.flagPx` |
| B2 bandeira de setor | **Corrigido** | `assault.js` |
| B3 tremor de tela ignorado | **Parcial**: o modo soldado tem tremor próprio, que respeita a opção; o comandante continua sem tremor (o `ui-fix.js` é de outra sessão) | `soldier-feel.js` |
| B4 pistola do caído fictícia | **Corrigido** (coberto pelo teste `soldier-gear`) | `soldier-gear.js` |
| B5 caído duplicado | **Parcial**: resgate, arraste e cadeia médica tratam o `u.down`; o caído próprio do `soldier-tactics.js` continua para o jogador | `casualty.js` |
| B6 tiro em água funda | **Corrigido** (IA e jogador) | `soldier-life.js` |
| B7 / U13 soldado nasce na retaguarda | **Corrigido**: entra num fuzileiro da linha de contato, com seta para a frente | `soldier-gear.js` |
| B8 morteiro sem projétil em voo | **Corrigido**: arco, rastro, fumaça de boca, "tum" e assobio de chegada | `heavyfx.js`, `soundscape.js` |
| B9 avião de reconhecimento genérico | **Corrigido** por outra sessão (Salmson 2A2 / Rumpler C.IV modelados; ainda não commitado) | `anim-air.js` |
| B10 Thompson anacrônica | **Corrigido** (teste `soldier-gear`) | `soldier-gear.js` |
| B11, B12 | Pendentes | — |
| MG pesada carregada por um homem (seções 1 e 8) | **Corrigido**: a carta vira uma arma servida por 3 (ver seção 7) | `mgcrew.js` |
| U3 dica sob o painel do soldado | **Corrigido**: linha movida e contextual | `soldier-feel.js` |
| U4 E sem aviso | **Corrigido**: prompts "[E] ARRASTAR", "[E] ABRIGO", "E assumir a MG"… | `casualty.js`, `shelter.js`, `soldier-feel.js` |
| U5 tremor | Parcial (ver B3) | — |
| U6 supressão como barra | **Corrigido** no feedback de jogo (terra, câmera, direção, mira); o texto `SUPRIMIDO` do HUD continua | `soldier-feel.js` |
| U11 resultado pobre | **Corrigido**: relatório médico | `casualty.js` |
| U1, U2, U7–U10, U12–U16 | Pendentes (arquivos de UI de outras sessões) | — |

Seções do pedido que **ainda não** foram feitas: parte de 15 (passos, lama e chuva no novo mixer), o restante de 9 (UI) e B11/B12. A parte de 12 que faltava (fôlego, ferrolho, munição finita, granada cozida, cone de visão) entrou no `soldier-gear.js`; a parte visual de 8 para blindados, aviões e explosões está nas camadas `anim-*.js` de outra sessão (ainda não commitadas).

## 7. Guarnição de MG — arma coletiva (`dist/mgcrew.js`, 01/10/2026 à noite)

**Problema.** A carta "Metralhadora · Equipe · 3 soldados" punha em campo 3 unidades `mg`, e cada homem atirava a sua própria MG. O pedido pede o contrário: "metralhadoras pesadas devem parecer armas coletivas".

**O que mudou.** Os 3 homens continuam `type 'mg'`, então custo, contagem da IA, poder nas operações (2,5 cada) e antiaérea não mudam. Eles passam a ser uma guarnição em volta de **uma** arma:

| Papel | Função | O que isso muda |
|---|---|---|
| Atirador | Só ele dispara a MG. Não atira andando e leva 1 s para montar o tripé depois de parar. A IA para e monta quando tem alvo durante um deslocamento (no máximo a cada 8 s) | MG em marcha fica muda: avançar com ela custa tempo |
| Municiador | Ajoelhado do lado esquerdo da arma, com a caixa | Com ele: cadência de 0,13 s e troca de fita em 3 s. Sem ele: 0,30 s e troca em 8 s. Matar o municiador rende |
| Remuniciador | Atrás, de fuzil. Faz as corridas de água para o cano (a corrida abstrata do `frontline.js` vira um homem que pode morrer no caminho) e de caixas de munição | Sem ele, a água volta a ser corrida abstrata, 30% mais longa, e as caixas chegam 1 a cada 45 s |
| Sucessão | Se o atirador cai, o municiador vai até a arma e assume depois de 1,4 s. O calor e a água do cano passam para ele | Derrubar o atirador cala a arma por alguns segundos, mas não a elimina |

Também:
- cano travado: troca em 10 s com guarnição e em 28 s sozinho (antes eram 20 s);
- sobras de guarnições se juntam, e reforços entram na guarnição incompleta mais próxima;
- auxiliar postado num ninho que chega lá vira o atirador;
- ordem dada só a um auxiliar vale para a arma inteira;
- no Modo Soldado, **E** só assume o atirador.

**Desenho.** Em marcha, os auxiliares andam de fuzil, com a marcha de fuzileiro do `anim-infantry.js` e a caixa na mão. Parados, ajoelham ao lado da arma com a caixa, e o municiador a ergue na troca de fita (gancho de 1 linha no `heavyfx.js`). `?guarnicao=0` volta ao comportamento antigo.

**Medido** (`tests/mgcrew.test.cjs`, mini-motor, alvo fixo):

| Medida | Valor |
|---|---|
| 1 min com alvo, guarnição completa | arma 428 tiros (dano 13) + auxiliares 75 tiros de fuzil (dano 30) |
| 1 min, atirador sozinho | 156 tiros |
| Primeiro tiro depois de parar | 1,10 s (30 tentativas bloqueadas em movimento) |
| Atirador morto → arma volta a atirar | 2,63 s |
| Corrida de água pelo remuniciador | 8,3 s (a abstrata sorteada no teste era de 20 s) |
| Caixas acabaram | o remuniciador recuou 178 px e voltou com 2 caixas |

**Batalha real** (Edge headless, mesmo código, com e sem guarnição):
- `balance-battle`, 4 batalhas determinísticas de 180 s: baixas causadas no total, 84 sem guarnição × 107 com; perdas parecidas. Dentro do ruído.
- Batalhas de 160 unidades por 400 s (seeds 907 e 4242): os tiros de MG caem de 1101 → 108 e de 326 → 38. Uma arma servida vê alvo menos vezes que três espalhadas: 11 × 24 amostras com alvo. As baixas variam para os dois lados (40/51 → 60/17 e 61/63 → 38/133); essas batalhas longas são caóticas. É a consequência esperada de transformar três armas em uma. Fica registrado para quem ajusta o balanço: se as defesas ficarem fracas, o ajuste natural é o custo da carta ou o limite de compra de MG da IA (`ai.js:368`), não voltar a dar uma MG a cada homem.
- `verify-battle` (cópia no scratchpad): passou com e sem guarnição, 41,6 × 58,9 ms por quadro em média, com as duas rodando em paralelo (ruído de máquina). Uma rodada anterior falhou em "engenharia continua construindo durante combate" enquanto outras sessões editavam `engineering.js`/`fortify.js`; não se repetiu.
- Suíte: 33 de 34 passam. A falha é `works-manage.test.cjs`, teste novo de outra sessão em edição, que não carrega o `mgcrew.js`. `operations.test.cjs` falhou 1 vez em 21 enquanto o `coordination.js` era gravado (flake).
