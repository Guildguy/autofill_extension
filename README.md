# AutoFill Extension

Extensao de navegador para preencher formularios com dados pessoais salvos localmente.

## Visao Geral

O comportamento atual e:

- ao detectar formulario na pagina, a extensao mostra um prompt perguntando se deseja preencher agora;
- o botao "Preencher agora" no popup da extensao continua disponivel e funcional;
- os dados sao armazenados localmente no navegador.

## Stack

- Node.js (build e testes)
- TypeScript (fonte da logica)
- Vitest + JSDOM (testes unitarios e de integracao)
- WebExtension Manifest V3

## Estrutura Principal

- `af_ext/manifest.json`: configuracao da extensao (MV3)
- `af_ext/popup.html`: interface de cadastro
- `af_ext/ts/popup.ts`: logica do popup
- `af_ext/ts/content.ts`: logica de deteccao/preenchimento na pagina
- `af_ext/ts/autofill-debug.ts`: depuracao de score
- `af_ext/ts/core/text-core.ts`: utilitarios de texto
- `af_ext/ts/core/profile-core.ts`: normalizacao/formatao de perfil
- `af_ext/ts/core/autofill-core.ts`: inferencia de campos e resolucao de valores
- `af_ext/ts/shared/constants.ts`: chaves, definicoes de campos e regras comuns
- `af_ext/ts/shared/contracts.ts`: tipos/contratos compartilhados
- `tests/unit`: testes unitarios
- `tests/integration`: testes de integracao

## Setup

1. Instale dependencias:

```bash
npm install
```

2. Gere os arquivos JavaScript da extensao:

```bash
npm run build
```

3. Desenvolvimento em watch:

```bash
npm run dev
```

4. Validar tipos sem gerar arquivos:

```bash
npm run typecheck
```

Observacao: edite os arquivos em `af_ext/ts`. Os arquivos `.js` em `af_ext/` sao gerados pelo build.

## Instalacao Da Extensao

### Chrome, Edge, Brave, Opera

1. Abra `chrome://extensions`.
2. Ative o modo desenvolvedor.
3. Clique em "Load unpacked".
4. Selecione a pasta `af_ext` (nao selecione a raiz do repositorio).

### Firefox

1. Abra `about:debugging`.
2. Entre em "This Firefox".
3. Clique em "Load Temporary Add-on".
4. Escolha `af_ext/manifest.json`.

## Maneira Correta De Uso

1. Clique no icone da extensao.
2. Preencha os dados e clique em "Salvar dados".
3. Abra uma pagina com formulario.
4. Quando o prompt in-page aparecer, escolha:
   - "Preencher agora" para executar o autofill;
   - "Agora nao" para ignorar nessa pagina.
5. A qualquer momento, voce pode abrir o popup da extensao e clicar em "Preencher agora" para disparar manualmente.

## Comportamento De Preenchimento

- Identifica campos por `autocomplete`, `name`, `id`, `label`, `placeholder`, `aria-label` e contexto de texto.
- Usa score para decidir se um campo e compativel.
- Trata formatos comuns: CPF, telefone (incluindo DDI), CEP, estado, data de nascimento, nome completo e nome dividido.
- Dispara eventos `input`, `change` e `blur` para compatibilidade com frameworks.
- Observa mudancas no DOM com `MutationObserver` para formularios dinamicos.

## Testes

- Rodar tudo (build + unit + integracao):

```bash
npm test
```

- Apenas unitarios:

```bash
npm run test:unit
```

- Apenas integracao:

```bash
npm run test:integration
```

- Modo watch:

```bash
npm run test:watch
```

## Depuracao

- Atalho: `Ctrl+Alt+Shift+D` para ligar/desligar debug de score.
- URL: adicionar `?autofill_debug=1` para iniciar com debug ativo.

## Documentacao Didatica

- Diagrama de arquitetura: `docs/arquitetura-diagrama.md`

## Privacidade

- Dados em `chrome.storage.local`.
- Nenhum envio para servidor externo.
