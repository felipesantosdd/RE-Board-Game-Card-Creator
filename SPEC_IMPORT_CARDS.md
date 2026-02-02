# Especificação para criação de JSON de cards (importação no RE Card Creator)

Este documento descreve o formato JSON e o significado de todos os campos, ícones e layouts para que uma IA possa **extrair dados de uma imagem de cards** (ex.: RE3:TBG), remover/recortar os cards da imagem e gerar um **arquivo JSON importável** no sistema RE Card Creator.

**Imagem de referência:** a imagem usada inicialmente contém seis cards RE3:TBG dispostos horizontalmente (HANDGUN, KNIFE, KNIFE (KNIFE ONLY), SAMURAI EDGE, FIRST-AID SPRAY, HANDGUN BULLETS). Cada card deve virar um objeto no array JSON, com todos os elementos visuais mapeados para os campos corretos abaixo.

---

## 1. Formato do JSON

O arquivo deve ser um **array de objetos**. Cada objeto representa um card. O sistema importa via "Importar JSON" e espera exatamente estes campos (outros são ignorados).

### Campos obrigatórios em cada card

```json
[
  {
    "title": "TÍTULO DO CARD",
    "description": "Texto da descrição ou efeito do card.",
    "layoutId": "equip1",
    "icon": "/models/icons/A/01.png",
    "icon2Id": null,
    "selectedSkills": [],
    "equip3Number": "",
    "linhaDeTiro": "",
    "effect2Icon": "",
    "effect2Number": "",
    "effect3Icon": "",
    "effect3Number": "",
    "effect4Icon": "",
    "effect4Number": ""
  }
]
```

### Descrição de cada campo

| Campo | Tipo | Uso |
|-------|------|-----|
| `title` | string | Nome do card (ex.: "HANDGUN", "KNIFE"). Pode ser exibido em CAIXA ALTA. |
| `description` | string | Texto longo abaixo da imagem (efeito, regra, etc.). Usado em cards de item/consumível. |
| `layoutId` | string | **"equip1"**, **"equip2"** ou **"equip3"**. Define o layout visual do card (ver seção 2). |
| `icon` | string | URL do ícone principal (canto esquerdo do card). Deve ser um caminho da **pasta A** (ver seção 3). |
| `icon2Id` | string \| null | Só para **layout equip2**. ID do segundo ícone (pasta B), ex.: `"01"`, `"02"`. Para equip1/equip3 use `null` ou omita. |
| `selectedSkills` | string[] | Array de IDs de skills (pasta C). Ex.: `["01"]` ou `[]`. |
| `equip3Number` | string | Só para **layout equip3**. Número que aparece no canto superior direito (ex.: "15", "∞"). Use string vazia `""` se não houver. |
| `linhaDeTiro` | string | Só para **layout equip3**. Texto do primeiro bloco de efeito (ex.: "LOS" ou valor de linha de tiro). Use `""` se não houver. |
| `effect2Icon` | string | Só para **layout equip3**. ID do ícone do 2º bloco (pasta **Effects/04**). Valores: `"image-4"`, `"image-5"` ou `""`. |
| `effect2Number` | string | Número exibido **em cima** do ícone do 2º bloco (ex.: "1"). |
| `effect3Icon` | string | Só para **layout equip3**. ID do ícone do 3º bloco (pasta **Effects/04**). Valores: `"image-4"`, `"image-5"` ou `""`. |
| `effect3Number` | string | Número em cima do ícone do 3º bloco. |
| `effect4Icon` | string | Só para **layout equip3**. ID do ícone do 4º bloco (pasta **Effects/04**). Valores: `"image-4"`, `"image-5"` ou `""`. |
| `effect4Number` | string | Número em cima do ícone do 4º bloco. |

---

## 2. Layouts (layoutId)

Escolha **um** por card conforme o tipo visual do card na imagem.

### equip1 – Equipamento 1
- **Quando usar:** Card com **um único ícone** no canto esquerdo (banner EQUIP) e **sem** segundo ícone no canto superior direito.
- **Exemplo típico:** Equipamentos simples, alguns itens.
- **Preencha:** `icon` (pasta A), `icon2Id` null/vazio, `equip3Number` e todos os `effect*` vazios.

### equip2 – Equipamento 2
- **Quando usar:** Card com **dois ícones (imagens)**: um no banner esquerdo (EQUIP) e **outro ícone (imagem) no canto superior direito**. O segundo elemento é um **ícone gráfico** (pasta B), não um número sozinho.
- **Exemplo típico:** Cards em que o canto superior direito mostra uma **figura/ícone**, não o texto "15" ou "∞".
- **Preencha:** `icon` (pasta A), `icon2Id` (pasta B, ex.: `"01"`). Não use equip3Number nem effect* neste layout.

### equip3 – Arma (layout com número no badge + 4 blocos de efeito)
- **Quando usar:** Card com **número ou símbolo no canto superior direito** (ex.: "15", "∞" em um círculo) e **quatro blocos** na parte inferior: primeiro pode ser texto (ex.: "LOS"); os outros três são ícones com número em cima (ex.: 1, 1, 2). É o layout dos cards de arma RE3:TBG (HANDGUN, KNIFE, SAMURAI EDGE, etc.).
- **Exemplo típico:** HANDGUN (15), KNIFE (∞), SAMURAI EDGE (15), KNIFE (KNIFE ONLY) (∞).
- **Preencha:**
  - `equip3Number`: **número/símbolo do badge no canto superior direito** (ex.: `"15"`, `"∞"`). Este é o valor que aparece dentro do círculo cinza.
  - `linhaDeTiro`: texto do **primeiro bloco** inferior (ex.: "LOS" para Line Of Sight) ou valor de linha de tiro. Se não houver, use `""`.
  - `effect2Icon` + `effect2Number`, `effect3Icon` + `effect3Number`, `effect4Icon` + `effect4Number`: para os **três blocos seguintes**, cada um com um ícone (pasta Effects/01, 02 ou 03) e o número exibido em cima (ex.: "1", "2"). Use `""` onde não houver ícone ou número.

**Resumo rápido:**
- Só ícone à esquerda + título + imagem + descrição (sem número no círculo direito, sem fileira de ícones com números) → **equip1**
- Ícone à esquerda + **segundo ícone (imagem)** no canto direito (não é o número "15" ou "∞") → **equip2**
- **Número no círculo** do canto direito (15, ∞) + 4 blocos embaixo (texto + ícones com números) → **equip3**

---

## 3. Ícones – pastas e IDs

### Ícone principal do card (banner esquerdo – “EQUIP”)
- **Pasta:** `A`
- **IDs válidos:** `"01"`, `"02"`, `"03"`, `"04"`, `"05"`
- **Campo:** `icon` → use o **caminho completo**, ex.: `"/models/icons/A/01.png"`.
- **Na imagem:** Pistola, faca, cruz de primeiro socorro, munição etc. Mapeie cada desenho para um dos 01–05 conforme o catálogo do jogo (A é “tipo de item principal”).

### Segundo ícone (apenas layout equip2 – badge superior direito)
- **Pasta:** `B`
- **IDs válidos:** `"01"`, `"02"`, `"03"`, `"04"`, `"05"`
- **Campo:** `icon2Id` (apenas o ID, ex.: `"01"`). O sistema monta o caminho internamente.
- **Na imagem:** Ícone dentro do círculo cinza no canto superior direito (quando existir).

### Skills (ícones de habilidade)
- **Pasta:** `C`
- **IDs válidos:** `["01"]` (pode haver mais no futuro).
- **Campo:** `selectedSkills` → array de IDs, ex.: `["01"]` ou `[]`.
- **Na imagem:** Conjunto de ícones circulares (olho cortado, alvo, explosão, engrenagem, setas etc.). Cada um que estiver “ativo” no card deve ser mapeado para um ID da pasta C.

### Layout equip3 – quatro blocos de efeito (mesmas posições effect1–effect4)
Os **ícones de efeito** do layout 3 vêm todos da **pasta Effects/04**. As posições na tela são as mesmas dos campos effect1, effect2, effect3, effect4.

| Bloco | Conteúdo | Campo ícone | Campo número |
|-------|----------|-------------|--------------|
| 1     | Texto (ex.: "LOS") | — | `linhaDeTiro` |
| 2     | Ícone de Effects/04 + número em cima | `effect2Icon` | `effect2Number` |
| 3     | Ícone de Effects/04 + número em cima | `effect3Icon` | `effect3Number` |
| 4     | Ícone de Effects/04 + número em cima | `effect4Icon` | `effect4Number` |

**IDs válidos para effect2Icon, effect3Icon, effect4Icon** (todos da pasta **Effects/04**):
- `"image-4"` (Image 4.png)
- `"image-5"` (Image 5.png)

- **Na imagem:** Fileira de ícones na parte inferior do card. Associe cada posição ao bloco 1–4. Bloco 1 = texto (`linhaDeTiro`). Blocos 2, 3, 4 = ícone (Effects/04) + número em cima. Use `""` onde não houver ícone ou número.

---

## 4. Regras para não errar

1. **Sempre** preencher `title` e `description` (description pode ser `""` se o card não tiver texto de efeito).
2. **Sempre** definir `layoutId` como `"equip1"`, `"equip2"` ou `"equip3"` (exatamente esses valores).
3. **Sempre** definir `icon` com caminho completo para pasta A, ex.: `"/models/icons/A/01.png"`.
4. Para **equip1**: `icon2Id` null ou `""`; `equip3Number` e todos os `effect*` e `linhaDeTiro` vazios.
5. Para **equip2**: preencher `icon2Id` com ID da pasta B; o restante como em equip1 se não houver bloco de efeitos.
6. Para **equip3**: preencher `equip3Number`, `linhaDeTiro` e os pares `effect2Icon`/`effect2Number` … `effect4Icon`/`effect4Number` conforme a imagem. Usar `""` onde não houver ícone ou número.
7. **selectedSkills**: usar array, nunca null. Ex.: `[]` ou `["01"]`.
8. Números e texto que aparecem “em cima” de ícones devem ir nos campos `effect*Number` e `linhaDeTiro`; o ícone correspondente no campo `effect*Icon` com o ID exato da tabela acima.

---

## 5. Exemplo completo (1 card equip2 + 1 card equip3)

```json
[
  {
    "title": "HANDGUN",
    "description": "",
    "layoutId": "equip2",
    "icon": "/models/icons/A/02.png",
    "icon2Id": "01",
    "selectedSkills": [],
    "equip3Number": "",
    "linhaDeTiro": "",
    "effect2Icon": "",
    "effect2Number": "",
    "effect3Icon": "",
    "effect3Number": "",
    "effect4Icon": "",
    "effect4Number": ""
  },
  {
    "title": "KNIFE (KNIFE ONLY)",
    "description": "",
    "layoutId": "equip3",
    "icon": "/models/icons/A/02.png",
    "icon2Id": null,
    "selectedSkills": [],
    "equip3Number": "∞",
    "linhaDeTiro": "LOS",
    "effect2Icon": "image-4",
    "effect2Number": "1",
    "effect3Icon": "image-4",
    "effect3Number": "1",
    "effect4Icon": "image-5",
    "effect4Number": "2"
  }
]
```

*(Ícones de efeito vêm todos da pasta Effects/04; IDs: `"image-4"`, `"image-5"`. Ajuste conforme a imagem.)*

---

## 6. Imagem de referência

A imagem usada como referência para extração é a que contém os seis cards RE3:TBG (HANDGUN, KNIFE, KNIFE (KNIFE ONLY), SAMURAI EDGE, FIRST-AID SPRAY, HANDGUN BULLETS). A IA deve:

1. Remover/extrair cada card da imagem (recortar ou identificar regiões).
2. Para cada card: identificar título, descrição (se houver), layout (equip1/equip2/equip3), ícone principal, segundo ícone (se houver), número do badge (se houver), skills e os quatro blocos de efeito (ícone + número) quando for equip3.
3. Mapear cada elemento visual para o campo e ao ID/valor corretos conforme este documento.
4. Gerar um único JSON com um array de objetos no formato acima.
5. O arquivo gerado deve ser importável via "Importar JSON" no RE Card Creator (extensão `.json`).

---

## 7. Checklist para a IA (evitar erros)

- [ ] Gerar um **array** JSON (ex.: `[{ ... }, { ... }]`).
- [ ] Cada card = **um objeto** com os campos da seção 1 (podem ser strings vazias quando não se aplicam).
- [ ] **layoutId** exatamente: `"equip1"`, `"equip2"` ou `"equip3"` (minúsculas, sem espaço).
- [ ] Cards com **número no círculo** (15, ∞) no canto direito → usar **equip3** e preencher **equip3Number** com esse número/símbolo.
- [ ] **icon** sempre com caminho completo: `"/models/icons/A/XX.png"` (XX = 01 a 05).
- [ ] **icon2Id** só para equip2; para equip1 e equip3 usar `null` ou `""`.
- [ ] **selectedSkills** sempre array: `[]` ou `["01"]`, nunca `null`.
- [ ] Para equip3: preencher **linhaDeTiro** (1º bloco) e **effect2Icon/Number**, **effect3Icon/Number**, **effect4Icon/Number** (2º, 3º, 4º blocos). Ícones de efeito = pasta **Effects/04**; IDs: `"image-4"`, `"image-5"`.
- [ ] Salvar o arquivo como **.json** (ex.: `re-card-creator-cards.json`) para importar no sistema.

Com isso, a IA tem todas as informações para criar o JSON de importação sem errar nos ícones e layouts.
