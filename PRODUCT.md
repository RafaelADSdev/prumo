# Produto

## Relatórios financeiros

Em 06/11/2026, a aba Relatórios passou a reunir origem e destino do dinheiro com o mesmo recorte em indicadores, gráficos, agrupamentos e CSV. Caixa considera cada baixa datada; competência considera o valor líquido confirmado da operação. O ano completo mostra meses e o mês selecionado mostra dias. Comparação com período anterior completo, categorias de entrada e saída, clientes/favorecidos, formas, origens e custos vinculados a veículos, colaboradores e recorrências. Compromissos mostram a posição atual das operações da competência selecionada, com baixas de qualquer data; não constituem fechamento histórico nem previsão de saldo. Lacunas de valor e baixas sem data são explicitadas. Busca local do detalhamento não altera os totais nem a exportação. Saldo contábil requer saldo inicial datado, período posterior e ausência de filtros.

## Cadastro de clientes e abrangência dos gastos

Serviços oferecem situação de pagamento ao salvar: manter, quitar saldo com data/forma, ou marcar como não pago estornando os recebimentos após confirmação. A quitação ocorre na mesma transação do serviço, calcula apenas o saldo restante e preserva baixas parciais; sem preço não permite recebimento. A lista mostra Pago/Não pago, valores e formas recebidas. O usuário também solicitou remoção de clientes e serviços: a ação arquiva o cadastro, o retira das listas ativas e preserva vínculos, caixa, compromissos e auditoria; a confirmação explica esse comportamento. Clientes removidos não aparecem para novos serviços. O endereço e os demais campos continuam opcionais.

Em 05/11/2026, o usuário solicitou nome/apelido, telefone, endereço e descrição/observações para clientes, além do histórico de todos os seus serviços. A ficha oferece Contato, Endereço e Serviços; o histórico ignora os filtros globais de mês/ano e mantém situação operacional, financeira e preço desconhecido. Os novos campos são opcionais e os dados anteriores de contato e observações são preservados.

O usuário confirmou que a visão geral deve incluir também gastos ainda não pagos. O resumo por competência reúne todas as origens uma única vez e separa gastos totais, baixas vinculadas e saldo a pagar. O fluxo de caixa continua separado, pela data da baixa. Despesas sem valor ou a conferir são informadas e ficam fora do total confirmado; canceladas e baixas estornadas não compõem os totais.

## Platform

web

## Stack

Next.js, TypeScript e Prisma. PostgreSQL/Supabase ativado em 05/11/2026 por solicitação explícita do usuário; SQLite mantido como alternativa local e para testes isolados. O servidor continua local; credenciais e conexão ao banco ficam somente no servidor. Migração preserva dados, administrador e histórico, com backup antes da troca e validação dos conteúdos.

## Usuário e objetivo

Administrador único. Organizar finanças, serviços, custos de veículos e compromissos recorrentes sem complexidade de ERP.

## Contrato

Dinheiro em centavos; competência separada de caixa; baixas parciais; histórico auditável; datas e preços desconhecidos preservados. Sem telemetria externa. Importação revisada antes de confirmar.

## Marca e direção visual confirmadas

Em 05/11/2026, o usuário rejeitou a identidade anterior grafite/violeta e escolheu explicitamente “Claro elegante, com fundo marfim e verde profundo”.
A aplicação passa a usar a marca Prumo, com símbolo próprio e assinatura “Finanças em equilíbrio”. O nome da organização continua editável e separado da identidade do aplicativo.
Interface clara, fontes locais legíveis, contraste financeiro e formulários consistentes em desktop e celular. O redesenho preserva integralmente regras, dados, credenciais e fluxos existentes.

## Evolução de experiência confirmada
O usuário solicitou melhorias no sistema completo, com animações e pesquisa de inspirações. A versão Prumo Perspective mantém o marfim e o verde profundo, substitui o login anterior por uma composição com arte própria e adiciona movimento de feedback e navegação. Toda animação tem alternativa de movimento reduzido. Navegação por teclado continua imediata, as preferências de movimento são apenas de interface e os cálculos e dados persistidos permanecem preservados.

## Acesso central escuro
O usuário rejeitou integralmente o login claro com arte. Escolheu explicitamente “Escura e moderna, com animação discreta e formulário central”. Somente o acesso passa a usar grafite esverdeado, painel central de 440px, ação menta e linhas discretas com entrada finita. A área autenticada mantém marfim e verde. Sem foto, escultura ou composição promocional lateral. Autenticação e credenciais preservadas.


## Temas claro e escuro

Em 05/11/2026, o usuário solicitou modos claro e escuro no projeto e a animação do seu repositório RafaelADSdev/Plataforma-Video. A solicitação amplia a direção anterior: login central e área autenticada agora têm as duas paletas. Marfim e verde permanecem no claro; verde profundo e superfícies escuras no escuro. Botão de sol/lua no acesso e na barra superior, preferência local prumo-theme e preferência do sistema no primeiro acesso. Troca circular a partir do botão com alternativa imediata para teclado, movimento reduzido e navegadores sem View Transitions.
