# Refino de combate — comparação local

Quatro cenários de Conquista, 80 unidades de capacidade por facção, 180 segundos simulados, dificuldade normal e preparação desligada. Mapas trincheiras/floresta, papéis espelhados, sementes 907/908. Relatórios completos em `balance-before.json` e `balance-after.json`; reprodução com `tools/balance-battle.cjs`. Cada amostra usa os mesmos parâmetros iniciais e a mesma semente antes/depois. Alterações de decisão mudam o consumo posterior de números aleatórios. A amostra é pequena e não estima taxa de vitória, nem representa todas as partidas.

| Cenário | Tempo na fase de avanço | Baixas dos participantes iniciais do atacante | Objetivos do atacante ao fim (de 3) |
| --- | --- | --- | --- |
| trenches / atacante 0 | 19.4% → 38.9% | 16 → 15 | 3 → 2 |
| trenches / atacante 1 | 19.4% → 38.9% | 0 → 1 | 3 → 2 |
| forest / atacante 0 | 75.0% → 66.7% | 5 → 2 | 1 → 3 |
| forest / atacante 1 | 27.8% → 38.9% | 16 → 17 | 3 → 2 |

Média de tempo em avanço: 35.4% → 45.8%. A primeira ofensiva ocorreu aos 25 segundos em todos os cenários, preservando a abertura agressiva. Cenários com os três objetivos nas mãos do atacante: 3/4 → 1/4. Isso mede posições aos 180 segundos, não vitórias. Menor saldo observado: 14.0 → 37.8; nenhum saldo negativo.

## Contas e decisões

- Fuzil: dano bruto nominal 30/1,5 = 20 por segundo; MG: 13/0,22 ≈ 59,1; canhão do tanque: 105/3,2 ≈ 32,8 antes da explosão. Custos por combatente: 80/8 = 10 para fuzileiro, 100/3 ≈ 33,3 para MG, 260 por tanque. Esses valores ignoram precisão, recarga, aquecimento, supressão, blindagem e cobertura; não são dano efetivo esperado. Danos e preços foram mantidos.
- A força disponível é a soma de peso do tipo × fração de vida × fator de supressão, com fator entre 0,65 e 1. Feridos caídos, fixados, sapadores ocupados, combatente controlado e ordens humanas não liberam ataques automaticamente. Um soldado disponível não torna disponíveis os outros sete do esquadrão.
- Retenção da ofensiva: média das frações de vida dos participantes originais. Com menos de 65%, reorganiza. Novas compras não substituem os participantes na conta; ordens humanas saem da avaliação. Perdas de outras forças não interrompem o ataque por si só.
- Progresso usa distância em duas dimensões dos participantes efetivos; reservas e bases de fogo deixam de provocar estagnação artificial. O relógio de 55 segundos sem progresso, supressão máxima de 1,3, reserva inicial de aproximadamente 16% e proporção de cobertura de um terço foram mantidos.
- Defesa dedica parte da infantaria aos objetivos próximos e pode recuperar uma posição antes possuída, dentro da própria metade, a menos de 320 unidades da frente. Exige pelo menos 6 de força e 1,3 vezes a ameaça observada; dura até 30 segundos. Contra-ataques possuem 12 segundos de recuperação.
- Reposição conserva pelo menos 8 fuzileiros e busca 50% dos combatentes em infantaria antes de comprar apoio caro, respeitando dinheiro e capacidade. Cautela por baixas tem decaimento exponencial de 150 segundos (meia-vida ≈ 104 s), evitando passividade permanente.
- Tanques automáticos verificam aliados na área do impacto no instante do disparo. O jogador conserva seu próprio controle de fogo. Avaliações de formação passam a contar perdas durante supressão automática; entrar em coluna reinicia a avaliação de formação.
