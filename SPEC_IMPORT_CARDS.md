# Especificação – Ícones, exportação e importação (RE Card Creator)

Este documento descreve **todos os ícones** (pastas e IDs), o **formato de exportação** e o **formato de importação** de cards, para que você possa adicionar/alterar ícones sem mexer no código e para que outras IAs possam gerar JSON importável a partir de imagens de cards.

**Referência:** Imagem com cards RE3:TBG (HANDGUN, KNIFE, SAMURAI EDGE, FIRST-AID SPRAY, HANDGUN BULLETS, etc.). Cada card vira um objeto no array JSON.

---

## 1. Pastas de ícones (todas dinâmicas)

O sistema lista ícones automaticamente via **`GET /api/icons?path=<pasta>`**. Não é preciso alterar código ao adicionar ou renomear arquivos: basta colocar `.png` na pasta e recarregar a página.

**Base:** `public/models/icons/`

| Pasta       | Uso no card |
|------------|-------------|
| **A**      | Ícone principal (banner esquerdo “EQUIP”). |
| **B**      | Segundo ícone (layout equip2 – badge superior direito). |
| **C**      | Skills (layout equip1 e equip2 – ícones de habilidade). |
| **Effects/01** | Bloco 2 de efeito (layout equip3) – ícone + número em cima. |
| **Effects/02** | Bloco 3 de efeito (layout equip3). |
| **Effects/03** | Bloco 4 de efeito (layout equip3). |
| **Effects/04** | Skills do layout equip3 (seção “Skills (pasta 04)” – vários ícones na div de skills). |

### Como o ID é gerado (automático)

O **id** de cada ícone vem do **nome do arquivo** (sem extensão), normalizado:

- Minúsculas  
- Espaços → `-`  
- Só letras, números e `-` (acentos e outros caracteres removidos)

Exemplos:

- `01.png` → `"01"`
- `Image 4.png` → `"image-4"`
- `Sem Título-1.png` → `"sem-titulo-1"`

**Na exportação/importação:** use sempre esse **id** (não o caminho do arquivo), exceto no ícone principal, onde o sistema usa o **caminho completo** em `icon`.

---

## 2. Uso de cada pasta por campo

### Ícone principal (sempre)

- **Campo:** `icon`
- **Tipo:** URL completa (string), ex.: `"/models/icons/A/01.png"`
- **Pasta:** A  
- **Na prática:** pode ser o caminho direto do arquivo (ex.: `"/models/icons/A/02.png"`) ou qualquer URL que aponte para um ícone da pasta A. O sistema também aceita apenas o id da pasta A; na importação, se vier só id, o app pode montar o caminho.

### Segundo ícone (só layout equip2)

- **Campo:** `icon2Id` (e opcionalmente `icon2` como URL)
- **Pasta:** B  
- **Valor:** id do ícone (ex.: `"01"`, `"02"`). O sistema monta a URL a partir do id usando a lista da pasta B.

### Skills (layout equip1 e equip2)

- **Campo:** `selectedSkills`
- **Pasta:** C  
- **Valor:** array de ids, ex.: `[]` ou `["01"]`. Vários ícones podem ser selecionados.

### Skills (layout equip3 – “Skills pasta 04”)

- **Campo:** `selectedSkills` (mesmo campo)
- **Pasta:** Effects/04  
- **Valor:** array de ids da pasta Effects/04 (ex.: `["image-4", "image-5"]`). Aparecem na div de skills no final do card.

### Blocos de efeito 2, 3 e 4 (só layout equip3)

Cada bloco tem um **ícone** (id) e um **número** (texto em cima do ícone).

| Bloco | Campo ícone   | Campo número   | Pasta de ícones |
|-------|---------------|----------------|------------------|
| 2     | `effect2Icon` | `effect2Number`| **Effects/01**   |
| 3     | `effect3Icon` | `effect3Number`| **Effects/02**   |
| 4     | `effect4Icon` | `effect4Number`| **Effects/03**   |

O **bloco 1** é só texto (ex.: "LOS"); campo `linhaDeTiro`.

**Resumo:**  
- effect2 → Effects/01  
- effect3 → Effects/02  
- effect4 → Effects/03  
- selectedSkills (equip3) → Effects/04  

---

## 3. Formato de exportação (o que o app exporta)

Ao clicar em **Exportar JSON**, o sistema gera um array de objetos com exatamente estes campos por card:

```json
[
  {
    "title": "TÍTULO DO CARD",
    "description": "Texto da descrição ou efeito.",
    "layoutId": "equip1",
    "icon": "/models/icons/A/01.png",
    "icon2Id": "01",
    "selectedSkills": ["01"],
    "skillId": "01",
    "equip3Number": "",
    "linhaDeTiro": "",
    "effect2Icon": "01",
    "effect2Number": "1",
    "effect3Icon": "02",
    "effect3Number": "1",
    "effect4Icon": "01",
    "effect4Number": "2"
  }
]
```

| Campo            | Tipo   | Descrição |
|------------------|--------|-----------|
| `title`          | string | Nome do card. |
| `description`     | string | Efeito/regra/descrição. |
| `layoutId`       | string | `"equip1"` \| `"equip2"` \| `"equip3"` |
| `icon`           | string | URL do ícone principal (pasta A). |
| `icon2Id`        | string | ID do segundo ícone (pasta B); vazio se não houver. |
| `selectedSkills` | string[] | IDs de skills: pasta C (equip1/equip2) ou pasta Effects/04 (equip3). |
| `skillId`         | string \| null | Primeiro id de `selectedSkills` (legado). |
| `equip3Number`    | string | Número/símbolo do badge (equip3), ex. `"15"`, `"∞"`. |
| `linhaDeTiro`     | string | Texto do 1º bloco de efeito (equip3). |
| `effect2Icon`     | string | ID do ícone do bloco 2 (pasta **Effects/01**). |
| `effect2Number`   | string | Número em cima do ícone do bloco 2. |
| `effect3Icon`     | string | ID do ícone do bloco 3 (pasta **Effects/02**). |
| `effect3Number`   | string | Número em cima do ícone do bloco 3. |
| `effect4Icon`     | string | ID do ícone do bloco 4 (pasta **Effects/03**). |
| `effect4Number`   | string | Número em cima do ícone do bloco 4. |

Todos os campos são exportados em todos os layouts; use `""` ou `[]` onde não se aplica.

---

## 4. Formato de importação (o que o app aceita)

O **Importar JSON** espera um **array de objetos**. Cada objeto pode ter os campos abaixo. Campos ausentes ou `null` são tratados como valor padrão (string vazia ou array vazio).

### Campos aceitos

| Campo            | Tipo     | Padrão   | Descrição |
|------------------|----------|----------|-----------|
| `title`          | string   | `""`     | Nome do card. |
| `description`     | string   | `""`     | Descrição/efeito. |
| `layoutId`       | string   | `"equip1"` | `equip1` \| `equip2` \| `equip3`. |
| `icon`           | string   | `""`     | URL do ícone principal (pasta A). |
| `icon2Id`        | string \| null | `null` | ID do segundo ícone (pasta B). |
| `icon2`          | string \| null | —     | Opcional; URL do segundo ícone. Se vier `icon2Id`, o app pode resolver pela pasta B. |
| `selectedSkills`  | string[] | `[]`     | IDs de skills (C ou Effects/04 conforme layout). |
| `equip3Number`   | string   | `""`     | Número do badge (equip3). |
| `linhaDeTiro`    | string   | `""`     | Texto do 1º bloco (equip3). |
| `effect2Icon`    | string   | `""`     | ID do ícone do bloco 2 (**Effects/01**). |
| `effect2Number`  | string   | `""`     | Número do bloco 2. |
| `effect3Icon`    | string   | `""`     | ID do ícone do bloco 3 (**Effects/02**). |
| `effect3Number`  | string   | `""`     | Número do bloco 3. |
| `effect4Icon`    | string   | `""`     | ID do ícone do bloco 4 (**Effects/03**). |
| `effect4Number`  | string   | `""`     | Número do bloco 4. |

O sistema **não** exige `id` no JSON de importação; ele gera id ao salvar no estado local.

### Exemplo mínimo (importação)

```json
[
  {
    "title": "HANDGUN",
    "description": "",
    "layoutId": "equip3",
    "icon": "/models/icons/A/02.png",
    "icon2Id": null,
    "selectedSkills": ["image-4", "image-5"],
    "equip3Number": "15",
    "linhaDeTiro": "LOS",
    "effect2Icon": "01",
    "effect2Number": "1",
    "effect3Icon": "02",
    "effect3Number": "1",
    "effect4Icon": "01",
    "effect4Number": "2"
  }
]
```

IDs (`effect2Icon`, `effect3Icon`, `effect4Icon`, `selectedSkills`) devem ser os **ids** retornados pela API para a pasta correspondente (nome do arquivo normalizado, ver seção 1).

---

## 5. Layouts (layoutId)

- **equip1** – Um ícone (A) à esquerda; sem segundo ícone; skills da pasta C.  
- **equip2** – Ícone A + segundo ícone (B) no canto superior direito; skills da pasta C.  
- **equip3** – Número no badge (`equip3Number`), 4 blocos embaixo (linhaDeTiro + 3 ícones com número em Effects/01, 02, 03), e skills da pasta **Effects/04** na div de skills.

---

## 6. Regras para não quebrar

1. **selectedSkills** sempre array: `[]` ou `["id1", "id2"]`, nunca `null`.  
2. **effect2Icon / effect3Icon / effect4Icon** usam ids das pastas **Effects/01**, **Effects/02**, **Effects/03** respectivamente.  
3. **selectedSkills** no equip3 = ids da pasta **Effects/04**. No equip1/equip2 = ids da pasta **C**.  
4. **icon** = URL completa do ícone principal (pasta A), ex.: `"/models/icons/A/01.png"`.  
5. **icon2Id** = id na pasta B; **icon2** pode ser omitido (o app resolve pelo id).  
6. Ao adicionar/renomear arquivos nas pastas, os novos ids passam a valer após recarregar a página; export/import usam sempre o **id** (slug do nome do arquivo).

---

## 7. Checklist para quem gera o JSON (ex.: outra IA)

- [ ] Array de objetos: `[{ ... }, { ... }]`.
- [ ] Cada card com todos os campos da seção 4 (podem ser `""` ou `[]` quando não se aplicam).
- [ ] `layoutId` exatamente `"equip1"`, `"equip2"` ou `"equip3"`.
- [ ] `icon` com URL completa para pasta A.
- [ ] `effect2Icon` / `effect3Icon` / `effect4Icon` = ids das pastas **Effects/01**, **Effects/02**, **Effects/03**.
- [ ] `selectedSkills` = ids da pasta **C** (equip1/equip2) ou **Effects/04** (equip3).
- [ ] Números em cima dos ícones de efeito em `effect2Number`, `effect3Number`, `effect4Number`.
- [ ] Arquivo salvo como `.json` para importar no RE Card Creator.

Com isso, todos os ícones e skills ficam explicados, e o formato de exportar/receber cards com todos os ícones e skills fica definido e consistente.
