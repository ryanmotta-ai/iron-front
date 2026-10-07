# Escala e integração do combate — 02/10/2026

O padrão passa a ser **120 unidades terrestres por exército, 240 no total**, incluindo pioneiros, especialistas e feridos vivos. O limite aéreo é separado: **8 aeronaves em missão por lado**, incluindo quem está taxiando para decolar.

## Cálculo e medição

O mapa padrão mede 2400 × 2000 = 4.800.000 unidades quadradas. Com 240 combatentes, a média global é 20.000 unidades quadradas por combatente, equivalente a um quadrado de aproximadamente 141 × 141. Essa média serve para comparar escalas; a ocupação real é concentrada nas trincheiras e nos setores escolhidos pelos comandantes.

Para estimar a ocupação dos cinco setores usados pela IA, reservar aproximadamente 25% de um exército de 120 para guarnição, reserva e apoio deixa cerca de 90 participantes, ou 18 por setor antes de concentrar o ataque. Essa é uma conta de projeto, não uma distribuição obrigatória das tropas. Há espaço para grupos de fuzileiros, metralhadoras, blindados e equipes de construção sem depender de uma frente inteiramente preenchida.

O teste terrestre comparou 80, 120, 160 e 240 por lado nos três mapas, usando a mesma semente, ambos os comandantes e suprimentos finitos. Cada partida durou 180 segundos simulados. A atualização no percentil 95 ficou em 17–20 ms com 120 por lado e 43–57 ms com 240. Dados completos: `gameplay-baseline.json`.

Uma segunda matriz compara 120 e 160 com o novo sistema aéreo. `gameplay-balanced.json` contém renda, baixas, fases de operação, aviões, despesas, tempos de atualização e tempos de quadros consecutivos. O desenho é medido separadamente: tempos de renderização com saltos na simulação incluem criação de sprites e não devem ser interpretados como FPS. O teste é feito no Edge sem janela; os tempos não garantem o desempenho em outros computadores.

## Economia e comando aéreo

| Missão | Suprimentos | Formação solicitada |
|---|---:|---|
| Patrulha / interceptação | 90 | 2 caças |
| Escolta | 60 | até 2 caças |
| Reconhecimento | 70 | 1 observador |
| Ataque ao solo | 160 | até 2 aeronaves |
| Bombardeio | 240 | 1 bombardeiro |

O comando automático usa até 32% da renda em uma janela de 120 segundos, com piso de orçamento de 180 suprimentos. A janela permite compras maiores, como reposição de aeronaves. Também preserva 100 suprimentos ou a reserva exigida pela engenharia; se há menos de 18 combatentes, preserva 160. Não encomenda missões com menos de 12 combatentes. Ordens manuais usam o orçamento escolhido pelo jogador.

Manutenção: custo = teto de (65 × dano do motor + 55 × dano estrutural + 35 × dano dos comandos + 25 × dano geral + 15 se houver vazamento), mais munição consumida e combustível. O tempo mínimo é 24 segundos, aumentando com os componentes danificados. Um caça com motor e estrutura pela metade, comandos danificados e combustível/munição a 40% custou 105 e exigiu 128 segundos no teste. Não há pagamento duplicado, reparo gratuito sem saldo ou decolagem antes de terminar o serviço. No sandbox, o serviço continua levando tempo, com suprimentos ilimitados.

Reposição: 240 para caça, 280 para dois lugares, 320 para bombardeiro leve e 360 para pesado; piloto substituto custa 40. A frota inicial já pertence ao exército. As três antigas rotinas automáticas de apoio deixam de gerar aviões simultaneamente ao núcleo novo. Os cartões e `PXAW.order` utilizam a mesma frota, com pagamento somente quando a ordem de missão é aceita.

Alvos terrestres dependem de contatos recentes. Reconhecimento e patrulha informam unidades avistadas ao comandante. As rotas previstas de aliados são verificadas antes do ataque; uma missão é abortada quando aliados entram no alvo. O observador em posição também ajuda na correção da artilharia. As mensagens mostram eventos reais: ordem, confirmação, contato, retorno e manutenção, com indicador animado de comunicação.

## Verificação

- `node tools/measure-gameplay.cjs --ground`: matriz terrestre.
- `node tools/measure-gameplay.cjs --final`: matriz com aviação e quadros consecutivos.
- `node tools/verify-air-command.cjs`: batalha no navegador, ordem de bombardeio com efeitos reais, custo/tempo de manutenção, saldo insuficiente, limite de tropas, equivalência da busca de alvos, clima, proteção de aliados, câmera aérea, mapa do teatro e modo antigo.
- `node tests/air-command.test.cjs`: política, relatórios, reserva terrestre, serviço e reposição pagos.

Essas amostras sustentam o padrão recomendado; não estabelecem equilíbrio perfeito entre facções nem cobrem campanhas longas.
