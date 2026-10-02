# Iron Front — Pixel Battlefield

## Expansão da IA: liderança, reconhecimento e manobras

**Ações conjuntas:** esquadrões pedem apoio contra MGs; uma equipe de fogo recebe a cobertura e a infantaria contorna. Brechas reais de arame e sacos de areia entram no planejamento quando observadas, abertas e fora de impactos iminentes. O assalto reúne brevemente, atravessa e ocupa o outro lado com apoio. O defensor destaca uma reserva para conter acessos sem consumir todas as guarnições. Missões conservam participantes, têm prazo e terminam diante de perdas ou mudança de prioridade. O painel IA mostra essas ações. `?coordenacao=0` desliga esta camada; implementação em `dist/coordination.js`, com testes próprios.

Esquadrões têm líderes substituíveis, perfis discretos e moral coletiva. Perdas e supressão podem provocar uma reorganização local curta, enquanto outros grupos mantêm pressão. Intenções estáveis reduzem mudanças pequenas de destino, e grupos bloqueados tentam outro acesso. Ordens humanas, médicos, resgates e emergências locais conservam prioridade.

O comando usa contatos com origem, idade e confiança, verifica obstáculos e recebe relatos distantes com atraso de 2 segundos. Posições não vistas ficam congeladas e expiram após 35 segundos; as antigas aparecem pontilhadas no minimapa. Patrulhas podem retornar diante de força superior. Infantaria tenta flanquear MGs quando há apoio real, recua alternando cobertura e avança por trechos ao combater na trincheira.

Grupos selecionados com poucas granadas procuram depósitos aliados próximos, com estoque e sem inimigos observados nas imediações. A engenharia pode construir depósitos nativos conforme a necessidade e reconhece estruturas destruídas. O aprendizado diferencia terreno, visibilidade e ameaça observada, com influência limitada para manter iniciativa.

O painel IA mostra os estados dos esquadrões; líderes aliados recebem marca e barra discreta de moral. A opção de táticas controla os sinais no campo. `?humanizar=0` desliga esta expansão para comparação. Memória apenas durante a partida. Escopo entregue e etapas futuras: `PLANO-EXPANSAO-IA.md`. Verificação conjunta: `node tools/verify-human.cjs`.

## Engenharia adaptativa e formações

Durante o combate, a IA escolhe novas trincheiras, ninhos, abrigos, ligações de comunicação, postos médicos e apoio conforme a ocupação dos setores. Bunkers respondem à pressão; antiaéreas dependem de ataques aéreos observados e canhões só são propostos em mapas com baterias funcionais. Avanços com tropas suficientes podem receber cobertura perto da nova posição. O plano evita obras duplicadas, terreno alagado, inimigos observados próximos e impactos iminentes.

O orçamento conserva 140 suprimentos para combate (260 com menos de 18 combatentes), limita os investimentos recentes a uma parcela da renda e reserva dinheiro para a próxima obra. A preparação também guarda 200 suprimentos e procura uma obra acessível quando outra está cara. Projetos rejeitados devolvem o pagamento. Ninhos usam metralhadoras existentes, respeitando ordens humanas, sem criar tropas gratuitas.

A engenharia avalia a ocupação da cobertura pelos aliados e a sobrevivência da estrutura depois de concluída. Obras pouco utilizadas ou destruídas reduzem a preferência pelo tipo; perdas também desestimulam o mesmo local por alguns minutos. Essa avaliação é uma aproximação da utilidade, não uma garantia de vitória. O painel IA mostra o investimento e as avaliações. A memória começa novamente em cada partida.

Soldados ocupam posições espaçadas no eixo da trincheira, com preferência pela posição anterior e espaço reservado aos combatentes sob controle humano. Esquadrões mantêm lugares nas formações de cunha, linha ou dispersão; passagens difíceis exigem coluna. A avaliação de cada formação compara progresso e perdas dos mesmos participantes, e orienta as escolhas seguintes. A física e as reações locais ainda podem quebrar temporariamente uma formação sob fogo.

Implementação: `dist/engineering.js` e `dist/formations.js`; verificação em `tests/engineering.test.cjs`, `tests/formations.test.cjs` e `tools/verify-battle.cjs`.

## Aprendizado durante a batalha

A IA registra o resultado das operações e compara quatro abordagens por setor: avanço combinado, flanqueamento, ruptura blindada e infiltração cautelosa. Conquistas aumentam a preferência pela manobra usada; falta de progresso e perdas reduzem essa preferência e abrem espaço para testar alternativas. Só entram na avaliação os participantes da operação. Reforços novos não escondem as perdas, e soldados assumidos pelo jogador saem dessa avaliação.

Um mapa de experiência registra locais em que aliados sofreram dano. As rotas passam a evitar concentrações de baixas mesmo quando o inimigo deixou de ser visto; esse perigo estimado perde força e desaparece após cinco minutos sem novos incidentes. Observações repetidas de metralhadoras e blindados também ajustam a compra de reforços e a prioridade de apoio, mantendo as checagens de fogo amigo.

O defensor aprende quais setores recebem pressão, antecipa reservas e desloca parte das metralhadoras para acessos recorrentes. Contra-ataques malsucedidos aumentam a força exigida para tentar novamente. Ataques que sofreram perdas passam a conservar mais reservas nas próximas operações.

O painel **IA** mostra a última conclusão e o total de operações avaliadas; a intenção no campo inclui a manobra escolhida. O aprendizado usa informações observadas e resultados próprios, tem memória limitada e começa do zero em cada nova partida. É adaptação tática por resultados, com exploração de alternativas, sem treinamento externo ou leitura de inimigos ocultos. Implementação em `dist/learning.js`, integrada a `operations.js`. Testes em `tests/learning.test.cjs`.

## Refino do equilíbrio de combate

A força para liberar ataques conta apenas combatentes disponíveis, com vida e supressão consideradas. Perdas e progresso são calculados a partir dos participantes originais da ofensiva: reservas não confundem o progresso, compras novas não escondem baixas e perdas em outros setores não interrompem um avanço saudável. A cautela recente diminui gradualmente para permitir novas tentativas.

O defensor destaca guarnições para objetivos próximos e pode tentar recuperar posições anteriormente suas dentro da própria metade do campo, com força suficiente e prazo de 30 segundos. Contra-ataques têm 12 segundos de recuperação. Compras recompõem a infantaria quando falta; tanques automáticos conferem aliados antes de cada disparo. Os danos e preços das armas permanecem iguais.

As contas, limites da amostra e comparação de quatro cenários com papéis espelhados estão em `tests/artifacts/balance-notes.md`. Reprodução: `tools/balance-battle.cjs`, com Playwright disponível via `NODE_PATH`.

## Ritmo do atacante

O atacante reconhece por 5 segundos e prepara fogo por pelo menos 6, liberando acessos pouco defendidos mais cedo. Mantém aproximadamente 16% dos esquadrões de infantaria em reserva (a experiência de perdas pode aumentar essa proporção). Ao conquistar um objetivo, retoma o ciclo após 10 segundos de consolidação; a reorganização após um fracasso leva pelo menos 12 segundos. Reuniões sem força suficiente procuram outro acesso mais cedo.

Sem contato observado, os esquadrões continuam avançando. Com resistência, cerca de um terço dos grupos alterna cobertura em ciclos de 6 segundos, enquanto os demais se movem. A infiltração usa ciclos de 9 segundos. A IA conserva os limites de perdas, supressão, falta de progresso e apoio contra posições fortes. O defensor mantém seu ritmo e sua proporção de reservas.

## IA de operações — setores, esquadrões e defesa dinâmica

A IA agora divide o campo em cinco setores e mantém esquadrões entre decisões. O atacante escolhe um esforço principal, mantém uma reserva e exerce pressão num acesso secundário. As operações passam por reconhecimento, reunião, preparação, avanço alternado, consolidação e reorganização. A passagem ao avanço depende da força disponível, da supressão e do apoio; ataques sem progresso ou com perdas importantes são interrompidos, e a memória do fracasso reduz a preferência pelo mesmo acesso nas próximas tentativas.

O defensor distribui posições e metralhadoras pelos acessos, conserva reservas e pode recuar para posições realmente atrás da primeira linha. Contra-ataques respondem a invasões locais, têm duração limitada e encerram quando a brecha deixa de estar ameaçada. A defesa não participa do antigo ciclo automático de ondas.

As rotas usam trechos intermediários que avaliam fogo inimigo observado, impactos iminentes, cobertura, concentração de aliados, arame, lama, água e gás. A física continua responsável por contornar sólidos. Tanques procuram romper a linha, parte da infantaria os escolta e as metralhadoras avançam como apoio. Pioneiros direcionam suas sapas para o setor da operação. Informações sobre inimigos não vistos desaparecem após 35 segundos.

Os assaltos automáticos usam apenas os homens designados pelo comandante e conservam sinalizador, apitos e saída escalonada, sem bloquear a coordenação com ordens artificiais de jogador. A guarnição automática passa ao comandante ao terminar a preparação; ordens humanas, o combatente controlado, sapadores ocupados e feridos continuam respeitados. Missões de fumaça coordenadas reservam munição adequada, não se transformam em alto-explosivo e só contam como cobertura quando a fumaça aparece no campo.

**Para assistir:** ligue as duas IAs no Sandbox e escolha quem ataca/defende, ou deixe os dois lados atacarem. A intenção da sua facção aparece sobre o campo. No painel IA, **TÁTICAS NO MAPA** liga/desliga o texto e as indicações de setores e deslocamentos no minimapa. O desenho mostra planos aliados, sem revelar inimigos ocultos.

Arquivos: `dist/operations.js` coordena as operações; `dist/tactics-view.js` mostra as intenções e limpa o estado a cada partida. Integrações em `ai.js`, `game.js`, `assault.js`, `fortify.js`, `sappers.js` e `battery.js`.

Verificação: `node tests/operations.test.cjs` cobre etapas, persistência, reservas, captura, fracassos, defesa, ordens humanas, informação limitada, fumaça e rotas. Os testes de bateria e assalto também cobrem a integração. `tools/verify-battle.cjs` usa Playwright, um servidor local temporário e Edge para testar preparação, batalha, papéis espelhados, os três mapas e a interface; a instalação de Playwright pode ser indicada por `NODE_PATH`. Os resultados ficam em `tests/artifacts/`. A navegação de risco é uma aproximação por trechos, e o equilíbrio de forças ainda deve ser ajustado a partir de partidas jogadas.

Jogo original de guerra em 2D e pixel art, executado em Canvas 2D, sem instalação ou bibliotecas de jogo externas. A interface está em português.

## Jogável
- Modo comandante: seleção por arrasto, movimento com clique direito, avanço, defesa, recuo e formações em linha (F) ou coluna (C).
- Modo combatente: WASD, mira com mouse, fuzil, submetralhadora e pistola (teclas 1/2/3), recarga e granadas. E assume um tanque aliado próximo.
- Infantaria, equipes de metralhadora, cavalaria com investida corpo a corpo e tanques com IA autônoma.
- Trincheiras, sacos de areia, arame farpado e bunkers construíveis.
- Cobertura nas construções, árvores e ruínas, com proteção indicada no HUD do combatente.
- Apoio de artilharia, bombardeio e caça de metralhamento; explosões e metralhamento podem causar fogo amigo.
- Três mapas originais, conquista com captura e vitória/derrota, e sandbox livre.
- Suprimentos próprios por facção, reforços comprados, dificuldade, minimapa, zoom e áudio sintetizado.
- Controles de toque para combate e ordens rápidas do comandante em telas pequenas.

## Referências consultadas em 30/09/2026
- https://store.steampowered.com/app/1560250/Rising_Front/
- https://steamcommunity.com/app/1560250/announcements/

Rising Front é um jogo single-player de combate e comando com grandes batalhas, infantaria, tanques, cavalaria, aviões, apoio, construção, cobertura e conteúdo Workshop. As notas oficiais da versão 1.0 documentam veículos dirigíveis, cavalaria, novos mapas e armas.

## Adaptação e diferenças
Esta versão 0.3 é um protótipo original inspirado nessas mecânicas, não uma reprodução integral. O FPS foi convertido para combate visto de cima; a cobertura funciona por redução de dano perto de estruturas e elementos do cenário. Há uma categoria de tanque e cavalaria, não o catálogo completo do original. Os aviões são apoio aéreo, não veículos controláveis. Não inclui Steam Workshop, editor de mapas, física ragdoll, todas as armas, eras ou mapas do jogo de referência. As cores das facções são identificadores de gameplay, sem fidelidade histórica prometida.

Os mapas, sprites procedurais, sons e nome foram criados para este projeto. Nada foi extraído dos arquivos de Rising Front.

## Versão 0.4 — pixel art
Foco total na arte; a lógica de jogo não mudou. A arte vive em `dist/art.js` (sprites), `dist/terrain.js` (terreno) e `dist/pixel.js` (camada de renderização, carregada depois de `game.js`), com `dist/pixel.css`.
- **Grade de pixels real:** o canvas interno agora é ampliado por fator **inteiro** (antes 1,5×, que gerava pixels de tamanhos diferentes). O zoom da roda/`+`/`-` troca esse fator (1× a 4×), então nenhum pixel é distorcido. Nada de `rotate`/`arc`/`ellipse` com antialias.
- **Sprites em cache:** infantaria (3 vistas, 4 quadros de caminhada, armas por direção), cavalaria galopando, tanques com esteiras animadas (16 direções, rotação estilo RotSprite), carcaças de tanque em chamas, aviões biplano com hélice e sombra, estruturas com estados de dano. Contorno seletivo e paleta limitada; azul/vermelho mais contrastantes.
- **Mortos:** 4 poses desenhadas à mão (de bruços/de costas, com fuzil e capacete caídos), por facção, em 8 direções.
- **Terreno:** ruído em camadas com dithering de Bayer, lama na terra de ninguém, estradas com sulcos, rio com espuma e brilho animado, pontes, crateras iluminadas, árvores/pinheiros/ruínas assados, trincheiras de comunicação.
- **Tiro e acerto:** clarão do cano em dois estágios (cone, núcleo quente, brilho no chão e brasas), fumaça do cano, cápsula ejetada e coice do soldado; o tanque tem bola de fogo, poeira e recuo. Traçantes com cauda em degradê e poeira onde o projétil cai. Ao ser atingido, o soldado pisca em branco, avermelha e é empurrado na direção do tiro, com faísca de impacto, poeira, respingos e mancha no chão; ao morrer, o corpo desliza e cai virado para a direção do tiro. Tanques soltam faíscas de ricochete. Quando o jogador é atingido: tela vermelha, tremor e número de dano.
- **Efeitos:**  bola de fogo em estágios, fumaça e poeira, crateras permanentes após explosões, neve no mapa de inverno, traçantes de 1–2 px.
- **Clima (`dist/weather.js`):** opção CLIMA no menu (variável, limpo, chuva cedo, tempestade). A chuva escurece o céu, cai em gotas com respingos nas poças e, nas tempestades, tem relâmpago e trovão. A água acumula numa grade de terreno: escorre para as partes baixas (crateras, inclusive as abertas por bombardeios, trincheiras, margens do rio e lama) e seca devagar depois da chuva. No mapa de inverno a chuva vira nevasca, sem alagamento.
- **Nadar e logística:** em água rasa os soldados vadeiam (pernas submersas e linha d'água); em água funda nadam, balançam e atiram mais devagar. A velocidade cai com a profundidade, e tanques e cavalaria sofrem mais. Trincheiras alagadas perdem proteção e vão se degradando, e bunkers alagados enguiçam. A renda de suprimentos cai com a chuva e com posições alagadas, e reforços e esquadrões novos chegam atolados na lama. O rio passou a ser vadeável (mais fundo no meio); as pontes continuam secas. O indicador no campo mostra chuva, % alagado e perda de logística.
- **Clima 2.0 (acréscimos no `weather.js`):**
  - **Tempos e previsão:** limpo, nublado, garoa, chuva, tempestade e neblina (no inverno viram neve, nevasca e neblina gelada), com transições graduais. No modo Variável o indicador mostra a previsão e o tempo até a próxima mudança. O menu CLIMA ganhou Garoa, Chuva, Tempestade com raios e Neblina densa.
  - **Neblina e visibilidade:** camadas de névoa em pixel com deriva do vento. Com pouca visibilidade o alcance de tiro cai (até metade) e há névoa de guerra: inimigos longe das suas tropas somem do campo e do minimapa. A chuva forte também reduz a visão.
  - **Vento:** inclina a chuva e a neve, empurra fumaça e poeira, faz as bandeiras tremularem mais e desvia levemente os bombardeios. Chiado de vento no áudio.
  - **Raios:** traço visível com clarão e trovão atrasado pela distância; o raio causa dano em área e prefere tanques. Com tempestade ou neblina densa os aviões ficam em solo (caça e bombardeio bloqueados, para os dois lados).
  - **Lama e rastros:** o solo encharca com a chuva (persistente, seca devagar), escurece o terreno e desacelera mais; soldados deixam pegadas e tanques marcas de esteira gravadas no terreno.
  - **Exaustão:** quem fica muito tempo em água funda se afoga aos poucos.
- **Interface:** mira, anéis, barras, bandeiras e letras dos objetivos desenhados em pixels; minimapa em resolução baixa; ícones das cartas redesenhados.
- Desempenho: ~3,4 ms por quadro com 600 unidades (v0.3: ~9 ms).
- A v0.3 ficou preservada em `versoes/v0.3/`.

## Versão 0.5 — comando e IA de batalha

- Cada facção recebe 8 suprimentos por segundo e mais 4 por objetivo controlado. Gastos com tropas, apoio, defesas e reservas saem do caixa da própria facção. Os dois saldos e suas rendas aparecem no painel IA.
- O menu escolhe qual facção o jogador comanda e se a IA de cada lado começa ligada. O botão **IA** permite ligar ou desligar cada uma durante a partida e assumir a outra facção. Ao assumir uma facção, a IA dela é desligada para deixar o comando manual disponível. Tropas sem IA mantêm posição e continuam reagindo com tiro.
- O comandante automático prioriza objetivos conforme a presença local, usa flancos e incursões de cavalaria, posiciona metralhadoras na defesa, recua tropas feridas, procura cobertura quando está sob fogo, fortifica pontos ameaçados, organiza contra-ataques e pede apoio contra grupos inimigos com checagem de fogo amigo. Ele compra reforços de acordo com composição, limite de tropas e suprimentos disponíveis.
- Ordens manuais dadas enquanto a IA está ligada têm prioridade por 25 segundos.

## Versão 0.6 — trincheiras e resposta tática

- As trincheiras do terreno agora existem na simulação: combatentes dentro delas recebem a proteção correspondente. A IA reserva posições separadas para metralhadoras e parte da infantaria, entra nas trincheiras e mantém uma guarnição enquanto o restante avança.
- Se uma posição própria ou a retaguarda sofre invasão, a IA desloca uma reserva local para trincheiras e organiza um contra-ataque. Trincheiras tomadas podem servir de cobertura à outra facção quando a área está segura.
- Tropas automáticas reagem a artilharia iminente procurando uma rota que evite o conjunto de impactos marcados. Ordens manuais continuam com prioridade.
- Parte da infantaria acompanha tanques que ainda estão longe do objetivo. Tiros que passam perto também contam como supressão e fazem a IA buscar uma posição de cobertura na próxima decisão.
- A adaptação usa princípios de defesa em profundidade, fogo de flanco, reservas e contra-ataques descritos no [manual de infantaria FM 7-10 (1942)](https://www.ibiblio.org/hyperwar/USA/ref/FM/FM7-10/index.html). As distâncias e decisões foram ajustadas às regras do jogo; não representam uma simulação histórica completa.


## Versão 0.6 — "A Última Trincheira" como campo de batalha da Primeira Guerra

O mapa `trenches` foi refeito do zero, com as seções de um front de verdade (lado Aliado à esquerda, Central espelhado à direita). Floresta e Inverno não mudaram.

**Setores, da retaguarda à linha inimiga** (o HUD mostra o setor sob a câmera):
- **Logística:** ferrovia com trem de socorro, cais e vagões em descarga, depósito de munição, hospital de campanha (tendas com cruz vermelha, ambulâncias, macas), pátio de viaturas, QG em casarão com mastro e cabos de telégrafo, poço e acampamento, cozinha de campanha (fumaça), cavalariça com cavalos, feno e carroças, pátio dos engenheiros, campos de trigo e arado, pomar e fileiras de choupos.
- **Artilharia:** seis canhões separados (campanha e obuseiros) em posições escavadas com anel de sacos de areia, redes de camuflagem, paióis de projéteis, caixas, parelhas de cavalos e bonde Decauville levando munição do depósito até cada posição. Disparam de verdade (clarão, fumaça e poeira).
- **Reserva:** linha calma com abrigos escavados, barracas, fogueiras, latrinas e pilhas de fuzis; pátio dos tanques.
- **Apoio:** trincheira com morteiros, metralhadoras e posto de comando com bandeira.
- **Linha de frente:** baías de tiro em zigue-zague com parapeito de sacos de areia, degrau de tiro, passadiço, escadas, periscópios, ninhos de metralhadora e postos de escuta avançados. Trincheiras de comunicação ligam frente, apoio e reserva.
- **Arame farpado:** duas faixas com aberturas nas estradas.
- **Terra deNinguém:** ~440 crateras em aglomerados (muitas alagadas), lama com poças, árvores destruídas, cercas caídas, tanques em chamas, avião abatido, cavalos mortos, capacetes, fuzis e corpos. O rio e as três pontes foram mantidos. Os objetivos viraram marcos: **A** fazenda em ruínas, **B** vilarejo na ponte, **C** igreja destruída.
- A destruição cresce da retaguarda para a frente (grama sã → capim seco → lama), e sinalizadores, ratos e bandeiras ao vento dão vida ao cenário.

**Como funciona:**
- `ww1-layout.js`: geometria compartilhada (trincheiras, ninhos, baterias, setores, pontos de nascimento). `ww1-terrain.js` + `ww1-ground.js`: terreno como mapa de altura iluminado (luz no canto superior esquerdo). `ww1-spr*.js`: sprites. `ww1-props.js` + `ww1-scene.js`: crateras, arame e a cena. `ww1-ambient.js`: animações.
- As trincheiras pintadas **são** a cobertura do jogo: cada trecho gera âncoras de cobertura (`fieldTrenches`, agora com `hw`/`hh`/`slots`), usadas por `game.js`, pela IA (`ai.js`) e pelo alagamento (`weather.js`). As tropas nascem dentro das trincheiras, os metralhadores nos ninhos, os tanques no pátio e os reforços chegam pela estrada principal.
- `tools/dev.html` e `tools/sprites.html` (servidos com o `dist`) mostram o terreno por regiões e a folha de sprites.
- Backups anteriores em `versoes/*.antes-mapa`.


## Versão 0.7 — artilharia tripulada (`dist/battery.js`)
No mapa "A Última Trincheira" as 12 posições de bateria (6 por lado) são entidades com guarnição de 4 servidores (chefe de peça, municiador, portador e disparador). Sem baterias no mapa, o apoio cai no bombardeio abstrato antigo.
- **Missões de fogo:** o cartão de artilharia (jogador) e a IA chamam `PXBAT.mission(team,x,y,n,spread,kind)`, que reparte os tiros entre as baterias em condições de atirar. O comando chega por telefone (~1 s) e o alvo já fica marcado; cada peça faz apontar → municiar → cordel → disparo → recuo → ejeção (4,8 s no canhão de campanha, 7,5 s no obuseiro). Se nenhuma bateria puder atirar, o custo do cartão é devolvido.
- **Balística e som:** o projétil sai da boca do canhão; voo de 1,8 s (~400) a 4,2 s (~1800), +0,3 s no obuseiro. Som do tiro atrasado por distância/340 e assobio ~1,2 s antes do impacto.
- **Canhão vivo:** o carro vem do sprite e o tubo é desenhado à parte: gira até o alvo e recua de verdade no berço, com clarão em cone duplo, anel de poeira, fumaça e cápsula ejetada.
- **Munições:** alto-explosivo (cratera), shrapnel (estoura ~8 m acima, sem cratera; trincheira e bunker quase anulam o dano) e fumaça (3 focos que derivam com o vento e fazem a IA errar 3 de 4 tiros que atravessam a cortina). Tecla **T** troca a munição das missões do comandante; a IA escolhe shrapnel contra infantaria descoberta.
- **Operação manual (modo combatente):** **E** perto de uma peça aliada assume o canhão. WASD move o retículo (Shift acelera), clique dispara, **1/2/3** troca a munição, **E** sai. HUD com goniômetro em milésimos, distância, elevação, tempo de voo, munição e fase do ciclo.
- **Baixas:** explosões, metralhamento de caças, tiros perdidos e cavalaria ferem a guarnição; 3/2/1 vivos = 70/40/20% da cadência, 0 = peça silenciosa. Ao ouvir o assobio de um obus inimigo a equipe corre para o abrigo e o ciclo é interrompido. Um fuzileiro aliado parado junto à peça assume o posto vago, e a IA manda reservistas para peças desfalcadas.
- **Logística:** cada lado tem um depósito de munição com HP; um bonde Decauville leva projéteis do depósito às peças pelo trilho principal e pelos ramais. Se o depósito for destruído, as baterias ficam com o que já têm nos paióis.
- **Contra-bateria:** quem dispara muito é localizado; a IA inimiga responde sobre a peça mais quente e a guarnição se abriga.
- Testes: `node tests/battery.test.cjs`.

## Versão 1.1 — física de corpos, balística e blindados (`dist/physics.js`)

Uma camada nova, carregada depois de `planefx.js`, que envolve `update`, `shoot`, `explode`, `setup`, `bulletObstacleHit`, `aiGrenade`, `hud` e `sound` do mesmo jeito que `pixel.js` e `weather.js` já fazem. `game.js`, `ai.js` e os arquivos do mapa não foram alterados; o mapa só é lido (trincheiras, rio, pontes, crateras, `decor`). Desliga com `?fisica=0` na URL ou `PHYS.on=false`; `IronFront.physics.state()` mostra o estado. Um erro repetido desliga a camada sozinha em vez de travar o jogo. Constantes de ajuste em `PHYS.cfg`.

Pontos de contato com arquivos compartilhados (todos inofensivos sem a camada): 1 tag `<script>` no `index.html`; 2 ganchos de uma linha no `pixel.js` (`PHYS.draw` no desenho das unidades e `PHYS.skipBlastFx` no `wrap('explode')`); `mudAt` exportado em `PXW` no `weather.js`.

**Pilar 1 — corpos**
- **Separação elástica:** cada unidade empurra as vizinhas com `v = kpush · max(0, Ri + Rj − d)` (raios: infantaria 7, cavalaria 11, tanque 26; o mais leve cede mais). Grade de 56 px, só a célula e as adjacentes (sem custo O(N²)). Quem está de guarnição numa trincheira resiste mais ao empurrão, e quem já está perto do destino e só é empurrado considera que chegou (não treme na multidão). Cadáveres empurram de leve a infantaria, que desvia de quem caiu.
- **Inércia e atrito do solo:** o deslocamento que o jogo decidiu no quadro vira velocidade desejada e é integrado com `v ← v + (v_des − v)·(1 − e^(−α·dt))`. Terra seca freia e acelera rápido; lama acelera devagar e desliza ao parar; água rasa e neve também; água funda tem arrasto viscoso. A chegada é suavizada para o deslize não estourar o destino.
- **Paredes rígidas:** bunkers e ruínas são caixas sólidas; a tropa desliza pelas bordas. Se travar contra um muro (ex.: bolsas entre ruínas), planeja um caminho (A\* local) em volta. Alvos que a IA aponta para o centro de uma parede são levados para a face oposta ao inimigo. Sacos de areia continuam atravessáveis pela infantaria (mas os tanques os esmagam).
- **Arame pintado vira obstáculo:** o arame do mapa "A Última Trincheira" é detectado pela cor dos fios e desacelera a infantaria (×0,42) até um tanque abrir a brecha.

**Pilar 2 — balística**
- **Tiro varrido:** a bala é um segmento (posição anterior → atual) testado contra sacos de areia, bunkers, ruínas, troncos e cascos de tanque, vencendo o primeiro obstáculo. Não escapa mais por dt grande. Sacos de areia barram o tiro do outro time (o dono atira por cima do próprio parapeito), perdem vida útil e levantam terra; bunker e ruína dão faísca de pedra e som.
- **Trincheira:** o parapeito só protege quem está dentro da baía. O tiro que cruza o eixo da baía é barrado com probabilidade `pk · f(ângulo)` (uma rolagem por bala, não por quadro); tiro alinhado com o eixo (enfilada) passa, assim como granadas e morteiros. Quem acabou de atirar está com a cabeça acima do parapeito (proteção menor).
- **Blindagem:** ângulo de incidência contra a face do casco (caixa orientada). Acima de 45° o projétil ricocheteia de verdade (vetor refletido, velocidade reduzida, faíscas, pode ferir infantes por perto); abaixo disso o fuzil não fura a chapa (FT 16 mm, A7V 30 mm) e só causa dano residual, menor na frente do que no flanco e na traseira.
- **Granadas:** gravidade de 380 px/s², quique com restituição 0,35, rolamento pelo declive (mapa de altura + bacia das crateras) e quique em sacos, bunkers e ruínas. A IA só joga se não houver aliado num raio de 92 px (os estilhaços chegam a 100).

**Pilar 3 — blindados**
- **Lagartas:** o casco tem rumo próprio, velocidade angular com aceleração limitada e raio de giro que cresce com a velocidade; só anda para onde o casco aponta. O giro no próprio eixo é mais lento na lama e na água. FT é mais ágil que o A7V. A inclinação do terreno acelera ou segura o tanque.
- **Arco de tiro:** o canhão só dispara dentro de ±54° (FT) ou ±40° (A7V) do casco; fora disso o tanque se vira para o alvo antes de atirar (o sprite de cada tanque é uma peça só, sem torre giratória).
- **Esmagamento:** arame e sacos de areia inimigos (construídos ou pintados no mapa) e árvores mortas finas na terra de ninguém. O arame pintado e as árvores são apagados do terreno (chão limpo por cima) e deixam terra revolvida ou tronco caído.
- **Coice e suspensão:** o tiro empurra o tanque para trás e balança o casco (amortecimento senoidal de 0,3 s); declives, crateras, trincheiras, frenagem e esmagamento também inclinam o casco, desenhado fatiado ao meio.

**Pilar 4 — explosões**
- **Onda de choque:** impulso radial `(x − x_expl)/d · I · (1 − d/R)` em vivos e cadáveres; quem sobrevive e está perto cai, fica atordoado de 0,6 a 1,2 s (não anda nem atira) e é desenhado deitado. A parte radial do dano caiu um pouco para compensar os estilhaços.
- **Estilhaços:** 8 a 16 por granada, obus, tiro de tanque ou bomba (nada de estilhaço extra para fumaça nem para o *shrapnel* do `battery.js`), alcance de 60 a 100 px. São barrados por relevo (borda de cratera, parapeitos), sacos, bunkers, ruínas e troncos, e passam por cima de quem está fundo na trincheira.

**Pilar 5 — água**
- **Correnteza:** o rio corre do norte para o sul, mais forte no meio e seguindo as curvas. Arrasta cadáveres, capacetes caídos e madeira (tábuas de explosões e de pontes); quem nada é levado devagar. Os objetos batem nos pilares das pontes e ficam presos ou escorregam pelos vãos.
- **Detonações na água:** coluna d'água, anéis de onda e borrifos (com lama nas margens) no lugar da bola de fogo; sem cratera; dano radial menor contra quem está fora d'água e onda de choque hidrostática contra quem está submerso.

**Aproximações e limites**
- O relevo (mapa de altura), o chão limpo e o arame pintado só existem em "A Última Trincheira". Na floresta e no inverno o relevo vem só das crateras e não há arame pintado nem árvore derrubável; ruínas (e árvores grossas, para os tanques) são sólidas em todos os mapas.
- O sprite de cada tanque é uma peça só (sem torre giratória), então o canhão dispara dentro de um arco do casco (FT ±54°, A7V ±40°) e o tanque se vira para o alvo antes de atirar. A cadência medida quase não muda: 18,7 tiros por tanque por minuto sem a camada, 18,4 com ±54° e 18,7 com ±100° (os 3,2 s de recarga cobrem o giro). A largura do arco do FT está em `PHYS.tp()[0].arc`.
- Arame pintado retarda as duas facções; o arame construído só retarda o inimigo. Tanques só esmagam estruturas inimigas.
- Só árvores mortas na terra de ninguém caem; postes de telégrafo e as outras peças pintadas não.
- Os estilhaços são resolvidos no instante da explosão (riscos de ~0,08 s), não como projéteis em voo. Sacos de areia são atravessáveis pela infantaria (só bunkers e ruínas são paredes).
- Em chuva forte os tanques ficam bem mais lentos (peso, lama, giro no lugar), mas avançam: nas partidas IA × IA de teste ~5% ficam girando no lugar, contra ~0,5% sem a camada.

**Verificação:** `node tests/ai.test.cjs`, `node tests/battery.test.cjs` e `node tests/physics.test.cjs` passam; o último carrega o `physics.js` de verdade num contexto `vm` com um mini-jogo (separação, inércia seca e na lama, paredes, tiro varrido, trincheira, blindagem, lagartas, esmagamento, onda de choque, estilhaços, correnteza e som). No navegador, nos três mapas: 14 soldados empilhados se espalham até ~14 px, aglomerados de ruínas atravessados de 8 ângulos, taxas de acerto na trincheira (agachado/exposto/enfilada), ricochete no flanco, rolamento de granada em cratera, arremesso e atordoamento por distância, giro de FT e A7V, esmagamento, árvore derrubada, coluna d'água, correnteza e pilares, floresta com tanques atravessando 88 árvores grossas, inverno (neve) e partidas IA × IA (160 por exército, com chuva) sem erros. O custo da camada medido foi de ~1,6 ms por atualização com 320 unidades e ~4 ms com 640 (o jogo original, com as demais camadas, leva 15 a 60 ms nessas escalas no ambiente de teste).

## Versão 1.2 — sapadores e fortificação de campo (`dist/sappers.js`)

Camada nova, carregada depois de `physics.js`, no mesmo padrão das outras: envolve `setup`, `update`, `newUnit`, `protectedBy`, `explode`, `makeCards` e `icon`, e desenha em `WW1A.under/over` e `PHYS.draw`. `game.js` e `ai.js` não mudaram. Desliga com `?sapadores=0` na URL ou `PXSAP.on=false`; `IronFront.sappers.state()` mostra o estado. Um erro repetido desliga a camada sozinha. Constantes em `PXSAP.cfg`. Toques em arquivos compartilhados: 1 tag `<script>` no `index.html` e `PHYS.rebuild()` exportado em `physics.js` (uma linha), para a física enxergar as trincheiras novas.

**Pioneiros**
- São fuzileiros (`type:'rifle'`, `u.sap=1`), para as tabelas por tipo da física, da arte e da IA continuarem valendo. Levam pá e rolo de arame nas costas; cavando, ficam agachados, com a pá subindo e descendo e terra voando para o lado do inimigo. Quando levam tiro ou ficam suprimidos, param a obra e deitam (25% menos dano), e revidam se houver alvo. Fogem de obus marcado perto da obra.
- Cada lado começa com 2 esquadrões de 3, tirados dos fuzileiros mais recuados. A carta **Pioneiros** (aba Tropas, tecla **5**, ◈ 90) compra mais 3. A IA recompra quando os dela acabam.
- Uma ordem manual (selecionar e mover) tira o pioneiro da obra por 25 s. Nenhuma obra anda sem pioneiros.

**Três estágios por trecho** (cerca de 30 px; tempos para 3 homens: 1 homem rende 45% e 2 rendem 78%)
1. **Vala rasa / toca de raposa (10 s):** quem está dentro recebe 30% de redução de dano.
2. **Trincheira funcional (25 s):** o trecho entra em `fieldTrenches` e no `trenchGrid` (chave de 128 px) como âncora com `hw/hh`, `slots:1`, `line:'sap'` e eixo próprio. Isso dá a proteção de trincheira do motor, o parapeito da física (tiro que cruza o eixo é barrado, enfilada passa) e vaga para a IA guarnecer. O desenho tem paredes com luz e sombra, borda de terra fresca e pranchas (*duckboards*) no fundo.
3. **Parapeito de sacos de areia (40 s):** um `sandbag` de verdade no lado do inimigo. Ele barra balas e estilhaços (Pilar 2), perde vida com o fogo e pode ser esmagado por tanque.
- Ninho de metralhadora: poço, trincheira e 2 sacos de areia; a MG aliada mais próxima vai ocupá-lo. Posto de morteiro: poço com anel de sacos que, guarnecido por um infante, atira a cada 6,5 s em inimigos a 160–620 px, sem fogo amigo.
- Explosão perto de uma obra atrasa o estágio em andamento, mas não desfaz o que já foi cavado. É a contra-tática contra uma sapa.

**IA** (decide a cada 5 s, no máximo 2 obras simultâneas)
- **Reparo de brechas:** a camada guarda onde estavam arame e sacos. Quando um deles some, e a brecha fica a até 280 px da própria linha e sem inimigo a 300 px, os pioneiros reinstalam pela metade do preço. Se houver inimigo a menos de 480 px, a IA pede antes uma cortina de fumaça (`PXBAT.mission(...,'smoke')`).
- **Consolidação (*frontline creep*):** um grupo de pelo menos 5, a maioria parada, a até 650 px da própria linha em terra de ninguém e sem inimigo a 300 px, faz os pioneiros unirem as crateras próximas com valas até formar uma trincheira avançada.
- **Sapa em zigue-zague:** a partir da trincheira da frente, de frente para o objetivo mais disputado, com pernas diagonais alternadas (nunca um corredor reto que dê enfilada). Avança perna a perna até perto do centro do mapa ou até encontrar resistência; o estágio-alvo é a trincheira funcional.
- **Contra-tática:** sapadores inimigos cavando à vista e a menos de 520 px da própria linha recebem 2 tiros de artilharia, no máximo 1 vez a cada 40 s.
- Obras da IA sem equipe por 45 s ou sob fogo pesado são abandonadas; o que já foi cavado fica. Pioneiros ociosos esperam atrás da primeira linha em vez de irem ao assalto.

**Jogador — ordem de campo (tecla B, modo comandante)**
- **B** alterna *trincheira de ligação* (arrastar uma linha de até 360 px, ◈ 10 por trecho), *ninho de metralhadora* (clique, ◈ 110) e *posto de morteiro* (clique, ◈ 130). **ESC** cancela e o botão direito cancela a obra sob o cursor. Até 4 obras ao mesmo tempo, em território aliado ou perto das suas tropas; os pioneiros mais próximos correm até lá. Uma barra com as marcas dos 3 estágios aparece sobre o trecho em obra.
- Não há menu radial; a ordem de campo usa só a tecla B.

**Limites:** até 44 trechos de trincheira dinâmica e 30 sacos de sapadores por facção, porque `protectedBy` percorre `fieldTrenches`. Cada trecho é desenhado de um sprite em cache, refeito só quando muda de estágio. Na partida IA × IA com 160 unidades, a camada custa cerca de 0,01 ms por quadro.

**Verificação:** `node tests/sappers.test.cjs` carrega o `sappers.js` num contexto `vm` com um mini-motor. Ele cobre a geometria (trechos, zigue-zague, chave do grid, normal para o inimigo), os 3 estágios com proteção, âncora e parapeito, a explosão na obra, a supressão (deitar), a ordem manual, a sapa estendida, o reparo de arame e o disparo do morteiro. Os testes de IA, bateria e física continuam passando. No navegador (Edge sem janela, `A Última Trincheira`): partidas IA × IA de 200 s, compra pela carta, B + arrastar, ninho, morteiro e ESC, sem erros no console e com `IronFront.physics.state().errors` em 0.

## Frente 1.3 — atrito da frente: lama, MG, emperramento e observação aérea (`dist/frontline.js`)

Arquivo novo, carregado depois de `sappers.js`. Só envolve (`wrap`) `setup`, `update`, `shoot`, `explode`, `damage`, `place`, `choose`, `makeCards`, `icon`, `IronFrontBrain.selectTarget` e `PXBAT.mission`, e desenha em `WW1A.over`. Os únicos ganchos nos arquivos compartilhados são 1 tag em `index.html` e 1 linha em `weather.js` (`PXW.fow` e `PXW.mudGrid`). Estado por unidade em `u.atr`. Desliga com `?frente=0` ou `PXFL.on=false`. Constantes em `PXFL.cfg`; contadores em `PXFL.stats`.

**1 · Lama** (`PXW.mudAt`, que sobe com a chuva)
- Infantaria anda a ~40% da velocidade (medido: 43% → ajustado para ~40%), cavalaria a ~57%, e o modo soldado perde a corrida.
- **Tanque atola** ao cruzar cratera com lama ≥ 30%: risco de até 35%/s na lama cheia (25% disso fora de cratera). Fica imóvel de 8 a 13 s (continua atirando) e ganha 6 s de imunidade ao soltar.
- **Duds:** em lama saturada, 1 a cada 5 explosões com potência falha. Metade não detona (fica um **UXO** desenhado no chão; tanque que passa por cima o detona) e metade é **abafada** (raio ×0,25, potência ×0,6, gêiser de terra negra). Carcaça de tanque (potência 0) ignora a lama. Máximo de 40 UXO.

**2 · Metralhadora** (`mg` e `bunker`)
- Camisa de 4 L. A cada tiro o cano sobe ~0,85 °C; aos 100 °C a água ferve e perde 0,02 L por tiro. Com ≥ 95 °C sai vapor branco, que denuncia a posição: soldados inimigos **preferem** essa MG como alvo (alcance cheio, mesmo na neblina).
- Com 1 L um **municiador** corre até a trincheira aliada mais próxima da retaguarda (ou 160 px atrás) e volta com 4 L e água fria. Em lama ele anda a até 45% da velocidade.
- Sem água o cano trava, troca em **20 s** (+50% de dano sofrido) e volta com 2,2 L. Barra de calor/água sobre as MG aliadas quentes ou selecionadas.

**3 · Emperramento** (`rifle` e `mg`, exceto a pistola)
- `atr.dirt` (0–1) sobe andando na lama e com explosão a menos de 30 px; limpa a 0,02/s em chão seco. Chance de emperrar por tiro: 1% + 17% × sujeira (na MG ×0,15, porque ela atira 6× mais). Desengasgar leva 2–3 s: parado, sem atirar, +25% de dano sofrido, com "!" amarelo sobre o soldado.

**4 · Observação aérea** (APOIO › *Salmson 2A2 / Rumpler C.VII*, tecla **5**, ◈ 120)
- O biplano entra pela borda, orbita por 55 s uma elipse de 300×190 sobre o ponto marcado e sai. Sem voo em tempestade ou neblina densa (igual aos outros aviões).
- No **setor** (raio 380 em volta do avião): `PXBAT.mission` da facção dele erra **75% menos** (mede-se ×0,23) e a névoa de guerra do jogador some ali.
- **Contra ele:** 2 canhões de 75 mm por lado na retaguarda (alcance 720, o tiro leva 0,65 s, a mira melhora com o tempo e a rajada tem ~7% de acerto perto do alvo), MGs sem alvo no chão a até 320 px, e o jogador em modo soldado mirando no avião. Flak é nuvem negra; 3 acertos derrubam; o avião cai girando e explode. Medido: orbitar sobre o flak inimigo derrubou 5 de 8; no meio da terra de ninguém, 0.
- A IA manda o seu observador a cada 45–80 s se tiver ◈ 120 + o custo da artilharia.

**Verificação:** `node tests/frontline.test.cjs` (vm + mini-jogo): velocidade, taxas de dud/abafamento, UXO, atolamento, ciclo térmico da MG, vapor como alvo, emperramento (1% e 18% medidos), dispersão ×0,25, voo de 55 s, flak, MG antiaérea, queda, carta e chamada da IA. No navegador (mapa *trenches*): 800 explosões em lama 1,0 → 11% duds + 9% abafadas; 60% dos observadores sobre o flak inimigo caem; o custo é ~19% a mais de CPU com 320 unidades.

## Versão 1.4 — assalto de trincheira (`dist/assault.js`)

Camada carregada depois de `blood.js`, no mesmo padrão das outras. Ela envolve `setup`, `update`, `protectedBy`, `explode`, `shoot`, `place`, `makeCards`, `icon`, `hud` e `render`, e desenha em `WW1A.over` e `PHYS.draw`. Toca um arquivo compartilhado só com 1 tag `<script>` no `index.html`. Desliga com `?assalto=0` ou `PXAS.on=false`; o estado fica em `IronFront.assault.state()`. Constantes em `PXAS.cfg`.

**Supressão realista**
- Fora de trincheira, a partir de `u.suppression > 1,15`, o infante se joga na lama e é desenhado deitado.
- Rasteja a 13 px/s até a cratera mais próxima (até 110 px) e só levanta quando o fogo cai (`< 0,45`). Aí retoma a ordem que tinha.
- Deitado recebe 40% menos dano; dentro da cratera, 55% menos.
- Quem está na trincheira não se joga: já está protegido.
- Uma ordem manual tira o soldado do chão.
- Jogador: **Z** deita e levanta (rasteja a 30% da velocidade e sofre metade da concussão). O HUD mostra `SUPRIMIDO ▮▮▮▮` e a tela escurece nas bordas.

**Over the Top**
- **V**, ou o botão *ATAQUE · V*, dispara o sinalizador verde da pistola Very. Soam 7 apitos ao longo da trincheira.
- Os fuzileiros da linha (ou os selecionados) sobem as escadas em escalonamento de 1 a 3,5 s e avançam em onda, cada um na sua faixa, até a trincheira inimiga. As metralhadoras ficam cobrindo.
- **Shift+V** acrescenta uma barragem móvel: 3 cortinas de fumaça que avançam à frente da onda.
- A IA faz o mesmo quando tem pelo menos 20 homens na trincheira, depois de cegar a linha inimiga com fumaça.

**Gás e concussão**
- Card **Gás mostarda** (aba APOIO, tecla **6**, ◈ 170): 4 granadas que abrem uma nuvem pontilhada.
- A nuvem vai com o vento (`PXW.windVec`), escorre para as crateras e se dissipa em cerca de 75 s.
- A IA lança gás contra grupos de pelo menos 6 homens em terra de ninguém perto da própria linha, e só com vento a favor.
- O lado atingido ouve a corneta de alarme. Cada soldado põe a máscara em 0,6 a 2,8 s; 12% atrapalham-se e demoram de 5 a 9 s.
- Sem máscara: dano contínuo, tosse e queda no chão. Com máscara: 90% menos dano e 30% dos tiros perdidos.
- Jogador: **G** põe a máscara quando há gás (senão continua sendo granada) e **M** alterna. A vista vira duas lentes embaçadas, com respiração pesada.
- Explosão perto do jogador: a tela treme e embaça, a batalha fica abafada (toda a mixagem passa por um ganho mestre) e fica um zumbido de 4–6 kHz por 1,5 a 6 s.

**Limpeza de trincheira**
- Corpo a corpo automático a menos de 16 px (faca, pá, queima-roupa: 30 a 58 de dano). Jogador: **Q**, 60 a 80 de dano à frente.
- A granada que rola a menos de 34 px da entrada de um abrigo cai lá dentro. Contam como abrigo: ninho de MG do mapa, bunker e ninho cavado pelos sapadores. A explosão confinada põe a guarnição fora de combate, arrasa o bunker e cospe terra pela entrada.
- A primeira linha é dividida em setores de 200 px. Quando 2 ou mais infantes ocupam um setor por 3 s sem defensores, a bandeira é hasteada nele.

**Verificação:** `node tests/assault.test.cjs` testa todas as mecânicas acima num mini-motor. No navegador (`A Última Trincheira`, IA × IA, 200 s) não houve erros no console, e a camada custa 0,03 a 0,12 ms por quadro. Também testei V, gás com G e M, concussão e Z no modo soldado.

**Fora desta versão:** fios de telefone, soldados limpando fuzis no banco de tiro, e sniper como unidade própria.

### Mapa limpo (`WW.CLEAN` em `dist/ww1-layout.js`)
"A Última Trincheira" agora começa quase intacta, e é a partida que transforma o campo: crateras permanentes das explosões, trincheiras dos sapadores, arame cortado e crateras que alagam com a chuva.
- **Terra de ninguém:** capim seco e pisoteado, sem poças. Tem 56 buracos velhos e rasos, em vez das 440 crateras. Saíram os corpos, os cavalos mortos, os tanques queimados, o avião abatido e a tralha solta. Sobram 10 carvalhos vivos (que dão cobertura), 4 tocos e 5 cercas.
- **Retaguarda:** cerca de metade dos adereços decorativos (vagões, hospital, caminhões, acampamento, cavalariça, parelhas, entulho, pomar).
- **Mantido:** trincheiras, ninhos, os 12 canhões, o depósito, o Decauville, o QG, as estradas, as pontes, os objetivos com as ruínas e o arame.
- Com `CLEAN.on:false` o visual denso anterior volta idêntico.

## Versão 1.5 — fortificação de campo: preparação, catálogo e IA construtora (`dist/fortify.js`)

"A Última Trincheira" começa **sem trincheiras nem baterias**, com `PX.WW1.CLEAN.forts=false` em `ww1-layout.js`. Hospitais, QG, posto de comando, acampamentos, depósito, ferrovia, pátios e objetivos continuam no mapa. As tropas nascem numa área de reunião na retaguarda (x 330–560 e o espelho do outro lado). Com `forts:true`, as linhas pintadas antigas voltam idênticas.

**Preparação (300 s; `?preparo=N` muda, `0` desliga)**
- **Trégua de verdade:**
  - uma barreira no centro (x 1130 / 1270) segura os dois lados;
  - ninguém atira nem joga granada;
  - não há artilharia, aviões, gás nem reconhecimento (o `spend` de apoio fica bloqueado);
  - as peças não fazem fogo de inquietação;
  - tanques e cavalaria ficam estacionados;
  - os objetivos ficam congelados;
  - o comando da IA (`runCommander`) espera.
- **Orçamento:** cada lado recebe ◈ 4500. O teto de 2400 do jogo continua valendo para a renda, mas não apaga o que sobrou do orçamento.
- **Obras:**
  - toda a infantaria ajuda a cavar, em equipes de até 6, e as obras rendem 1,6× (ninguém atira nelas);
  - cada lado só constrói do próprio lado da barreira;
  - uma faixa no topo mostra o tempo restante, as obras e a fila;
  - **PLANO AUTOMÁTICO** deixa a IA fortificar o seu lado; **PRONTO (P)** encerra a trégua em 3 s.
- **Fim da trégua:**
  - soam os apitos e a barreira cai;
  - a infantaria volta a ser infantaria (ficam só os pioneiros);
  - frente, setores e abrigos são recalculados a partir do que foi construído;
  - o comando da IA assume e guarnece as posições prontas.

**Catálogo** (aba DEFESAS, teclas 1–0; todas as obras são feitas pelos pioneiros em estágios, no sistema do `sappers.js`)

| Obra | ◈ | O que faz |
|---|---|---|
| Trincheira de tiro (linha) | 10/trecho | Vala → trincheira (âncora `front`) → parapeito de sacos |
| Trincheira de comunicação (linha) | 6/trecho | Âncora `comm`/`support`, sem parapeito |
| Arame farpado (linha) | 25/trecho | Um `wire` a cada 64 px |
| Sacos de areia | 30 | Parapeito avulso |
| Ninho de MG | 150 | Poço, trincheira e 2 sacos. Vem com guarnição (a MG livre mais próxima ou um esquadrão novo pela estrada), que fica no posto até receber outra ordem |
| Bunker de madeira | 200 | `bunker` com MG, 1000 de vida |
| Casamata de concreto | 340 | `bunker` com MG, 2400 de vida |
| Abrigo subterrâneo | 70 | 3 vagas; quem está dentro leva 85% menos dano (inclusive estilhaço e *shrapnel*) |
| Poço de morteiro | 130 | Atira sozinho quando guarnecido (`sappers.js`) |
| Antiaérea | 180 | Alcance de 430 px. Derruba caças e bombardeiros (cancela as bombas ainda não largadas) e acerta o avião de reconhecimento do `frontline.js` |
| Canhão de campanha 75 mm | 240 | Vira bateria tripulada de verdade (`PXBAT.addGun`): guarnição, missões, operação manual (E), bonde de munição |
| Obuseiro 155 mm | 320 | Bateria pesada |

Peças e antiaéreas podem ser destruídas por explosões.

**IA construtora** (defesa em profundidade, espelhada para cada lado, por prioridade e dentro do orçamento)
1. Primeira linha em zigue-zague de ponta a ponta, em lotes que começam pelo centro.
2. 5 ninhos de MG cruzando fogo.
3. Arame 115 px à frente, com passagens nas estradas.
4. Artilharia nas posições da antiga linha de baterias.
5. 4 abrigos logo atrás da linha, 2 bunkers e uma casamata no centro.
6. 3 morteiros, antiaéreas, linha de apoio e ligações.

Ela toca até 14 obras em paralelo na trégua e até 4 depois. Depois da trégua, a cada 5 s repõe bunker, peça ou antiaérea destruídos e acrescenta antiaérea quando é atacada do ar. O reparo de arame e sacos continua a cargo do `sappers.js`.

**Toques em arquivos compartilhados**
- `battery.js`: `build()` foi fatorado em `mkGun()`, e `PXBAT.addGun` / `PXBAT.removeGun` foram exportados.
- `sappers.js`: tipos de obra extensíveis (`line`, `step`, `box`, `onStage`, `sprite`, `label`), projetos `keep` (nunca abandonados), `CREW`/`WORKX` ajustáveis, mais de 3 homens rendendo, `addAnchor` / `project` / `refreshFront`, `canBuild` e `hold`.
- `assault.js`: `refresh()` e `hold`.
- `index.html`: 1 tag `<script>`.

**Verificação**
- `node tests/fortify.test.cjs`: trégua (sem tiro, barreira, objetivos congelados, orçamento), plano espelhado por prioridade, IA construindo em paralelo, abrigo, antiaérea, canhão tripulado, bunker, fim da trégua e abate de avião.
- Os outros 6 testes continuam passando.
- No navegador, IA × IA: nenhum tiro, avião ou obus durante a trégua, tanques parados no pátio, os dois lados com cerca de 70 âncoras, 6 baterias e 4 antiaéreas ao fim. Sem erros no console.

## Versão 1.6 — socorro, linhas contínuas e obra mais rápida (`dist/medics.js` + ajustes)

**Postos de socorro e padioleiros (`medics.js`)**
- **Ferido grave:** 55% dos ferimentos que matariam um infante deixam o soldado caído em vez de morto. Explosão que despedaça (mais de 70 de dano além da vida restante) continua matando na hora.
  - O caído sangra e morre em 50 a 75 s sem socorro.
  - Ele não anda, não atira e deixa de ser alvo da IA.
  - Rente ao chão, 80% das balas passam por cima dele; uma explosão o mata.
- **Postos:** cada lado começa com um posto pronto na retaguarda. A IA põe mais 2 no plano, e o jogador constrói pela carta **Socorro** (aba DEFESAS, ◈ 120).
- **Padioleiros:**
  - cada posto tem 2 equipes de maca;
  - vão ao ferido mais urgente a até 750 px e evitam onde há 2 ou mais inimigos a 140 px;
  - carregam devagar até o posto, que trata 3 por vez em 10 a 16 s;
  - 78% voltam à luta com 60% da vida;
  - explosão ou fogo de perto matam a equipe, e outra chega em 25 s.
- `?socorro=0` desliga; o estado fica em `IronFront.medics.state()`.

**Sacos de areia e arame em linha contínua**
- O parapeito das trincheiras, a parede da carta Sacos de areia, a frente dos ninhos de MG e as faixas de arame passaram a ser desenhados ao longo do eixo da obra.
  - O parapeito tem 3 fiadas de sacos desencontradas; o arame, estacas e 3 espirais.
  - Os trechos vizinhos se emendam, então a parede segue o zigue-zague de frente para o inimigo, em vez de sacos soltos de lado.
- **Colisão:** o prédio guarda eixo e comprimento (`b.vert`, `b.ax`/`b.ay`, `b.len`), e a caixa de colisão da física (`b.bw`/`b.bh`) acompanha o eixo.
- **Arame:** um trecho a cada 42 px, sem vão para a infantaria passar (o jogo freia quem cruza a menos de 22 px de cada trecho).
- **Reparo:** o reparo dos sapadores reconstrói o trecho com a mesma orientação.
- **Desenho:** o `pixel.js` não desenha esses prédios (um wrap de `render` os tira da lista só durante o desenho), e o `sappers.js` os desenha a partir de um sprite em cache por estado de dano.

**Preparação**
- Obras rendem 2,6× na trégua e 1,6× depois dela; o `CFG.WORKX` do `sappers.js` também vale nos outros mapas.
- Toda a infantaria cava, inclusive as metralhadoras.
- **40 s antes do apito**, a tropa larga as pás e ocupa o que foi construído: primeira linha, ligações, apoio e abrigos, por proximidade. Metade da primeira linha fica de guarnição depois do apito; o resto o comando usa para atacar. Ordem manual libera.
- Se sobrar trégua e dinheiro, a IA faz uma segunda leva:
  - 4 ninhos intermediários;
  - 2ª faixa de arame;
  - 5 abrigos;
  - linha de reserva;
  - 2 antiaéreas;
  - 2 morteiros.
- **Antiaérea:** ficou mais eficaz, com cerca de 50% de chance de derrubar um caça que cruza o alcance (~2 s).

**Verificação**
- `node tests/medics.test.cjs`: ferido grave, fora da mira, resgate, tratamento, sangramento e explosão.
- Os outros testes continuam passando.
- No navegador, IA × IA: 114 sacos e 56 trechos de arame contínuos, 134 homens ocupando as posições 40 s antes do apito, 58 de guarnição depois dele, e padioleiros recolhendo feridos já no primeiro minuto. Sem erros no console.

## Versão 1.7 — A Experiência do Soldado: Gunplay, Liderança de Esquadrão e Sobrevivência (`dist/soldier-combat.js` + `dist/soldier-tactics.js`)

Dois novos módulos independentes que elevam o Modo Combatente (Soldado) a uma experiência visceral, imersiva e de liderança tática de infantaria. Ambos podem ser desativados individualmente (`?soldier_combat=0` / `?soldier_tactics=0`).

### 1. Gunplay & Combate Brutal (`soldier-combat.js`)
- **Mira Focada (ADS / *Camera Lead*):** Segurar o Botão Direito do Mouse (RMB) ou tecla `Shift` no modo soldado avança a câmera até 180 px na direção do cursor, reduz a dispersão da arma em 55% e exibe um retículo tático fechado de alta precisão.
- **Arma Apoiada em Cobertura (*Weapon Mounting*):** Ao encostar em parapeitos de trincheiras, sacos de areia ou crateras (`protectedBy < 0.75`), a arma entra em estado montado, reduzindo recuo e dispersão a quase zero (95% de estabilidade) com indicador `APOIADO` no HUD e suporte no retículo.
- **Carga de Baioneta (Tecla X):** Com fuzil equipado, o soldado solta um brado de guerra sintetizado e arranca a 1.6× da velocidade normal por até 2,2 segundos. Colisão frontal (< 22 px) contra infantes inimigos desfere perfuração instantaneamente letal com respingos arteriais. Se errar ou esgotar o tempo, o combatente fica exausto por 1,4s (0.6× vel) e entra em cooldown de 10s.
- **Arsenal de Trincheira — Winchester 1897 "Trench Gun" (Tecla 4):** Escopeta slamfire com 6 cartuchos e múltiplos balins (6 pellets por tiro) em cone de dispersão devastador a curta distância.
- **Estalo Sônico (*Snap-Crack*):** Projéteis inimigos que passam a menos de 28 px da cabeça geram estalo sônico sintetizado em alta frequência e micro-tremor de susto na câmera.

### 2. Liderança de Esquadrão & Sobrevivência (`soldier-tactics.js`)
- **Apito Pessoal do Soldado / NCO (Tecla T):** O jogador sopra o apito de comando (áudio sintetizado FM, recarga de 25s). Aliados em um raio de até 260 px saem imediatamente de supressão/deitado, ganham bônus moral de +30% velocidade e imunidade a pinning por 6s, e avançam ao ataque.
- **Comandos Contextuais de Esquadrão (Tecla F):**
  - Mirar em MG/bunker inimigo (< 45 px): emite "FOGO DE SUPRESSÃO!", fazendo até 4 infantes aliados concentrarem disparos no alvo por 7 segundos.
  - Mirar em trincheira/sacos de areia aliados: emite "GUARNECER POSIÇÃO!", direcionando os infantes para montar guarda no ponto.
  - Mirar em chão aberto: emite ordem de "AVANÇAR PARA CÁ".
  - Marcador visual tático pulsante de 3s no solo e feedback sonoro.
- **Estado Caído (*Downed* / Agonia) Jogável:** Ferimentos fatais sem despedaçamento (> 60 de overdamage por shell) deixam o jogador caído com temporizador de sangramento de 25s. O jogador rasteja devagar (11 px/s), atira com a pistola de bolso em emergência e aperta **E** para gritar por socorro, alertando padioleiros do `medics.js` e companheiros. Se socorrido antes dos 25s, levanta com 50% de HP.
- **Auto-Bandagem de Emergência (Tecla H):** Segurar `H` por 2,2s imóvel aplica um curativo de campo (+35 HP, limitado a 2 por vida e 30s de cooldown). Movimentar-se cancela a aplicação.
- **Saque de Cadáveres (Tecla E):** Aproximar-se a menos de 24 px de corpos caídos e apertar **E** saqueia munição (+1 pente) e recupera granadas.

### 3. Verificação
- `node tests/soldier-combat.test.cjs`: ADS, Camera Lead, mounting, carga de baioneta, escopeta e snap-crack 100% OK.
- `node tests/soldier-tactics.test.cjs`: Apito, pings contextuais, estado downed, auto-bandagem e saque 100% OK.
- Todos os 10 testes do projeto passam sem regressões.

## Versão 1.8 — Interface de Soldado no Estilo Battlefield (`dist/soldier-hud.js` + `dist/soldier-hud.css`)

Substitui o HUD de combatente por uma interface completa inspirada em Battlefield (Battlefield 1), com cantos chanfrados em vidro fumê, avatar procedural em pixel art, identidade militar e arsenal completo em slots.

### 1. Identidade & Avatar do Combatente
- **Identidade Militar de Época:** Cada soldado controlado recebe patente e sobrenome históricos gerados proceduralmente de acordo com a facção:
  - *EUA (Time 0):* Patentes (`Pvt.`, `Pfc.`, `Cpl.`, `Sgt.`) + Sobrenomes (`Miller`, `Hayes`, `Baker`, `O'Connor`, `Walker`, `Sullivan`, `Turner`, etc.).
  - *Alemanha (Time 1):* Patentes (`Schütze`, `Gefr.`, `Uffz.`, `Fw.`) + Sobrenomes (`Schmidt`, `Müller`, `Weber`, `Becker`, `Hoffmann`, `Wagner`, etc.).
- **Avatar em Pixel Art (Canvas 48×48):** Retrato dinâmico do soldado com capacete Brodie (EUA) ou Stahlhelm M1916 com Stirnpanzer lugs (Alemanha), fardamento de campanha, olhos e sujeira de trincheira. O avatar reage dinamicamente ao estado de combate:
  - *Normal:* fisionomia concentrada e capacete alinhado.
  - *Ferido (HP < 40%):* cenho franzido, cortes e sangue escorrendo no rosto.
  - *Em Agonia (Downed):* tez cadavérica pálida, capacete torto, olhos semicerrados e ataduras ensanguentadas.

### 2. Barra de Vida Battlefield
- **Design Militar Tático:** Exibição numérica `100 HP` (ou `CAÍDO (25s)` em agonia), barra com transição fluida e divisões segmentadas.
- **Cores Dinâmicas de Alta Legibilidade:**
  - Verde tático (`#2ed573`) quando HP > 60%.
  - Âmbar de alerta (`#ffa502`) entre 30% e 60%.
  - Vermelho sangue pulsante (`#ff4757`) com efeito de pulso luminoso quando HP < 30%.
- **Badge Tático de Status:** Exibe em tempo real `PRONTO`, `APOIADO`, `SUPRIMIDO`, `CARGA DE BAIONETA`, `EM AGONIA`, `MIRA FOCADA` ou `RECARREGANDO`.

### 3. Painel de Armamento em Slots (Slots 1 a 4, G e X)
- **Slots Completos:**
  - `[1]` Fuzil de Ferrolho (*Springfield M1903* / *Gewehr 98*)
  - `[2]` Submetralhadora (*Thompson* / *MP 18*)
  - `[3]` Pistola (*Colt M1911* / *Luger P08*)
  - `[4]` Escopeta de Trincheira (*Winchester 1897* / *Mauser Flieger*)
  - `[G]` Granada de Mão (*Mk II* / *Stielhandgranate*) com contador `2 / 2` e cooldown
  - `[X]` Baioneta / Corpo a Corpo com status em tempo real (`PRONTA`, `INVESTIDA!`, `EXAUSTO`)
- **Destaque na Arma Ativa:** Borda dourada/âmbar com fundo iluminado gradiente e indicação ativa.
- **Interatividade:** Seleção de armas tanto pelas teclas numéricas e de atalho quanto por clique direto do mouse em qualquer slot.

### 4. Verificação
- `node tests/soldier-hud.test.cjs`: Identidade, avatar, barra de vida, arsenal, status e kill switch 100% OK.
- Todas as 13 suítes de testes do repositório aprovadas sem regressões.

### Arte das construções (dist/art-forts.js)
Camada só de desenho para tudo que os pioneiros e a IA constroem. Troca `K[kind].sprite` do sappers.js (bunker, casamata, abrigo, ninho de MG, morteiro, antiaérea, canhão 75 / obuseiro 155, e as plantas de arame e sacos) com estágios detalhados: planta com estacas, fita e cal; escavação com parede à vista e terra virando parapeito; estrutura (troncos, fôrma com vergalhão, sacos subindo); pronto. Bunkers prontos (`b.kind` 'wood'/'concrete') saem do render genérico e ganham sprite próprio com seteira virada para o inimigo, cano de MG que acompanha o alvo, clarão no tiro, 3 estados de dano e ruínas. Postos de morteiro (`PXSAP.customPosts`) e antiaéreas (`PXFORT.customAA`) têm peça e guarnição animadas. Tudo em cache; ~0,1 ms por quadro. `?arteobras=0` desliga; `PXARTF.state()` / `PXARTF.sheet()` para revisão.

### Arte do socorro (dist/art-medics.js)
Camada só de desenho por cima de `medics.js` (liga `PXMED.customDraw`). Os postos livres da retaguarda viram um **hospital de campanha**: enfermaria e tenda de cirurgia em lona (cruz no telhado, mesa de operação iluminada com cirurgião animado), fila de catres com pacientes, banco dos padioleiros, ambulância, caixas da Cruz Vermelha, caldeira com vapor, varal de ataduras, sacos de areia, lona com cruz para os aviões e bandeira; médico, duas enfermeiras e um servente andam e atendem os catres ocupados. Os postos construídos viram um **posto de socorro** menor, com as 3 etapas da obra (estacas e fita, armação, lona subindo). Padioleiros de bata com cruz (Brodie / Stahlhelm) em 4 vistas com passo: maca enrolada no ombro na ida, ajoelham e erguem o ferido, carregam a maca com o ferido sob cobertor, descansam no banco. Feridos deitados com atadura e sangue discreto, cruz piscando (precisa de socorro) ou fixa com seta (padioleiros a caminho). Sprites em cache, ~0,15 ms por quadro. `PXMEDART.state()`.

## Versão 1.9 — Vida, feridos, classes e Modo Soldado (passe de polish)

Diagnóstico completo (auditoria, bugs, review de UI P0–P3 e brainstorm do Soldier Mode) em `docs/polish-pass-diagnostico.md`. Tudo entra por módulos novos que fazem *wrap* das funções globais e carregam numa linha própria do `index.html`, depois de `soldier-hud.js`: `life-kit.js`, `casualty.js`, `soldier-life.js`, `classes.js`, `soldier-feel.js`, `soundscape.js`, `aviation.js`, `works.js`, `shelter.js` e `heavyfx.js`. Cada um tem chave para desligar (`?vida=0`, `?feridos=0`, `?classes=0`, `?sensacao=0`, `?som2=0`, `?aviacao=0`, `?obras=0`, `?abrigos=0`) e estado em `IronFront.<módulo>.state()`.

**Feridos e resgate (`casualty.js`).** Usa o mesmo estado de caído do `medics.js` (`u.down`). O ferido tem gravidade:
- leve: rasteja sozinho até a cobertura;
- grave: chama por socorro ("MEDIC!" / "SANI!");
- crítico: desmaia.

Na cobertura o sangramento corre a 45%. Companheiros a até 130 px decidem ajudar conforme moral, supressão, inimigos perto e ordem atual. O resgate é físico: correm, ajoelham e agarram (1,1 s), arrastam de costas a 40% da velocidade e levam para trincheira, cratera ou posto. Explosão perto ou supressão extrema interrompem o resgate. A maca vinda da retaguarda assume quando chega. A cadeia médica:
- posto avançado: triagem de 6–9 s;
- ambulância: 14–22 s;
- hospital de campanha: 10 leitos, 2 cirurgiões por prioridade e estoque de 24 kits.

Os desfechos são volta ao combate, incapacitado, evacuado (metade volta como reforço em 120 s) ou morte. O resultado da batalha mostra o relatório médico. No modo soldado, **E** arrasta (você anda a 40% e não atira) e o médico jogador faz primeiros socorros.

**Classes (`classes.js`).** A cada 16 fuzileiros saem 2 granadeiros, 1 médico e 1 atirador; a cada 48, 1 observador. Isso vale também para as compras da IA. Há duas cartas novas, Tropas de assalto e Especialistas.
- Médico: não combatente; não é alvo a mais de 60 px.
- Granadeiro: granada de fuzil de 60 a 190 px contra ninho e bunker.
- Atirador: 340 px, dispersão 0,025.
- Observador: corrige a artilharia em −50% e pede fogo.
- Assalto: 25% mais rápido, supressão some 2× mais rápido, granadas em quem está abrigado, corpo a corpo e infiltração.

**Vida (`soldier-life.js`).**
- Água funda: fuzil erguido acima da cabeça e sem tiro.
- Trincheira: posturas com proteção real. Abrigado: só o capacete, proteção 0,18. Observando: 0,28. Mirando no degrau de tiro, encostado ou correndo abaixado: proteção normal.
- Escalada do parapeito ao sair para a frente.
- Abaixar com explosão, depois de 0,1–0,35 s de reação.
- Gritos ("GET DOWN!", "MG!", "SANI!") e microanimações: capacete, limpar o fuzil, olhar em volta, fumar, tropeçar na lama.

**Modo Soldado (`soldier-feel.js`).**
- Bala que passa perto levanta terra, dá um tranco na câmera, marca na borda da tela de onde veio o fogo e soma supressão.
- A sua mira piora sob fogo.
- O tremor da câmera é próprio e respeita a opção do menu.
- **E** assume a MG aliada: fita de 250, tripé que não anda.
- A linha de dicas saiu de baixo do painel e diz o que o E fará.

**Som (`soundscape.js`).**
- Barramentos sobre o mestre do `assault.js`, com limitador e reverb por convolução.
- Distância com ganho, ar, panorama e atraso acústico.
- Timbre por arma e nação; explosões por tamanho.
- Limite de vozes com prioridade e ducking.
- Calma com vento e pássaros, caos com leito de fogo distante.
- Gritos por formantes.

**Aviação (`aviation.js`).**
- Patrulha de caça: persegue e derruba aeronaves; as bombas ainda não largadas caem com o bombardeiro.
- Ataque ao solo: voa ao longo da trincheira inimiga, com rajadas, supressão e bombas nos ninhos.
- Observação de artilharia: orbita 45 s, corrige −65% e pede salvas.
- A IA usa os três e passa a chamar o bombardeiro leve, mas só com caixa acima da reserva de obras (custo + max(200, reserva da engenharia)).
- Tempestade forte ou neblina deixam os aviões em solo (mesma regra do jogo).

**Construção (`works.js`, aba DEFESAS).**
- Toca individual.
- Depósito de munição: remunicia infantaria, granadas, MG e artilharia; explode se for atingido.
- Posto de observação: revela a névoa e corrige a artilharia.
- Cavalo de frisa.

**Abrigos e bunkers (`shelter.js`).**
- Sob barragem, a infantaria vai à entrada do abrigo e desce degrau a degrau. Lá dentro recebe 8% do dano e não é alvo.
- Sobe quando a barragem acaba ou no alarme (corrida ao parapeito) e volta ao posto.
- O bunker só atira com guarnição e chama até 2 homens ociosos para guarnecê-lo.
- No modo soldado, **E** na entrada desce ou sobe.

**Morteiro (`heavyfx.js`).** A bomba do poço de morteiro sobe e desce em arco até o impacto, com rastro e sombra. Há fumaça de boca, um "tum" próprio do tubo e o assobio de chegada perto do ouvinte. Desliga junto com `?vida=0`.

**Bandeiras.** O QG, o posto e as bandeiras de setor deixaram de ser panos azul ou vermelho lisos e passaram a ser bandeiras nacionais: EUA (13 listras) e Império Alemão (preto, branco e vermelho).

**Medido** (suítes em `tests/*.test.cjs`, as 15 antigas mais 8 novas, todas passando):

| Recurso | Resultado |
|---|---|
| Resgate (A/B, 30 feridos, 150 s) | 25 mortos sem o sistema, 15 com resgate |
| Resgate em batalha IA × IA (~3 min de combate) | 47 resgates iniciados: 11 entregues, 10 passados à maca, 16 interrompidos (13 por explosão), 5 feridos morreram |
| Atirador × fuzileiro, alvo de 7 px | 59% × 17% a 230 px; a 300 px, 51% × 0 tiros |
| Granadeiro | limpa um ninho de MG a 170 px e derruba um bunker de 1000 HP com 3 granadas (o fuzileiro não alcança) |
| Assalto × fuzileiro | 59,5 × 47,6 px/s |
| Trincheira sob supressão 1,2 | exposição 0,35 → 0,18 |
| Água funda | 0 tiros (7 no seco, no mesmo intervalo) |
| Explosão a 60 px | avança 15 px em 1 s (47 longe dela) |
| Mira do jogador | erro de 0,000 → 0,040 rad sob supressão 1,6 |
| MG operada pelo jogador | 15 tiros em 2 s, 0 px de deslocamento |
| Corpo do disparo | Springfield 509 Hz × Gewehr 98 411 Hz |
| Render offline, mesmos eventos | som antigo: pico 0,19, −41 dB chapado; novo: calmo −45 dB, tiroteio −37,5 dB, barragem −18,5 dB com pico 0,66 |
| Áudio com 300 unidades | 349 nós/s |
| Caça × bombardeiro | abate em 7,7 s |
| Ataque ao solo | rota a 90°, supressão 0,68 na vala |
| Observação | dispersão 60 → 21 px |
| Bunker | vazio: 0 rajadas; guarnecido: 19 em 5 s |
| Barragem de 60 s sobre 8 homens | 8 mortos sem abrigo, 6 com |

**Custo e limites.**
- Custo de CPU com 318 unidades: cerca de +1 ms por `update` (12,2–13,2 × 11,5 ms). O render não teve diferença mensurável.
- O `verify-battle` passa com os módulos ligados: 4 de 4 rodadas, média de 23,4–30,1 ms por quadro com a máquina ocupada (sem os módulos: 19,2–23,5 ms).
- Uma falha intermitente (4 de 7 rodadas) acontecia dentro de `operations.js`/`learning.js` (`reading 'invasion'` / `'losses'`). A causa era do `aviation.js`: com passo de 0,1 s, o avião de observação pousava exatamente no ponto de órbita, e no quadro seguinte `dx/d` com d=0 dava NaN. Abatido por um caça inimigo, ele gerava uma explosão em NaN que contaminava a posição de todas as unidades. Corrigido, com teste de regressão (`dt=0,1` e caça inimigo).
- **Efeitos no equilíbrio** (para quem ajusta o balanço):
  - médicos não atiram, e o inimigo não os mira a mais de 60 px;
  - pelo hospital volta menos gente que os 78% antigos, mas parte dos evacuados retorna como reforço;
  - o bunker fica mudo até ter guarnição (chama até 2 homens ociosos);
  - a IA passa a gastar com aviação e com o bombardeiro, respeitando a reserva de obras. Sem a reserva, o gasto da engenharia no `verify-battle` caía de 636–816 para 396–666; com ela ficou em 516–848;
  - trincheira suprimida fica mais protegida, mas para de atirar a partir de supressão 0,9.
- **E** no modo soldado, por prioridade: ferido > MG > abrigo > saque (gancho de 1 linha no `soldier-tactics.js`) > canhão/tanque.
- Pendentes: itens de UI U1, U2, U7–U10 e U12–U16 do diagnóstico; auditoria visual de canhão, MG pesada e animação da guarnição (o morteiro já tem projétil em voo); fôlego, ferrolho e munição finita; cone de visão; granada cozida; passos e lama no áudio; variações de classe por nação além dos nomes.

### Gás mostarda 2.0 e máscaras visíveis (`dist/assault.js`)
- **Nuvem:** cada rolo é desenhado em duas camadas (corpo rente ao chão e coroa mais clara), em amarelo-oliva mostarda. As bordas são irregulares por ruído de valor e o miolo "rola", com as variantes trocando por cross-fade. No impacto, os rolos se abrem para fora e a nuvem cresce até ~88 px por rolo, indo com o vento e escorrendo para as crateras.
- **Chão:**
  - névoa rasteira mais densa onde o gás se acumula (crateras, trincheiras);
  - respingo do líquido no impacto;
  - **resíduo persistente:** a terra fica manchada de amarelo por ~90 s depois que a nuvem passa (só visual).
  - Névoa e resíduo são manchas redondas sobrepostas, sem grade aparente.
- **Dano do gás:** sai direto da vida, sem o clarão de impacto nem o sangue a cada tique. Só o golpe final passa pelo `damage()`.
- **Máscara no sprite:** quem está de máscara (`u.mask`) é desenhado com ela. O rosto é achado nas fileiras de pele mais altas do sprite e recolorido, com cache por sprite, então funciona em toda vista e todo quadro.
  - EUA: respirador SBR cáqui-acinzentado com mangueira.
  - Alemanha: Gummimaske de borracha escura com filtro redondo.
  - Os dois têm lentes de vidro com reflexo.

### Efeitos refinados (anim-fx.js)
Camada só visual, carregada no fim; `?animfx=0` desliga e `PXFX.state()` mostra contagens, custo (ms) e erros.
- **Explosões em etapas**: clarão + luz no chão, bola de fogo em lóbulos (núcleo de fuligem, borda acesa), anel de choque, anel de poeira, cortina de terra, torrões com sombra que quicam e ficam no chão, faíscas, brasas na cratera, coluna de fumaça que sobe e deriva com o vento (mais alto, mais vento) e fumaça residual.
- **Variantes**: granada, morteiro, 75 mm, 155 mm (coluna alta, clarão de tela), bomba de avião, e lama (gêiser negro, respingos que grudam). A água continua com o physics.js; o "dud" e o abafamento na lama, com o frontline.js.
- **Shrapnel** (nuvem branca no ar + cone de balins com poeira no chão), **cortina de fumaça** volumosa ao vento, **sopro de boca** das baterias (anel de vórtice, nuvem dirigida, poeira), fumaça dos fuzis, impacto de bala no chão, chamas animadas (fogueiras e depósito destruído) e respingos de chuva.
- O pixel.js deixa de desenhar o blast redesenhado aqui (via `PHYS.skipBlastFx` encadeado) e a cratera é carimbada por esta camada. Pool fixo em arrays tipados, sprites pontilhados em cache (aquecidos em tempo ocioso), tetos por tipo e LOD. Com 12 erros a camada se desliga e volta o padrão.

## Aviação animada (anim-air.js)

- Cada avião é um modelo 3D simples (asas, fuselagem, empenagem, montantes, rodas, tripulação) rasterizado em pixels inteiros já na orientação (64 rumos × inclinação lateral × arfagem), com luz de cima-esquerda e sombra da asa superior; cache preguiçoso com orçamento por quadro.
- Tipos: SPAD S.XIII, Sopwith Camel, Breguet 14, Salmson 2A2 (reconhecimento), Airco DH-4 (EUA); Fokker D.VII, Halberstadt CL.II, DFW C.V, Rumpler C.IV (reconhecimento), Gotha G.V de hélices propulsoras (Alemanha).
- Voo: rumo suavizado, inclinação nas curvas por mola própria (Camel nervoso, Gotha pesado), mergulho e recuperação no metralhamento, sombra que muda com a altitude, turbulência, disco de hélice, escape por motor, metralhador traseiro que gira, ronco de motor sintetizado.
- Abate: parafuso, mergulho em chamas, asa arrancada ou planeio com arrasto no chão; fumaça preta, destroços, paraquedas (alemães às vezes, aliados quase nunca), explosão moderada no impacto e destroço queimando por minutos até virar esqueleto gravado no terreno.
- `PXAIR.crash(p,por,causa)` (usado pela antiaérea do fortify.js), assume os abates do aviation.js e do reconhecimento do frontline.js. `?aviao=0` desliga · `PXAIR.anim.state()`.

## Animações da infantaria (anim-infantry.js)

Camada só visual, carregada depois de todas as que envolvem `PHYS.draw` (é a mais externa). Os quadros novos são montados com as mesmas grades do `art.js` (cabeça, tronco e pernas de cada nação, Springfield/Gewehr 98 desenhados por partes) e ficam em cache por pose, subquadro, 16 direções, nação e granadas no cinto. A geometria é a do sprite base (30×30, âncora 15,16). Nos estados que melhora, a camada troca o sprite e chama a cadeia interna com ele, então máscara de gás, recortes de trincheira, insígnias de classe, abrigo e socorro continuam valendo.
- **Marcha e corrida:** 8 quadros cada, com o passo travado na distância percorrida e balanço de tronco e cabeça. A corrida tem passada longa, tronco inclinado e fuzil em "port arms"; vale para ondas de assalto, retirada e quem anda rápido.
- **Tiro:** fuzil no ombro, com a boca no ponto do clarão do pixel.js. No coice o ombro recua e a boca sobe. Entre os tiros o ferrolho é manejado (sobe, atrás, frente, baixa) e o estojo é ejetado. Atrás de cobertura ou sob supressão, o soldado atira ajoelhado.
- **Recarga:** a lâmina segue as mesmas 6 fases do pixel.js.
- **Granada:** 6 tempos; a mão abre no instante exato em que o jogo lança (thr ≤ .28).
- **Parado:** respiração e olhadas para os lados.
- **Giro:** gradual, passando pelas direções intermediárias; no tiro trava no ângulo real.
- **Rastejar dos fixados:** grades deitadas, pré-giradas pelo RotSprite, com cotovelo e joelho alternados.
- **Morte:** tranco, joelhos cedem, tomba, e termina no próprio sprite de cadáver do art.js, 2 px acima do chão. O cadáver real é ocultado só durante a queda, para não haver corpo duplo.
- **Acerto:** o flash branco/vermelho é pintado com a silhueta da pose nova.
- `?animinf=0` desliga a camada; `PXINF.state()` mostra o estado; `PXINF.sheet(time)` gera a folha de contatos. Cada gancho tem try/catch e a camada se desliga após 12 erros.

## Animação de blindados e cavalaria (`anim-vehicles.js`)

Camada só visual, carregada por último (`?animveh=0` desliga; `PXVEH.state()` e `PXVEH.prof()` mostram contadores e custo por quadro). Envolve `PHYS.draw`, `update`, `damage`, `shoot`, `explode` e `setup`, e desenha em `WW1A.under`/`over`. Não muda dano, tiro nem IA.

- **Esteiras:** cada lado tem a própria fase, que avança pela distância percorrida (1 elo por 2 unidades). No giro no lugar, as esteiras andam em sentidos opostos, e um tanque atolado (`atr.bog`) patina sem sair do lugar. São 9 combinações × 16 direções por RotSprite, pré-aquecidas em fatias ociosas.
- **Renault FT com torre giratória:** o casco foi redesenhado sem a torre, e a torre Berliet com o canhão de 37 mm virou um sprite separado em 32 direções. Ela mira o alvo, ou o mouse no modo combatente, a ~1,7 rad/s, tem sombra própria e o cano recua no tiro. O A7V continua com o canhão de 57 mm fixo na proa.
- **Movimento e tiro:** a suspensão segue a regra do `physics.js` (casco fatiado ao meio). Há também:
  - escape (baforadas na marcha lenta, fumaça escura ao acelerar ou atolar) e tremor do motor parado;
  - poeira das esteiras no seco, pó na neve, torrões na lama e marcas das sapatas no chão seco;
  - clarão do canhão em 2 estágios na boca real, com anel de poeira;
  - MGs piscando nas casamatas do A7V voltadas para o alvo.
- **Dano e destruição:** impactos deixam cicatrizes no casco; a partir de 60% de vida sai fumaça, abaixo de 40% o casco fica chamuscado e abaixo de 30% sai fogo das venezianas. A morte tem:
  - clarão interno e jato de fogo pela escotilha;
  - cerca de 6 a 10 s de munição detonando (estalos, faíscas, traçantes);
  - torre do FT arrancada em ~60% das mortes, que gira no ar, quica e fica no chão;
  - chapas e elos voando, que ficam pintados no terreno, e mancha de queimado;
  - fogo forte, depois chamas, brasa e fumaça fina. A carcaça fica depois dos 60 s do `pixel.js`, e as mais antigas que 26 são pintadas no terreno.
- **Cavalaria:** passo, trote e galope de 4 tempos com fase de suspensão (6/6/8 quadros, também por distância), cavaleiro quicando no ritmo e poeira dos cascos. Na carga, o americano ergue o sabre e o Ulano baixa a lança com flâmula preta e branca; fora da carga, o sabre vai ao ombro e a lança fica em pé. Ao morrer, o cavalo empina, cai de lado, esperneia e fica no chão, e o cavaleiro é arremessado para a frente.
- **Truques e custo:** a carcaça do FT no cache do `tanks.js` (`tnw0_*`) é trocada por getters preguiçosos, sem editar `pixel.js` nem `tanks.js`. O `u.flash` dos tanques é zerado depois do tiro porque o clarão e o coice passam a ser desta camada. Custo medido com 4 tanques e 15–20 cavalos, Edge headless sem GPU, cache aquecido: ~0,5–0,7 ms por quadro, quase todo em partículas.

## IA de apoio — médicos e construtores

O `support-policy.js` reúne triagem e avaliação de perigo para o socorro e a construção. Médicos consideram gravidade, sangramento e chance de chegar a tempo, acompanham a retaguarda e respeitam novas ordens do jogador. Padioleiros reservam vagas e redirecionam o transporte quando um posto fica cheio ou é destruído.

Construtores priorizam obras do jogador, redistribuem equipes, liberam caídos e interrompem tarefas bloqueadas. Perigo imediato pausa a obra preservando o progresso. O planejamento considera baixas locais, postos destruídos e resultados de projetos com diferentes quantidades de etapas. Os caminhos de apoio procuram alternativas locais com menor risco observado; continuam sujeitos aos obstáculos e à movimentação física do jogo.

Validação: `tests/support-ai.test.cjs`, testes de médicos, feridos, sapadores, obras e engenharia, além de batalhas nos três mapas. Detalhes em `tests/artifacts/support-ai-notes.md`.

## Versão 1.9.1 — Pendências do passe de polish

Fechadas as pendências do diagnóstico (`docs/polish-pass-diagnostico.md`), exceto as marcadas como parciais.

- **UI (U1, U2, U7–U10, U12, U14–U16):** campanha cabe a 720p (base do INICIAR 897 → 627 px); botões de clima só no sandbox; painel de ordens vazio 203 → 129 px; renda "+12/s"; 17 cartões de Defesas sem nome truncado, atalhos Shift+1…9; Guia de Campo reescrito; ícone de reiniciar com a bandeira do lado jogado; operações com nomes únicos; fonte mínima 12 px. Testes: `tests/ui.test.cjs`, `tools/ui-geometry.cjs`.
- **Modo Soldado (`soldier-gear.js`, `?soldado=0`, `?cone=0`):** fôlego (correr 5,0 s até exausto), ferrolho (1,2 s entre tiros), munição finita do jogador (reserva 30; reabastece em depósito e saque), granada cozida (pavio 1,55 s → 0,32 s), cone de visão (tecla C; +0,09 a +0,18 ms de render). B4 (pistola do caído), B7/U13 (soldado nasce na linha de contato, seta "FRENTE") e B10 (Thompson → BAR M1918).
- **Classes por nação (`classes.js`):** Mk2 × Stielhandgranate, Springfield (350 px) × Gewehr 98 (330 px), Trench Raider × Stoßtrupp (MP18/M1897 só até 120/90 px), observador e médico com alcances próprios, sprites distintos.
- **Pesados (`battery.js`, `heavyfx.js`):** recuo do tubo, projétil de canhão em arco, poeira, freio de boca, culatra, guarnição agachando e MG pesada com efeitos.
- **Som (`soundscape.js`):** passos por superfície e lama, no máximo 14/s, sem nós novos por segundo.
- **B11, B12:** rodapé "VERSÃO 1.9", comentário do fator de obra corrigido.

**Captura de posição (QA).** `tools/qa-capture.cjs` registra quando cada ponto e setor muda de dono em batalha IA×IA. A "frente travada" era a preparação de 5 min: com o padrão, o primeiro ponto cai aos 346,5 s. Com `?preparo=60`, o ponto B muda de dono entre 106 e 108 s nas 3 rodadas de 900 s, e o ponto C troca várias vezes. Os **setores de trincheira não trocaram em nenhuma rodada**: a regra exige invasores dentro da vala com a guarnição zerada, e a IA ataca os pontos, não a trincheira.

**Pendentes:** B9 (sprite do avião de reconhecimento) não foi verificado; o caído próprio do `soldier-tactics.js` ainda é separado do `u.down`; o botão de granada do celular não cozinha; pesados e som não tiveram auditoria visual/auditiva final (as frentes foram interrompidas).

## Versão 1.10 — Construção expandida (`works-defense.js`, `works-logistics.js`, `works-manage.js`)

O catálogo da aba DEFESAS passou de 17 para 25 obras (`PXFORT.KINDS`), todas feitas pelos pioneiros em estágios, com plano da IA que só gasta acima da reserva de obras. Chaves: `?defesas=0`, `?logistica=0`, `?gestao=0`; estado em `IronFront.worksDefense|worksLogistics|worksManage.state()`. Os módulos carregam depois de `works.js` (gestão depois de `shelter.js`).

**Defesas (`works-defense.js`).** Só afetam o inimigo, como o arame.
- Campo minado (◈18/trecho, 3 minas): escondido do inimigo até pioneiro a <48 px, posto de observação a <240 px ou detonação; obus e granada detonam em cadeia. Medido: 0,55 morto e 2,0 feridos por mina; tanque imobilizado 10,1 s e 62 de dano. Pioneiros desminam (10,3% explodem neles).
- Valo anticarro (◈14/trecho): 60 de 60 tanques atolaram, 35% encalharam (9,5 s), velocidade ×0,19; infantaria ×0,72.
- Ouriços (◈24, 1400 de vida): tanque desvia e demora 6,5 s (sem peça) a 13,9 s (8 peças) para cruzar 140 px; infantaria passa.
- IA na trégua: +◈336 por lado (média de sobra ◈478 contra ◈614 sem o módulo).

**Logística (`works-logistics.js`).**
- Passadiço (◈8/trecho): na lama 100% a infantaria anda 46,3 px/s contra 16,5, e o tanque 24,2 contra 15,9.
- Linha telefônica (◈5/trecho): pedido de fogo vindo de posto, observador ou avião sem linha ligada a uma bateria sai 12 s depois e com dispersão ×1,2; explosões cortam trechos e pioneiros reparam.
- Cozinha de campanha (◈70): a ≤130 px, +0,02/s de coesão, −0,12/s de supressão e fôlego do jogador +4/s. Usa `u.cohesion`, pois `u.morale` não existe.
- Posto de franco-atirador (◈60): alcance ×1,3 (406 px) e 55% menos dano para o atirador dentro.

**Gestão (`works-manage.js`).**
- Melhorias: trincheira → revestida → concreto, ninho → blindado, bunker → casamata, saco → muro duplo, abrigo → reforçado; paga só a diferença e a obra segue útil durante o trabalho.
- Integridade: trechos de trincheira e ninhos agora têm vida e desmoronam sob bombardeio até serem reparados (a única mudança de equilíbrio; `?gestao=0` desliga).
- Reparo (50% do custo × fração de dano), demolição (devolve 40%), cancelamento (devolve o não gasto).
- Painel de obras (tecla **O**), menu por Ctrl/Alt+clique (U melhora, X demole) e fantasma de posicionamento.

**Verificação:** 36 suítes em `tests/*.test.cjs` passam e o `verify-battle` passa com os três módulos ligados. CPU: 0,23 ms por quadro nas defesas, 0,008–0,06 ms na logística e 0,023 ms na gestão.

**Limites:** na partida IA×IA real, cozinha e posto de atirador não foram construídos na guerra por falta de caixa acima da reserva (a reação só está provada em teste); nas partidas de 60 s de preparo as defesas quase não dispararam; a gestão foi interrompida durante o ajuste final do modelo de prioridade (o teste passa, mas o painel não teve revisão visual final).

## Batalhas dinâmicas e conversas — 01/10/2026

A frente padrão passou de 2400 × 1600 para **2400 × 2000**: 25% mais área, mantendo a distância entre os exércitos. Os cinco setores, objetivos, nascimentos, terreno, clima, minimapa e grades de física acompanham a nova altura. `?mapa=classico` permite comparar com a altura anterior.

Os esquadrões têm perfis equilibrado, prudente, impetuoso e protetor, memória temporária dos locais de perdas, experiência sob fogo e confiança após conquistar uma posição. Prudentes procuram cobertura sob pressão; protetores podem retirar grupos feridos; experiência reduz moderadamente o tempo de recuperação. Ordens humanas e socorro conservam prioridade.

Conversas em português aparecem junto dos soldados e em legendas, com nomes persistentes durante a partida. As falas descrevem liderança, perdas, manobras reais e conquistas; respostas exigem outro participante disponível próximo. Há limites por esquadrão e facção, expiração das mensagens e botão **CONVERSAS** no painel IA. Não há voz falada gerada nem conexão a um serviço externo.

A infantaria pode ocupar trechos de trincheira observados e acessíveis. Capturas atualizam tanto a bandeira quanto o dono das âncoras usadas pelo comando. Uma reserva pode explorar um acesso lateral observado quando o avanço principal progrediu, conservando pelo menos outra reserva. Compromissos têm prazo, controle de perdas e interrupção por prioridade local.

Arquivos novos: `battlefield.js`, `battle-stories.js`, `battle-opportunities.js` e `battle-dialogue.js`. Testes: `node tests/battle-stories.test.cjs`; integração nos três mapas e captura controlada: `node tools/verify-dynamic.cjs`. Resultados próprios em `tests/artifacts/dynamic-report.json` e `dynamic-dialogue.png`. Essas verificações cobrem integração; diversão, frequência de viradas e equilíbrio exigem partidas jogadas e uma matriz maior de simulações.

## Construção com layouts variados — 01/10/2026

Cada facção sorteia um layout no início da partida e conserva esse estilo na preparação e nas obras durante o combate: **linha em zigue-zague, redutos separados, defesa em profundidade, posições escalonadas, flancos reforçados ou defesa dispersa**. As plantas têm geometrias diferentes, posições de apoio e ligações próprias, e usam toda a altura do mapa ampliado. Os lados usam a mesma regra com posições espelhadas; sorteios independentes podem escolher o mesmo estilo.

A construção adapta prioridades para consolidar um avanço, reforçar setores pressionados, proteger um recuo e atender feridos aliados. Cada obra considera três posições locais, preserva orçamento de reforços e evita duplicatas. Ligações de comunicação procuram uma trincheira existente; o arame conserva passagens nas estradas e saídas dos grupos. A segurança avalia pontos ao longo da obra inteira, incluindo água, obstáculos, contatos observados e impactos próximos. Obras automáticas ainda sem equipe ou progresso podem ser descartadas quando a frente as deixa para trás; projetos do jogador ficam fora dessa regra.

O painel IA mostra o layout e a situação da engenharia. O sorteio ocorre uma vez por facção, sem trocar de planta a cada decisão. `IronFrontEngineering.reset(seed)` permite reproduzir o sorteio em verificações. Implementação em `dist/engineering-layouts.js`, integrada a `engineering.js` e `fortify.js`.

Validação: 36 suítes de testes passaram. `node tools/verify-layouts.cjs` executou construção dos seis estilos na preparação e obras de combate na floresta e no inverno, com saldos positivos e sem erros capturados. O teste usa 70 segundos de preparação por estilo e não estabelece equilíbrio entre eles. Comparação visual em `tests/artifacts/construction-layouts.png`, captura do jogo em `construction-in-game.png` e relatório em `construction-layouts-report.json`.

## Marcha humana — 01/10/2026 (`dist/gait.js`, refino de `anim-infantry.js`)

O fuzileiro deixou de andar como brinquedo. Antes: os 8 homens de um esquadrão partiam no mesmo quadro (0,10 s ±0), a 47,0 u/s idênticos, em linha reta (desvio lateral 0) e giravam de uma vez (90° em ~0,1 s). Agora, medido no navegador com o mesmo esquadrão, a mesma ordem e `?marcha=0` como controle:

| | original | marcha humana |
|---|---|---|
| partida após a ordem (esquadrão de 8) | 0,10 s ±0 | 0,47 s ±0,07 (reação de 0,03–0,26 s + rampa de aceleração) |
| velocidade de cruzeiro | 47,0 u/s, todos iguais | 50,5 ±1,3 u/s (cada soldado tem o seu, 41–58 u/s com a oscilação lenta) |
| desvio lateral em 400 u | 0 | 3,5 u RMS (≈1,7 px), some perto do destino |
| giro de 90° andando | rumo vira num quadro | 3,4 rad/s, velocidade cai a 40 u/s na curva |
| meia-volta parado → andando | instantânea | corpo alinha em 0,47 s e só então ganha velocidade |
| tempo para 400 u | 8,0–8,2 s | 8,2 s (±3 %: o cruzeiro 4 % mais rápido paga partida, rampa e chegada mais lentas) |
| ordem cancelada em pleno passo | trava | desliza 17 u em 0,63 s (a chegada normal já alivia o passo a 60 % em 20 u) |

**Movimento (`gait.js`)** — um gancho de 1 linha em `physics.js` (`stepFoot`, depois do contorno de parede, antes da separação) entrega a velocidade desejada final a `PHYS.gait`, que a devolve moldada: fator de velocidade fixo por `id` (média 1,04, ±12 %) mais oscilação lenta (±5 %); atraso de reação individual na partida (só se ficou parado > 0,6 s; ≤ 0,1 s sob fogo; nenhum na retirada e no assalto); rumo da marcha com inércia (6,5 rad/s parado → 3,4 andando) e queda de velocidade enquanto o corpo não alinha; desvio lento do rumo (período 6–11 s) mais balanço curto; aceleração limitada e deslize em vez de parada seca (medido: parado → 90 % do cruzeiro em 0,77 s e 19 u, antes 0,2 s e 8 u; o teto `AMAX` de 190 u/s² vale só uns 30 % na prática, porque a inércia do `physics.js` segue apenas parte do pedido a cada quadro); aclive custa até 15 %, declive devolve até 8 % (`PHYS.gradAt`). Sem alvo, o corpo olha para onde anda. Não mexe em jogador no Modo Soldado, tanques, cavalaria, guarnição de MG, pioneiro cavando/deitado/fugindo de obus, ferido, fixado, esquiva de granada, trincheira nem baioneta; pioneiros e a tropa da trégua andam com a marcha nova. Constantes em `PXGAIT.cfg`; `?marcha=0` desliga só o movimento (o desenho novo continua, `?animinf=0` o desliga); `PXGAIT.state()`; por soldado fica `u.gt`.

**Desenho (`anim-infantry.js`)** — passada própria (`u.gt.sl`) e fase do passo travada na distância (`u._wp`), com passo mais curto a baixa velocidade; poses novas `P_AMBLE`/`P_AMBLEF` (passo curto de quem arranca ou freia, inclinado nos primeiros 0,55 s depois de arrancar, histerese 19/27 u/s para o passo curto; sem pisca-pisca com `dt` irregular); o fuzil desce um quadro depois do tronco e a boca balança com o passo; ombros trocam de lado de frente e de costas; alívio de 0,45 s ao parar (o fuzil desce); giro exibido que sai e chega com suavidade (pico de 9,8 rad/s contra 14); pioneiros em marcha na trégua usam os quadros novos com a pá nas costas. Corrida só acima de 66 u/s (antes 54, que o ritmo individual passaria).

Validação: `node tests/gait.test.cjs` (ritmo, partida, giro, pivô, trajeto, deslize, tempo de marcha ±5 %, exclusões idênticas ao original, assalto sem atraso, `?marcha=0`); as 37 suítes de `tests/` passam (as antigas não carregam o `gait.js`, então a de `physics` confirma só que o gancho guardado não muda nada sem ele). Custo medido com 156 unidades: 5,6 → 6,0 ms por `update`. Trégua de 25 s com IA: 136 soldados com marcha, 0 erros, obras progredindo como antes (207 × 178 segmentos, variação normal). Equilíbrio de combate **não** foi comparado em várias partidas: só o tempo de marcha de 400 u foi igualado (±3 %); uma batalha de 40 s com a marcha ligada e desligada deu resultados diferentes, mas com uma semente cada é ruído.

**Limites:** a cadência é de trote porque a velocidade-base do jogo (47 u/s ≈ 2,9 m/s na escala do sprite) é de trote — não mexi nas velocidades. Conferi quadros e números, não a animação rodando em tempo real. O Modo Soldado (WASD) mantém o movimento do jogador como era; só o desenho ganhou os quadros novos. Pegadas e poeira de passo não foram feitas.

## Bandeiras na retaguarda — 01/10/2026

Os objetivos agora são duas bandeiras, uma atrás das linhas de cada facção, em x=260 e x=2140. Cada lado começa dono da própria base; não há bandeira neutra no meio do campo. Na Conquista, controlar as duas bases encerra a partida com vitória; perder reforços em combate continua sendo outra condição de derrota. Manter a bandeira inicial não drena automaticamente os reforços do adversário. O Sandbox continua sem encerramento por conquista.

A IA destaca uma guarnição para proteger a própria bandeira, reforça essa defesa ao observar inimigos próximos e prioriza recuperar a base perdida. Os outros grupos avançam para a base inimiga, mantendo uma reserva móvel quando há esquadrões suficientes. O mapa clássico conserva a mesma posição proporcional na altura.

Validação: `tests/base-objectives.test.cjs` cobre captura, disputa, vitória e ordens dos dois lados; `tools/verify-bases.cjs` verifica no navegador os três terrenos, guarnições, vitória de cada facção e ausência de perda inicial de reforços. Relatório em `tests/artifacts/base-objectives-report.json`.
