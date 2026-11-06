---
name: Prumo Perspective
description: Finanças em equilíbrio, com marfim, navegação flutuante verde e movimento funcional.
colors:
  prumo-canvas: "#f4f3ee"
  prumo-paper: "#fff"
  prumo-ink: "#193b2b"
  border: "#e2e7dd"
  sage-ink: "#596e54"
  rail: "#173d30"
  rail-text: "#d0deca"
  nav-active: "#d3e6c5"
  nav-active-ink: "#1b422c"
  primary: "#214f39"
  primary-hover: "#173f2d"
  net: "#214d38"
  green: "#28744f"
  orange: "#a45d3d"
  chart-income: "#34765a"
  chart-outgoing: "#b0795d"
  control: "#f0f3eb"
  control-hover: "#e6ede2"
  form-field: "#fdfefb"
  danger: "#a54233"
  danger-bg: "#f9eeea"
  access-ground: "#0f1714"
  access-panel: "#18221f"
  access-ink: "#edf4ef"
  access-secondary: "#b2c4b8"
  access-accent: "#b8dec8"
  access-field-border: "#688371"
  access-field-hover: "#8aa895"
  access-error: "#ffd1bb"
typography:
  body:
    fontFamily: 'Manrope, "Segoe UI", sans-serif'
    fontSize: "14px"
    lineHeight: 1.6
  headline:
    fontFamily: 'Manrope, "Segoe UI", sans-serif'
    fontSize: "33px"
    fontWeight: 680
    lineHeight: 1.25
    letterSpacing: "-0.04em"
  title:
    fontFamily: 'Manrope, "Segoe UI", sans-serif'
    fontSize: "16px"
    fontWeight: 650
    letterSpacing: "-0.025em"
  label:
    fontSize: "12px"
  form-title:
    fontFamily: 'Manrope, "Segoe UI", sans-serif'
    fontSize: "21px"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  form-label:
    fontSize: "13px"
    lineHeight: 1.45
  form-input:
    fontSize: "14px"
    lineHeight: 1.5
  metric:
    fontSize: "34px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.04em"
  wordmark:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "36px"
    fontWeight: 550
    lineHeight: 1
    letterSpacing: "-0.045em"
rounded:
  status: "6px"
  field: "8px"
  control: "9px"
  navigation: "10px"
  metric: "14px"
  panel: "15px"
  dialog: "17px"
  rail: "19px"
spacing:
  compact: "8px"
  small: "10px"
  label-gap: "12px"
  metric-gap: "18px"
  inset: "20px"
  section-gap: "22px"
  panel-inset: "25px"
components:
  access-panel:
    backgroundColor: "{colors.access-panel}"
    textColor: "{colors.access-ink}"
    padding: "36px"
    width: "440px"
  access-submit:
    backgroundColor: "{colors.access-accent}"
    textColor: "#15281d"
    rounded: "{rounded.control}"
    padding: "13px 17px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.prumo-paper}"
    rounded: "{rounded.navigation}"
    padding: "10px 17px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.control}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  button-secondary-hover:
    backgroundColor: "{colors.control-hover}"
  button-danger:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger}"
    rounded: "{rounded.control}"
    padding: "8px 13px"
  nav-active:
    backgroundColor: "{colors.nav-active}"
    textColor: "{colors.nav-active-ink}"
    rounded: "{rounded.navigation}"
    padding: "12px"
  editor-field:
    backgroundColor: "{colors.form-field}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  editor-dialog:
    backgroundColor: "{colors.prumo-paper}"
    rounded: "{rounded.dialog}"
    width: "660px"
  dialog-compact:
    width: "490px"
  dialog-service:
    width: "760px"
  file-picker:
    backgroundColor: "#f8fbf3"
    rounded: "{rounded.navigation}"
    padding: "17px"
  panel:
    backgroundColor: "{colors.prumo-paper}"
    rounded: "{rounded.panel}"
  metric:
    backgroundColor: "{colors.prumo-paper}"
    rounded: "{rounded.metric}"
    padding: "23px 25px"
  metric-net:
    backgroundColor: "{colors.net}"
    textColor: "{colors.prumo-paper}"
    rounded: "{rounded.metric}"
    padding: "23px 25px"
---

# Design System: Prumo Perspective

## Overview

**Creative North Star: "Finanças em equilíbrio"**

Prumo Perspective combina o marfim escolhido pelo usuário com navegação flutuante verde, painéis brancos e uma interface Manrope. Fraunces permanece somente no wordmark. O aplicativo e o nome editável da organização são identidades distintas.

Este registro descreve o código entregue, sem alegar aprovação de uma composição visual. A área autenticada segue `globals.css` → `forms.css` → `experience.css`. O login usa a camada posterior e isolada `login.css`; `layout.tsx` importa esses arquivos nessa ordem, seguido de `settings.css`. Componentes, `src/lib/motion.ts` e `src/hooks/use-motion.ts` definem os comportamentos. A direção anterior em `BRAND.md` que atribuía Fraunces aos títulos é superada pela implementação Perspective. Somente o acesso segue agora a escolha explícita “Escura e moderna, com animação discreta e formulário central”, registrada em `.impeccable/login-central-direction.md`.

**Key Characteristics:**

- Marfim de fundo, painéis brancos e rail verde flutuante.
- Manrope em toda a interface; Fraunces exclusivamente na marca.
- Verde para recebimentos e terracota para pagamentos, com rótulos explícitos.
- Movimento breve com resposta imediata ao teclado e alternativa reduzida.
- Formulários limitados à viewport com ações sempre acessíveis.

## Colors

### Primary

- **Verde do rail** (`rail`): superfície de navegação com texto claro (`rail-text`). A seleção usa sálvia (`nav-active`) com tinta verde (`nav-active-ink`).
- **Verde de ação** (`primary`, `primary-hover`): controles principais; o fluxo líquido tem variante própria (`net`).

### Secondary

- **Verde financeiro** (`green`) e **terracota financeiro** (`orange`): texto e ícones de entrada/saída. Barras usam `chart-income` e `chart-outgoing`; a legenda mantém variantes locais.

### Tertiary

- **Erro** (`danger`, `danger-bg`): mensagens e ações destrutivas, identificadas por texto.

### Neutral

- **Marfim** (`prumo-canvas`) e **papel branco** (`prumo-paper`): área de trabalho e superfícies principais.
- **Tinta verde** (`prumo-ink`) e **sálvia escuro** (`sage-ink`): leitura principal e apoio.
- **Contorno** (`border`): família de divisórias suaves, com variantes locais por componente.
- **Controle** (`control`, `control-hover`) e **campo de editor** (`form-field`): superfícies editáveis e ações secundárias.

O login possui paleta local: `access-ground` e `access-panel` sustentam texto claro (`access-ink`), apoio (`access-secondary`) e ação menta (`access-accent`). Contornos dos campos usam `access-field-border`, com `access-field-hover` em hover; erros usam `access-error`. Essas cores pertencem ao acesso e não substituem os tokens da área autenticada.

### Named Rules

**The Financial Meaning Rule.** Verde identifica entrada e terracota identifica saída; rótulos, valores e situação acompanham a cor. Marcadores categóricos não mudam essa semântica.

**The Brand Separation Rule.** Prumo identifica o aplicativo; o nome da organização permanece editável nas configurações.

## Typography

**UI and Titles:** Manrope, com fallback Segoe UI/sans-serif.
**Wordmark:** Fraunces, com fallback Georgia/serif.

As famílias variáveis são locais (`public/fonts`), com `font-display: swap` e licenças SIL OFL. O corpo usa números tabulares. As funções normativas estão no frontmatter.

- Títulos de página usam `headline`, reduzido a (29px) no celular.
- Títulos de painel usam `title`, com (15px) nos painéis móveis.
- Editores usam título de (21px); confirmação e celular usam (20px). Labels são (13px), inputs (14px) e labels compactos dos itens (12px).
- Totais claros usam `metric`; o fluxo líquido usa (39px). Em telas acima de (1900px), passam a (37px / 42px); até (1250px), a (30px / 34px). No celular final, são (27px / 37px).
- Wordmark usa (36px) no rail e (35px) no login central atual. Eixos Fraunces: `"SOFT" 20`, `"WONK" 0`.
- O login central usa título Manrope (26px, peso 650, entrelinha 1.3), reduzido a (25px) até (540px) e (23px) abaixo de (360px). Labels usam (13px); inputs usam (15px), passando a (16px) no celular.

**The Visible Value Rule.** Descrição, situação e valor ficam visíveis antes de expandir uma transação móvel. Valores financeiros mantêm sua representação final, sem contagem animada intermediária.

## Layout

O rail desktop fica a (16px) das bordas esquerda, superior e inferior, com largura de (236px). A área de trabalho desloca (272px). A barra superior de (77px) reúne busca de comandos, atualização e sessão; breadcrumbs continuam removidos. O conteúdo alinha à esquerda, com preenchimento de (11px 36px 35px 6px) e largura máxima de (1900px).

O dashboard usa métricas de três colunas (1fr / 1fr / 1.2fr), com fluxo líquido ordenado primeiro. Gráficos usam (1.75fr / mínimo 280px e 1fr); a grade inferior usa (2.1fr / mínimo 270px e 1fr). Pendências são três cartões sálvia separados. Intervalos de métricas e painéis são `metric-gap` e `section-gap`.

- A partir de (1900px), conteúdo máximo de (1940px) e lateral direita de (40px); Configurações conserva duas colunas e alturas iguais por linha.
- Até (1250px), rail de (216px), deslocamento da área de (247px), cabeçalho empilhado e grade inferior única.
- Até (760px), o rail se recolhe e abre como painel flutuante de (246px). Barra superior de (67px), conteúdo de (27px 17px 28px). Métrica líquida ocupa a linha inteira; recebimentos e pagamentos dividem a linha seguinte em duas colunas. Gráficos, configurações e relatórios empilham.
- Login ocupa a viewport escura e centraliza um único conjunto de marca e formulário com largura máxima de (440px). O preenchimento passa de (48px 24px) para (32px 20px) até (540px), com laterais de (14px) abaixo de (360px), acomodando telas de (320px). Não há coluna lateral ou imagem.
- Transações recentes têm resumos expansíveis no celular; tabelas completas mantêm rolagem horizontal indicada por texto.

## Elevation & Depth

Painéis brancos usam sombra dupla discreta (`0 2px 5px #1c41250a, 0 10px 28px -18px #294f2712`). Métricas claras usam (`0 2px 4px #203c1a08, 0 12px 30px -22px #294b2d15`); fluxo líquido usa (`0 8px 25px -12px #204f394d`). O rail flutua com (`0 5px 26px #153c2412`).

Editores e confirmações usam (`0 20px 100px #18362624`), mantendo backdrop (`#162a244d`). Rodapés usam separação difusa (`0 -4px 15px #234b3010`). Não há sombra rígida deslocada na linguagem atual.

**The Soft Depth Rule.** Combine contorno claro e sombra difusa; mantenha sobreposições distintas sem transformar os painéis em blocos pesados.

## Shapes

Cantos distinguem rail, painel, métrica, controle, campo e diálogo no frontmatter. No celular, painéis e métricas usam (13px), diálogos (14px). A navegação selecionada é um marcador sálvia arredondado móvel. Status são retângulos pequenos; ícones lineares recebem pequenos fundos tonais quando precisam de destaque.

O símbolo vetorial combina P e ponta de prumo. O ponto sálvia encerra o wordmark. O login atual não usa raster: seu fundo contém três linhas SVG discretas, decorativas e ocultas da árvore de acessibilidade. A arte e a proveniência do login anterior foram removidas.

## Components

### Buttons

Controles comuns conservam altura mínima de (42px). Primários usam (44px), texto de (13px), peso (650), verde de ação, branco e cantos de (10px). Contextos compactos possuem variações locais. Hover muda fundo, contorno e sombra; active usa escala (0.98). Desabilitado mantém opacidade (0.5). Foco continua visível.

Transições usam o easing `cubic-bezier(0.16, 1, 0.3, 1)`: cores/transformação (160ms), sombra (180ms). Ações destrutivas mantêm vermelho e fundo de erro.

### Chips

Status de (12px), cantos `status` e preenchimento de (4px 8px). Aberto usa palha, quitado verde claro, conferência sálvia. São etiquetas informativas sem hover próprio.

### Cards / Containers

Painéis usam branco, contorno claro e cabeçalho de (24px 25px 19px). Métricas mudam fundo, borda e sombra em hover e sobem (2px), com deslocamento de seta (3px); o movimento vertical é retirado no celular. Os números não são interpolados. Durante carregamento, a área dos totais mostra um placeholder tonal.

### Inputs / Fields

Editores mantêm campos de pelo menos (44px) e tipografia de formulário. Foco muda a borda e aplica halo (`0 0 0 3px #dfead6`), substituindo o antigo outline do editor. Metadados opcionais e desconto/observações de serviço permanecem em seções expansíveis. Gastos de veículo usam data exata; referências mensais usam controle de mês quando apropriado.

O seletor de arquivo mantém input nativo acessível, label, nome/orientação e ação. Fundo sálvia, borda tracejada, hover com sombra e foco no conjunto; busy desabilita o input e usa `aria-disabled`, opacidade (0.6) e bloqueio de ponteiro.

### Navigation and Commands

Rail verde com marca invertida e itens de (46px), texto de (13px) e ícones lineares. O item ativo tem fundo transparente: a superfície sálvia vem do marcador `.nav-track` que se move por CSS em (240ms). O teclado remove a transição do marcador.

Ctrl K ou Cmd K abre navegação rápida. A busca ignora acentos e maiúsculas; setas escolhem, Enter executa e Escape fecha. O diálogo nativo possui busca com semântica combobox/listbox, seleção indicada e resultados roláveis. Não é busca de dados financeiros. Atualizar permanece uma ação separada na barra superior.

### Charts and Lists

Recharts entrega geometria estática (`isAnimationActive={false}`). O painel HTML estável `.comparison` revela opacidade de (0.65) a (1) por CSS em (520ms). O SVG e as alturas das barras permanecem estáticos, sem animação de grupo SVG, clip-path ou interpolação financeira. Categorias possuem revelação de escala/opacity em (420ms). Meses permanecem em (12px), todos rotulados; no compacto usam (-40°) e eixo de (48px).

Tabela usa texto de (13px), cabeçalho de (12px), divisórias e hover tonal. Ações de linha aumentam opacidade no hover/foco. No celular, descrição, status e valor ficam fora dos detalhes recolhidos. Preço desconhecido continua “Sem preço”.

### Login and Feedback

O acesso segue a direção escura escolhida pelo usuário e mantém a marca Fraunces sobre um formulário central Manrope. O painel usa cantos de (20px), preenchimento de (36px) e sombra (`0 24px 70px -24px #0009`); no celular, cantos de (17px) e preenchimento de (29px 24px), com laterais de (20px) nas telas menores.

Dois campos nativos usam texto claro, altura mínima de (51px), label visível e ícones lineares. Contorno de campo é claramente distinguível do fundo; hover o clareia e foco aplica menta e halo (`0 0 0 3px #b8dec81a`). Senha pode ser revelada por botão com `aria-pressed`. A ação menta tem altura mínima de (51px), hover claro e feedback active de (1px) para baixo. Foco de botão usa contorno claro de (2px), afastado (4px).

Busy marca o formulário com `aria-busy`, desabilita campos, botão de senha e envio, troca o rótulo para “Entrando…” e apresenta indicador de espera. Erro aparece em `role="alert"`, com fundo marrom, contorno e texto pêssego; o parágrafo herda explicitamente a cor do alerta. A nota técnica de criação do administrador aparece somente quando necessário.

A entrada do conjunto é única: (440ms), opacidade (0.65→1), deslocamento vertical (8px→0) e blur (2px→0). As três linhas SVG desenham seu traçado em (900ms), uma vez, sem loop ambiente. A preferência local reduzida, o sistema e o uso de teclado desativam animações e transições do acesso. Não há imagem, paralaxe ou narrativa lateral no login atual.

Na área autenticada, sucesso continua como toast de (280ms); loading e placeholders indicam espera.

### Dialogs and Motion Preference

Editores/confirmações são nativos, centralizados (`fixed`, `inset: 0`, `margin: auto`), com larguras de (490px), (660px) e (760px), limitadas à viewport. Cabeçalho e ações ficam fora do conteúdo rolável. Limites: largura da viewport menos (40px), altura `100dvh - 64px`; celular: menos (24px), altura `100dvh - 32px`. Foco inicial, Escape, modalidade e bloqueio do scroll do corpo permanecem.

WAAPI revela páginas e diálogos em (240ms); saída de diálogo por ponteiro usa (120ms). O código não usa View Transitions. Teclado ignora essas animações. Configurações oferece preferência local de movimento (`prumo-motion`); `prefers-reduced-motion` prevalece. CSS reduz animações/transições; contadores financeiros não são animados.

**The Reachable Actions Rule.** Limite e centralize o diálogo; deixe o conteúdo interno rolar mantendo título, fechar e ações acessíveis.

**The Motion Preference Rule.** Movimento é feedback opcional: respeite sistema, preferência local e resposta imediata ao teclado sem alterar dados ou geometria financeira.

## Do's and Don'ts

### Do:

- **Do** use marfim, rail verde e painéis brancos na área autenticada; reserve a paleta escura e menta ao login.
- **Do** use Manrope na interface e Fraunces somente no wordmark.
- **Do** preserve descrição, situação e valor visíveis no resumo móvel.
- **Do** mantenha ações do diálogo fora do conteúdo rolável.
- **Do** respeite preferência local, movimento reduzido e teclado imediato.
- **Do** preserve reais, números tabulares e valores financeiros finais.

### Don't:

- **Don't** reintroduza imagem, coluna lateral ou composição clara do acesso rejeitado.
- **Don't** alegue aprovação de comp que não ocorreu.
- **Don't** reative animação JavaScript do Recharts ou contagem intermediária de dinheiro.
- **Don't** use Fraunces nos títulos operacionais por herança da versão anterior.
- **Don't** retome grafite/violeta ou breadcrumbs removidos na área autenticada; o fundo escuro atual é específico do login.
- **Don't** substitua preço desconhecido por zero.

Não canonizado: CSS sobrescrito e composições anteriores não são autoridade. Alguns textos auxiliares de 10–11px, a nota técnica do primeiro acesso são limitações do build, não padrões para novos conteúdos essenciais.


## Temas — atualização solicitada em 05/11/2026

Esta seção substitui a restrição anterior de reservar a paleta escura somente ao acesso. Login e área autenticada oferecem claro e escuro, preservando composição, marca e verde. O claro mantém as cores existentes; tokens --theme-* aplicam superfícies (#18241e), fundo (#101914), texto (#e4eee7), texto secundário (#afc1b4) e contornos (#3e5447) no escuro. Sidebar e métrica de resultado preservam suas superfícies verdes. Gráficos, formulários e diálogos acompanham o tema.

Botão de 44px com lua no claro e sol no escuro. Preferência local prumo-theme aplicada antes da primeira pintura; ausência de preferência segue o sistema na abertura. Revelação circular de 560ms, cubic-bezier(0.16,1,0.3,1), centrada no botão, adaptada de https://github.com/RafaelADSdev/Plataforma-Video/blob/main/src/components/theme-toggle.tsx. View Transitions são usadas somente nessa troca; a navegação existente continua em WAAPI. Movimento local desativado, preferência do sistema reduzida, teclado e ausência de suporte mudam o tema imediatamente. Cliques repetidos durante a revelação são ignorados e falhas da animação preservam a troca.
