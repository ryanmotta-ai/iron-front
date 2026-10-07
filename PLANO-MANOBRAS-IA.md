# Manobras da IA — pacote implementado

O objetivo é tornar as decisões legíveis e criar mudanças de rumo através das tropas, do reconhecimento e do apoio já existentes. A sequência implementada é: planos em etapas, adaptação ao adversário, emboscadas e conversas ligadas às decisões.

## Ataque combinado

Uma MG inimiga recém-observada pode iniciar uma manobra com dois esquadrões de infantaria e uma equipe de fogo disponíveis. A guarda da base, a reserva, grupos em recuperação, serviços e equipes já comprometidas com outra missão ficam fora da seleção.

1. A patrulha alcança um acesso lateral e verifica visibilidade, terreno e perigo observado.
2. A equipe de fogo chega à posição de cobertura. A passagem só libera quando há supressão observada ou fumaça presente.
3. A patrulha contorna a posição e precisa alcançar o flanco.
4. O assalto principal avança quando a operação está autorizada. O sucesso exige progresso dos dois grupos, não apenas o término do diálogo.

A aviação recebe prioridade de reconhecimento nesse acesso quando há avião disponível, condições de voo, orçamento e intervalo entre missões. Os relatos aéreos continuam usando a inteligência compartilhada existente. Uma missão aérea aceita não substitui a chegada da patrulha.

## Hábitos e emboscada

O comando registra deslocamentos relatados em cinco setores proporcionais ao tamanho do mapa. Uma unidade parada ou um relato repetido não conta como um novo ataque. Duas aproximações distintas podem sugerir um acesso recorrente, deslocando a reserva defensiva e parte da cobertura. A confiança diminui durante a partida e os contatos usados para medir movimento expiram.

Em defesa, uma aproximação observada no acesso recorrente pode preparar uma emboscada com infantaria e MG existentes. A isca só recua após a cobertura e a equipe lateral chegarem. A emboscada fecha somente se inimigos observados realmente perseguirem a isca. Ignorar o recuo encerra a tentativa; o adversário conserva suas próprias decisões.

## Conversas e prioridades

Os relatos de MG, passagem lateral, cobertura pronta e perseguição correspondem às transições efetivas do plano. A resposta vem de outro líder com uma ordem compatível, e deixa de aparecer caso essa ordem mude. O painel IA mostra a etapa atual, o motivo do encerramento e o hábito observado.

Há no máximo uma manobra desta camada por exército, além das ações conjuntas existentes com outras equipes. Cada etapa tem prazo de 25 segundos; espera pela perseguição, 18; assalto, 24; a manobra completa, 100. Sem resultado, as tropas retomam o plano principal. Há recuperação de 35 segundos entre tentativas. Perda de contato, mudança grande da posição inimiga, prioridade local, ordem humana, resgate, supressão alta ou perda de mais de 28% da vida original encerram a manobra. Reforços posteriores não mascaram essas perdas.

O aprendizado anterior também foi corrigido para usar a altura real do mapa ampliado. Recursos, dano e quantidade máxima de unidades continuam sob os sistemas de jogo existentes.

## Verificação

`tests/battle-plans.test.cjs` verifica chegada real, visibilidade, supressão, autorização do assalto, emboscada ignorada, perda de contato, baixas, comando humano, hábitos temporários, respostas compatíveis e simetria entre facções. `tools/verify-battle-plans.cjs` executa partidas nos três mapas com recursos finitos e verifica ordens nativas, painel e renderização. Os resultados ficam em `tests/artifacts/battle-plans-report.json`.

Estas verificações cobrem funcionamento e regressões. Equilíbrio de vitória em partidas longas, fintas ofensivas com terceiro esquadrão, inteligência por sons e pedidos específicos de pioneiros continuam como próximas melhorias.
