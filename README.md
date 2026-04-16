# AutoFill Extension

Extensao de navegador para preencher formularios automaticamente com dados pessoais salvos localmente.

## Stack

- Node.js (build tooling)
- TypeScript (fonte da logica da extensao)
- WebExtension Manifest V3

## Estrutura

- `af_ext/manifest.json`: configuracao da extensao (MV3)
- `af_ext/popup.html`: interface de cadastro dos dados
- `af_ext/ts/shared/contracts.ts`: contratos e tipos compartilhados
- `af_ext/ts/shared/constants.ts`: constantes globais da extensao
- `af_ext/ts/core/text-core.ts`: utilitarios puros de texto/mascara
- `af_ext/ts/core/profile-core.ts`: regras puras de normalizacao do perfil
- `af_ext/ts/core/autofill-core.ts`: regras puras de inferencia e resolucao de campos
- `af_ext/ts/popup.ts`: entrypoint TypeScript do popup
- `af_ext/ts/content.ts`: entrypoint TypeScript do autofill
- `af_ext/ts/autofill-debug.ts`: entrypoint TypeScript da depuracao
- `af_ext/popup.js`, `af_ext/content.js`, `af_ext/autofill-debug.js`: arquivos gerados pelo build

### Arquitetura em camadas (fase 1)

- `shared`: contratos e constantes reutilizadas por todos os entrypoints.
- `core`: logica de dominio pura (sem acesso direto a `chrome`, `browser` ou DOM global externo).
- `entrypoints`: scripts que conectam UI/DOM/APIs do navegador (`popup.ts`, `content.ts`, `autofill-debug.ts`).

Essa separacao reduz duplicacao, facilita testes unitarios de regra e prepara o projeto para uma fase 2 com adapters de infraestrutura.

## Setup Node.js + TypeScript

1. Instale dependencias:

```bash
npm install
```

2. Gere os arquivos JavaScript da extensao:

```bash
npm run build
```

3. Durante desenvolvimento (watch):

```bash
npm run dev
```

4. Validar apenas tipos (sem gerar arquivos):

```bash
npm run typecheck
```

Observacao: edite sempre os arquivos em `af_ext/ts/*.ts`. Os arquivos `.js` em `af_ext/` sao gerados automaticamente.

## Navegadores suportados

- Chrome
- Opera
- Edge
- Brave
- Firefox (via Firefox Developer Edition ou about:debugging para carga temporaria)

## Como instalar (Chrome, Opera, Edge, Brave)

1. Abra `chrome://extensions`.
2. Ative o modo desenvolvedor (Developer mode).
3. Clique em **Load unpacked**.
4. Selecione a pasta `af_ext` deste projeto.

No Opera, a tela de extensoes tambem aceita pacote nao publicado e carrega a mesma pasta.

## Como instalar no Firefox

1. Abra `about:debugging`.
2. Entre em **This Firefox**.
3. Clique em **Load Temporary Add-on**.
4. Selecione o arquivo `manifest.json` dentro de `af_ext`.

Observacao: no modo temporario do Firefox, a extensao precisa ser recarregada ao reiniciar o navegador.

## Como usar

1. Clique no icone da extensao.
2. Preencha seus dados no popup.
3. Clique em **Salvar dados**.
4. Em qualquer formulario, clique em **Preencher agora** no popup para disparar o autofill.

## O que a extensao faz

- Detecta campos por `autocomplete`, `name`, `id`, `label`, `placeholder` e `aria-label`.
- Usa score para decidir preenchimento automatico (mais seguro em formularios variados).
- Trata casos comuns:
	- nome completo versus nome/sobrenome
	- CPF, telefone e CEP com ou sem mascara
	- estado em `input` e `select`
	- data de nascimento em campo unico ou separado
- Dispara eventos `input`, `change` e `blur` para compatibilidade com React/Vue.
- Observa mudancas no DOM com `MutationObserver` para formularios de SPAs.

## Depuracao de score (arquivo independente)

A depuracao foi isolada no arquivo `af_ext/autofill-debug.js`, sem misturar interface do popup.

Como ativar:

1. Abra qualquer pagina com formulario.
2. Use o atalho `Ctrl+Alt+Shift+D` para ligar/desligar debug.
3. Abra o DevTools e veja os logs no Console.

Opcao por URL:

- Adicione `?autofill_debug=1` na URL para iniciar com debug ativo nessa pagina.

O log mostra:

- score final por campo
- tipo de campo inferido
- quais regras somaram pontos
- se o campo passou o threshold e se foi preenchido

## Privacidade

- Os dados ficam no navegador usando `chrome.storage.local`.
- Nenhum dado e enviado para servidor externo.
