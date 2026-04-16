
---

# 🧠 AutoFill Extension

Extensão para Google Chrome que detecta automaticamente campos de formulários e preenche com dados do usuário de forma inteligente.

> Trata variações comuns como:
>
> * Nome completo vs nome + sobrenome
> * CPF com ou sem máscara
> * Telefone em diferentes formatos
> * Endereços brasileiros

---

## 📌 Objetivo

Detectar inputs em qualquer página web e preenchê-los automaticamente com base em padrões e heurísticas, reduzindo o esforço manual do usuário ao preencher formulários.

---

## 🔐 Privacidade

* ✅ Todos os dados são armazenados localmente (`chrome.storage.local`)
* ❌ Nenhum dado é enviado para servidores externos

---

## 🧾 Dados armazenados

O usuário preenche uma única vez no popup da extensão:

```json
{
  "firstName": "Fabio",
  "lastName": "Silva",
  "fullName": "Fabio Silva",
  "cpf": "000.000.000-00",
  "cpfRaw": "00000000000",
  "email": "fabio@email.com",
  "phone": "(11) 91234-5678",
  "phoneRaw": "11912345678",
  "cep": "01310-100",
  "cepRaw": "01310100",
  "rua": "Av. Paulista",
  "numero": "1000",
  "complemento": "Apto 42",
  "bairro": "Bela Vista",
  "cidade": "São Paulo",
  "estado": "SP",
  "estadoCompleto": "São Paulo",
  "dataNascimento": "01/01/1990",
  "rg": "12.345.678-9"
}
```

---

## 🔍 Detecção de campos

A extensão analisa múltiplos atributos do input para identificar o tipo do campo.

### Prioridade dos atributos

1. `autocomplete`
2. `name`
3. `id`
4. `label`
5. `placeholder`
6. `aria-label`

---

## 🧠 Mapeamento inteligente

Exemplo de detecção:

| Tipo          | Palavras-chave          | Valor            |
| ------------- | ----------------------- | ---------------- |
| Nome completo | fullname, nome completo | fullName         |
| Primeiro nome | firstname, given-name   | firstName        |
| CPF           | cpf                     | cpf / cpfRaw     |
| Email         | email                   | email            |
| Telefone      | phone, celular          | phone / phoneRaw |
| CEP           | cep, zip                | cep / cepRaw     |

---

## ⚙️ Regras especiais

### 👤 Nome completo vs separado

* 1 campo → `fullName`
* 2 campos → `firstName` + `lastName`

---

### 🆔 CPF

| Condição     | Resultado   |
| ------------ | ----------- |
| maxlength=14 | Com máscara |
| maxlength=11 | Sem máscara |
| type=number  | Sem máscara |
| fallback     | Com máscara |

---

### 📱 Telefone

* Com máscara → `(11) 91234-5678`
* Sem máscara → `11912345678`

---

### 📍 CEP + endereço automático

1. Preenche o CEP
2. Dispara eventos
3. Aguarda ~800ms
4. Preenche endereço (se necessário)

---

### 🎂 Data de nascimento

* `type="date"` → `YYYY-MM-DD`
* Input comum → `DD/MM/YYYY`
* Campos separados → preenchimento individual

---

### 🗺️ Estado

* `<select>` → seleciona opção
* Input curto → `SP`
* Input livre → `São Paulo`

---

### 🔒 Segurança

Nunca preenche:

* `type="password"`
* Captchas
* Campos já preenchidos
* Inputs ocultos

---

## ⚡ Formulários dinâmicos (SPA)

Suporte completo usando `MutationObserver`:

* Detecta inputs adicionados dinamicamente
* Debounce de 300ms
* Não sobrescreve valores existentes

---

## 🎯 Sistema de Score

Cada campo recebe um score de confiança:

| Critério             | Pontos |
| -------------------- | ------ |
| autocomplete         | +50    |
| name exato           | +40    |
| id                   | +30    |
| label                | +30    |
| placeholder          | +20    |
| aria-label           | +20    |
| maxlength compatível | +10    |

* ✅ ≥ 60 → preenchimento automático
* ⚠️ 40–59 → sugestão visual

---

## 🔄 Eventos disparados

Necessário para frameworks como React/Vue:

```js
input.value = valor;
input.dispatchEvent(new Event('input',  { bubbles: true }));
input.dispatchEvent(new Event('change', { bubbles: true }));
input.dispatchEvent(new Event('blur',   { bubbles: true }));
```

---

## 🔑 Permissões

```json
{
  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

---

## 🚫 Limitações

* Não acessa iframes de outros domínios
* Depende de padrões comuns de nomenclatura
* Pode falhar em formulários altamente customizados

---

## 📦 Versão

**v1.0** — Documento técnico inicial

---