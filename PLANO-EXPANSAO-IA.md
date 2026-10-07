# Plano de expansão da IA de batalha

Proposta de 1 de outubro de 2026, com primeiro pacote implementado. O roteiro abaixo continua descrevendo a expansão completa; a seção de andamento distingue as entregas disponíveis das próximas etapas. Os valores propostos são pontos de partida para calibração, não resultados de testes.

## Andamento da implementação

Disponíveis: intenções estáveis por esquadrão e tentativa de outro acesso após bloqueio; prioridade para comandos humanos, médicos, resgates, evasão e engenharia; líderes com substituição breve; perfis e moral coletiva com perdas, coesão, supressão e recuperação. O apito existente ajuda a recompor o grupo. A fadiga tem efeito máximo de 8% na avaliação de prontidão, sem modificar atributos das armas.

O reconhecimento agora verifica obstáculos, preserva a posição realmente relatada, usa atraso de 2 segundos para contatos distantes, reduz confiança e expira após 35 segundos. Patrulhas retornam diante de resistência superior. Fixar/flanquear exige apoio de fogo aliado próximo; a retirada alterna cobertura e deslocamento. Contatos em trincheira permitem avançar por trechos. Depósitos nativos com estoque real servem ao reabastecimento e entram nas decisões de engenharia quando falta munição de granada. O aprendizado passa a distinguir terreno, visibilidade e ameaças observadas, com influência contextual limitada.

O painel IA mostra liderança, recuperação e relatos; líderes aliados recebem um sinal discreto, e posições antigas aparecem com contorno pontilhado no minimapa. `?humanizar=0` permite comparar com o comando anterior. A memória é reiniciada em cada partida.

Segundo pacote disponível: pedidos de apoio contra MGs atribuem equipes distintas para cobertura e flanco. Passagens abertas pelo sistema de sapadores recebem assalto com reunião curta e cobertura, após verificar observação local, arame restante e impactos iminentes. O defensor usa uma equipe para conter um acesso ameaçado, preservando outras guarnições e dando prioridade ao contra-ataque principal.

As ações conjuntas têm participantes persistentes, prazo, limite de duas ações simultâneas e interrupção por perdas, falta de apoio, alteração da operação ou controle humano. Resultados de manobra são avaliados por participantes originais e visibilidade; reforços não apagam baixas e perder contato não produz vitória fictícia. Resultados ruins elevam a força exigida para novos pedidos de apoio. O painel IA mostra as ações; `?coordenacao=0` desliga somente esta camada.

Terceiro pacote disponível: reconhecimento lateral, cobertura, flanco e assalto com condições reais entre etapas; hábitos de aproximação observados; reposicionamento defensivo e emboscada por recuo como isca; relatos e respostas ligados às ordens; reconhecimento aéreo do flanco. Escopo, prazos e verificação em `PLANO-MANOBRAS-IA.md`.

Ainda previstas: pedidos mais amplos de fumaça, pioneiros e blindados entre líderes, inteligência por sons, turnos de passagem estreita, fintas ofensivas, avisos novos de fogo amigo e memória opcional entre partidas.

Verificação: testes de esquadrões e inteligência, regressão das suítes existentes e integração no navegador por `tools/verify-human.cjs`. A matriz de 108 cenários abaixo continua sendo uma validação futura de equilíbrio, não um resultado já obtido.

## Experiência desejada

Batalhas com iniciativa, hesitação breve, coordenação, perdas, recuperação e mudanças de plano. O atacante mantém pressão e procura oportunidades; o defensor protege posições, cede terreno quando necessário e reage a conquistas. O jogador percebe o motivo das ações e consegue influenciar a batalha como comandante ou soldado.

Exemplo de sequência desejada: uma patrulha identifica uma MG, relata a posição e procura cobertura. Uma equipe mantém fogo enquanto outra tenta um acesso lateral. Pioneiros abrem passagem, o tanque espera a infantaria sair de sua linha de tiro e o avanço acontece em grupos. Ao perder vários homens, um esquadrão recua sob cobertura e se reorganiza; outro mantém o esforço. O defensor desloca uma reserva para a brecha, sem abandonar todos os objetivos. A sequência depende do que aconteceu no campo, sem ser uma cena obrigatória.

## Base que vamos ampliar

Já existem cinco setores, esquadrões persistentes, fases de operação, reservas, posições nas trincheiras, formações, supressão, coesão, socorro, construção adaptativa e aprendizado por resultados. Há também apito e comandos contextuais no modo soldado. A expansão deve conectar esses sistemas e evitar duplicar moral, socorro ou liderança.

O refino anterior comparou quatro cenários curtos. Ele fornece uma referência inicial; não demonstra equilíbrio geral entre mapas, escalas e condições climáticas.

## Etapa 1 — Comando consistente e diagnóstico

**Entrega:** cada tropa recebe uma intenção clara, com origem, prioridade, prazo e condição de término. Os sistemas deixam de disputar destinos ou usar a mesma marca de tempo para representar comandos diferentes.

- Separar ordens do jogador, tarefas de engenharia, emergências, decisões de esquadrão e ordens da operação.
- O combatente controlado permanece com o jogador. Ordens humanas têm prioridade sobre planos automáticos; reações permitidas de sobrevivência são temporárias e retomam a missão quando o perigo passa.
- Estabilizar destinos: uma pequena variação no alvo não desmonta a formação nem reinicia toda a rota.
- Registrar por que um ataque começou, parou, mudou de acesso ou pediu apoio.
- Identificar grupos presos em passagens, destinos inalcançáveis e tempo sem missão útil.

**Aceitação:** nenhum novo comportamento toma controle de uma tropa comandada pelo jogador; nenhuma unidade troca repetidamente de tarefa sem mudança relevante no campo; os testes atuais continuam passando.

## Etapa 2 — Esquadrões com liderança e comportamento humano

**Entrega:** líderes de esquadrão, moral coletiva e reações diferentes ao mesmo perigo.

- Um líder organiza deslocamento, escolhe cobertura próxima e pede apoio. Se cair, a liderança passa a outro integrante após uma breve reorganização.
- Moral considera supressão, coesão existente, perdas recentes, apoio próximo, isolamento e sucesso da missão. Supressão continua sendo a reação imediata ao fogo; moral expressa a capacidade de manter o plano.
- Perfis discretos — prudente, equilibrado e impetuoso — alteram decisões dentro de limites. As duas facções usam as mesmas regras, e a identidade do grupo permanece entre decisões.
- Estados compreensíveis: confiante, sob pressão, abalado e reorganizando. Um grupo pode recuar sem obrigar o exército inteiro a desistir.
- Pequena variação nos tempos de reação evita que todos parem ou levantem juntos. Variação não pode ignorar uma ordem válida nem provocar exposição gratuita.
- Integrar o apito e os pings existentes: ajudam a reunir e orientar aliados; efeitos novos não acumulam bônus ou imunidades sem limite.

**Valores iniciais propostos:** personalidades variam limiares em até 10%; avaliar 20–30 segundos de perdas recentes; recuperar moral em aproximadamente 15–30 segundos sob condições favoráveis. Esses intervalos serão ajustados às distâncias e ao ritmo reais.

**Aceitação:** sob fogo, alguns grupos cobrem e outros se reorganizam; liderança perdida não produz colapso automático; o atacante volta a pressionar depois de recuperar força.

## Etapa 3 — Inteligência local e reconhecimento útil

**Entrega:** informações com origem, idade e confiança, compartilhadas por esquadrões.

- Diferenciar inimigo visto agora, última posição conhecida e região suspeita. Uma posição antiga não acompanha o inimigo invisível.
- Considerar obstáculos e visibilidade ao detectar contatos; reconhecimento deixa de depender apenas da distância global até qualquer aliado.
- Relatos chegam ao comando e aos grupos próximos com pequeno atraso. Uma unidade reage imediatamente ao perigo que vê, mesmo antes do relato.
- Patrulhas investigam acessos e retornam quando encontram resistência excessiva. Não são enviadas repetidamente para morrer no mesmo lugar.
- Sons e impactos podem indicar uma região de perigo, sem revelar coordenadas exatas nem permitir tiro preciso através de obstáculos.
- No minimapa, informações antigas aparecem com marca diferente e expiram. O jogador pode escolher o nível de detalhe.

**Aceitação:** a IA consegue agir com informação incompleta, não persegue posições invisíveis e pode ser surpreendida por uma mudança de acesso. Atrasos não bloqueiam a autopreservação.

## Etapa 4 — Manobras coordenadas e combate de trincheira

**Entrega:** ações com participantes, etapas, requisitos, prazo e alternativa em caso de falha.

| Manobra | Atacante | Defensor | Sinal para o jogador |
| --- | --- | --- | --- |
| Fixar e flanquear | Um grupo contém a ameaça e outro busca o lado | Reorienta fogo e envia reserva limitada | Papéis e caminhos distintos |
| Assalto a uma brecha | Espera passagem, cobertura e posição de apoio | Fecha a brecha ou prepara uma segunda posição | Pioneiros e tropas convergindo por etapas |
| Escolta de blindado | Infantaria acompanha pelos lados, mantendo distância segura | Separa o tanque de sua escolta e concentra resposta disponível | Formação adaptada ao veículo |
| Recuo coberto | Parte recua enquanto outra protege | Aproveita a oportunidade sem perseguir indefinidamente | Retirada alternada, com limite de perseguição |
| Defesa em profundidade | Pressiona e consolida cada conquista | Usa linha de apoio e preserva rotas de retirada | Mudança visível entre posições |
| Limpeza de trincheira | Avança por pequenos trechos, verifica ameaça e protege acessos | Isola trechos perdidos e tenta recuperação local | Grupos distribuídos ao longo da trincheira |

- A formação depende do terreno e da direção do movimento. Passagens estreitas usam fila e turnos; grupos se dispersam ao sair, reduzindo aglomeração.
- Uma manobra só começa com participantes disponíveis. Se faltar tanque, fumaça, passagem ou cobertura, escolhe uma alternativa real.
- Fogo amigo continua limitando explosivos. O jogador recebe aviso antes de apoio que possa cruzar seu deslocamento.
- Fintas podem entrar depois que reconhecimento e relatos forem validados: mobilizam poucas tropas e só funcionam se forem observadas pelo adversário.

**Aceitação:** conseguir mostrar cada manobra em cenários próprios, incluindo falha e retirada. A ausência de um recurso não deixa o grupo esperando indefinidamente.

## Etapa 5 — Ritmo, reservas e logística durante a batalha

**Entrega:** operações encadeadas por oportunidades do campo, com esforço principal e objetivos locais claros.

- Transformar rupturas e conquistas em próximas decisões: consolidar uma passagem, proteger o flanco, trazer apoio ou continuar um avanço com força suficiente.
- Revezar esquadrões muito desgastados. Reservas entram para substituir, explorar uma abertura ou defender um objetivo, com limite para evitar que todas sejam consumidas juntas.
- Preparar uma reserva do defensor contra pressão observada, preservando guarnições e caminhos de retirada.
- Integrar engenharia: construir onde uma posição foi estabilizada, abrir ligações protegidas e evitar gastar em linhas já abandonadas.
- Introduzir pontos de abastecimento e tarefas curtas de reposição somente após validar o ritmo das manobras. Reusar a munição e os sistemas de apoio existentes antes de criar uma economia paralela.
- Se houver fadiga nova, usar efeito moderado e recuperável. A primeira versão pode afetar prontidão para outra manobra, antes de penalizar velocidade e precisão.

**Aceitação:** batalhas alternam pressão, conquista e recuperação; sempre existe uma missão útil para a força disponível. Logística cria escolhas e oportunidades sem exigir micromanagement obrigatório.

## Etapa 6 — Aprendizado contextual e decisões legíveis

**Entrega:** avaliar qual ação funciona em determinada situação, com explicações curtas.

- Separar contextos amplos: terreno aberto/trincheira/passagem, baixa/alta visibilidade, ameaça predominante e disponibilidade de apoio.
- Avaliar resultados dos participantes originais: progresso, objetivo mantido, perdas, tempo gasto, apoio consumido e utilidade posterior da posição.
- Distinguir fracasso de manobra, falta de recursos, rota bloqueada e mudança de ordem do jogador. Não atribuir tudo ao mesmo motivo.
- Testar alternativas quando a situação permite; não experimentar ações perigosas com um grupo já em colapso.
- Limitar memória e reduzir a influência de experiências antigas. Começar com aprendizado dentro da partida; memória entre partidas será uma opção posterior, separada da dificuldade.
- Mostrar mensagens breves: “MG observada: preparando flanco”, “esquadrão abalado: reserva assumindo”, “passagem bloqueada: buscando outro acesso”. Animações e ícones indicam liderança, reunião e tarefas de apoio.

**Aceitação:** resultados favoráveis mudam escolhas futuras em situações comparáveis; perdas continuam relevantes após receber reforços; o jogador consegue entender a maioria das mudanças sem abrir um painel técnico.

## Cálculos e validação

Definir antes de cada etapa o problema que ela deve melhorar. Conservar uma versão de referência e comparar os mesmos parâmetros iniciais e sementes. Mudanças na lógica alteram o consumo posterior de aleatoriedade; a comparação não representa sequências idênticas de impactos.

Medir:

- tempo em avanço, defesa ativa, reorganização e inatividade involuntária;
- perdas efetivas dos grupos participantes, conquistas e tempo mantendo objetivos;
- reservas usadas com propósito, obras aproveitadas e gasto por objetivo mantido;
- episódios de aglomeração, rota bloqueada, fogo amigo e trocas repetidas de ordem;
- sobrevivência e resposta dos aliados às ordens do jogador;
- custo de decisões, atualização e desenho nas escalas suportadas.

**Matriz completa proposta:** 3 mapas × 2 lados atacantes × 3 escalas suportadas × 2 condições climáticas × 3 sementes = 108 cenários por rodada. Usar uma seleção curta durante implementação e a matriz completa em marcos importantes. Acrescentar casos com os dois lados ofensivos, inferioridade numérica, pouco dinheiro, controle humano e perda de líder.

O tempo inicial de ataque já medido em quatro cenários foi de 25 segundos. Usá-lo como referência de ritmo, sem transformá-lo numa obrigação em toda situação. Retirada deve acompanhar incapacidade real; progresso ou conquistas não devem depender de ignorar perdas.

As metas de vitória, duração e baixas serão definidas depois de ampliar a referência. Não impor 50% de vitória a todo mapa nem declarar equilíbrio a partir de poucos testes. Validar diversão e legibilidade também assistindo partidas e jogando como soldado e comandante.

## Integração e desempenho

`operations.js` continua escolhendo objetivos e coordenando a força. `ai.js` mantém reações individuais. `formations.js`, `learning.js` e `engineering.js` recebem extensões focadas. Liderança, intenção de esquadrão e inteligência podem ter módulos próprios com dados compartilhados, evitando novas camadas que sobrescrevem a mesma ordem.

Reutilizar a grade espacial, guardar avaliações de cobertura/rotas por um intervalo curto e distribuir decisões dos grupos entre atualizações. Comando geral decide menos frequentemente; emergências locais recebem prioridade. Medir o custo antes de elevar a quantidade de tropas. Features novas precisam poder ser desligadas para comparação e diagnóstico.

## Primeiro pacote recomendado

Implementar as etapas 1 e 2 com escopo limitado: intenção de esquadrão estável, liderança com substituição, moral integrada à coesão, reorganização curta e sinais visuais. Comparar esse pacote com a versão atual antes de acrescentar inteligência com atrasos ou manobras complexas.

Depois, entregar reconhecimento e duas manobras demonstráveis — fixar/flanquear e recuar sob cobertura. Essas entregas formam a base para as grandes operações e a logística.

O plano preserva a preferência já definida: atacante ativo, defensor organizado, aprendizado durante a batalha, formações claras, construção útil e prioridade ao controle do jogador.
