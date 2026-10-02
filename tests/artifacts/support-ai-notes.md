# IA de médicos e construtores

## Comportamento implementado

- Triagem combina gravidade, sangramento, tempo de deslocamento e perigo observado. Resgates que não chegam antes do sangramento são descartados.
- Médicos desocupados acompanham a retaguarda da infantaria; resgates interrompidos não são repetidos imediatamente. Uma nova ordem do jogador preserva seu destino e interrompe o socorro.
- Padioleiros reservam vagas antes de sair. Se o posto de destino ficar cheio ou for destruído, procuram outro posto disponível, mantendo o transporte físico.
- Deslocamentos de apoio avaliam alternativas locais para evitar impactos iminentes, arame e posições inimigas observadas. Não substituem a navegação física nem garantem passagem por qualquer obstáculo.
- Construtores priorizam obras do jogador, aproveitam obras parcialmente executadas, liberam soldados caídos e redistribuem equipes sem abandonar toda a construção automática.
- Obras sob perigo imediato são pausadas, preservando o progresso. Trabalhadores sem progresso deixam a tarefa e evitam retornar imediatamente ao mesmo bloqueio.
- A escolha de obras considera baixas locais e postos destruídos. A avaliação de resultados reconhece projetos com diferentes quantidades de etapas, alimentando o aprendizado de construção já existente.

## Validação

`tests/support-ai.test.cjs`: triagem, tempo de chegada, desvio de impacto, ordens humanas, distribuição de médicos, reserva de vagas, troca de posto durante transporte, prioridade de construção, liberação de caídos, pausa sob fogo e bloqueio.

Testes existentes de médicos, feridos, sapadores, obras e engenharia passaram. A validação no navegador passou nos três mapas, com ordens manuais, alternância de funções, reinício e ações conjuntas. A simulação de economia de 180 segundos manteve saldo positivo (mínimo observado: 76) e até quatro projetos ativos.

Uma execução geral encontrou o limite de tempo do teste independente de obras defensivas em 1,008 ms; a repetição isolada passou em 0,546 ms. Nenhuma regra ou limite desse teste foi alterado.
