# Prumo

Finanças em equilíbrio.

## Identidade

Prumo é a marca do aplicativo financeiro. O nome remete a equilíbrio e orientação: organizar entradas, saídas e compromissos para enxergar o próximo passo. O nome da organização é uma informação separada, editável nas configurações; não é substituído pela marca do aplicativo.

A marca combina um P geométrico com uma pequena ponta de prumo e um logotipo serifado. O ponto em sálvia encerra a palavra e aparece como assinatura, sem virar elemento decorativo repetido pela interface.

## Uso

- Marca principal em verde profundo sobre marfim.
- Marca invertida em marfim sobre verde profundo, na apresentação do login.
- Símbolo isolado no favicon; wordmark completo na navegação.
- UI em Manrope; marca e títulos de página em Fraunces. Fontes servidas localmente, com licenças SIL OFL em `public/fonts`.
- Recebimentos verdes; pagamentos em terracota. Cor não substitui texto, situação ou descrição.
- Não usar os antigos símbolos de troca, fundos violetas ou tema grafite como identidade principal.

## Arquivos

`src/components/brand.tsx`: marca vetorial reutilizável e wordmark.

`public/brand/prumo-symbol.svg`: símbolo vetorial para favicon e uso isolado.

`src/app/globals.css`: paleta, tipografia, estados e adaptação móvel.

O redesenho não altera credenciais, dados, valores nem regras financeiras.

## Prumo Perspective: composição e movimento

A área autenticada mantém a marca e o marfim #F4F3EE com verde profundo. O login foi substituído pela direção escura descrita abaixo. Manrope assume os títulos operacionais; Fraunces continua na marca. A navegação interna é uma superfície flutuante verde com marcador móvel.

A escultura da composição de acesso rejeitada foi retirada da aplicação. O acesso não carrega imagens decorativas.

Movimento funcional: conteúdo troca em 240ms; formulários entram em 240ms e saem por ponteiro em 120ms; o marcador de navegação se desloca em 240ms. As barras mantêm geometria real e estável; o painel do gráfico entra por opacidade CSS em 520ms. Teclado mantém resposta imediata; movimento reduzido e a opção de Configurações prevalecem. Não animar contagens de dinheiro através de valores intermediários.

Referências pesquisadas: [Linear — hierarquia e navegação](https://linear.app/now/behind-the-latest-design-refresh), [Mercury — organização da visão financeira](https://mercury.com/insights) e [Emil Kowalski — animação como feedback](https://emilkowal.ski/ui/you-dont-need-animations). São referências de princípios, sem copiar recursos, marcas, números ou dados desses produtos.

## Acesso central escuro — direção escolhida pelo usuário
Login em #0F1714 com painel #18221F, texto #EDF4EF e botão menta #B8DEC8. Manrope nos campos e título; marca Prumo preservada. Formulário central, sem slogans laterais, imagem ou rodapé promocional. Linhas vetoriais discretas chegam em 900ms e o conjunto em 440ms; nenhuma repetição ambiente. Teclado e movimento reduzido anulam essas entradas. Estilo isolado em src/app/login.css.
