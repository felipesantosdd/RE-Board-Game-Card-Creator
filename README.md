# Resident Evil Card Creator

Editor web de cards para board games de Resident Evil e Monster Hunter. Crie, personalize e exporte cards em alta resolução com suporte a múltiplos layouts, sistema de ícones dinâmico e armazenamento local no browser.

🔗 **[Acessar em produção](https://re-board-game-card-creator.vercel.app)**

---

## O que é

Ferramenta voltada para jogadores e criadores de conteúdo de board games que queiram criar cards customizados compatíveis com o visual de **Resident Evil 3: The Board Game** e **Monster Hunter Board Game**. O sistema permite:

- Criar cards de equipamento, tensão e inimigo com layouts prontos
- Selecionar e recortar ícones e imagens com preview em tempo real
- Exportar cards individualmente (PNG) ou em lote (ZIP + JSON)
- Importar coleções via arquivo ou texto JSON
- Gerar caixas de cartas personalizadas prontas para impressão (PDF)
- Salvar tudo localmente no browser via IndexedDB — sem conta, sem servidor

---

## Páginas

### `/cards` — Editor de cards

A página principal. O fluxo de criação é:

1. **Selecione o layout** — escolha entre os templates disponíveis (equip1, equip2, equip3, tensão, inimigo etc.)
2. **Preencha o conteúdo** — título, descrição, números de efeito, linha de tiro
3. **Escolha os ícones** — ícone principal, ícone secundário, skills e efeitos
4. **Recorte a imagem** — crop interativo para posicionamento preciso
5. **Salve** — armazenado localmente no IndexedDB
6. **Exporte** — PNG individual, JSON ou ZIP com todos os cards

#### Layouts disponíveis

| Layout | Descrição |
|--------|-----------|
| **equip1** | Card de equipamento simples — ícone principal + título + descrição + skills |
| **equip2** | Card de equipamento com badge secundário (ícone do tipo) |
| **equip3** | Card complexo — linha de tiro, blocos de efeito numerados e skills |
| **equip4–13** | Cards de tensão — título + descrição + blocos opcionais de ícone+texto |
| **enemie / enemie2** | Cards de inimigo com atributos de combate |

#### Exportação e importação

**Exportar:**
- **PNG** — imagem do card em alta resolução
- **JSON** — dados do card (pode ser reimportado)
- **ZIP** — todos os PNGs + JSON em um arquivo

**Importar:**
- **Arquivo JSON** — clique em "Importar JSON" e selecione o arquivo
- **Colar JSON** — cole diretamente o conteúdo JSON na área de texto

**Formato JSON de importação:**
```json
[
  {
    "title": "Nome do item",
    "description": "Texto do card",
    "layoutId": "equip1",
    "icon": "/models/icons/A/01.png",
    "selectedSkills": ["01", "02"],
    "linhaDeTiro": "LOS"
  }
]
```

> Consulte [`SPEC_IMPORT_CARDS.md`](./SPEC_IMPORT_CARDS.md) para a especificação completa dos campos.

---

### `/cardbox` — Gerador de caixas

Cria templates de tuck box prontos para impressão em PDF.

- Defina as dimensões da caixa (comprimento, largura, altura)
- Escolha a unidade: mm, cm ou polegadas
- Selecione o tamanho do papel: A4 ou Letter
- Personalize abas de dobra e orifício de abertura
- Exporte como PDF com linhas de dobra marcadas

---

## Sistema de ícones

Os ícones são carregados dinamicamente da pasta `/public/models/icons/` via API. Cada subpasta corresponde a um tipo de uso:

| Pasta | Uso |
|-------|-----|
| `A/` | Ícone principal do card (banner lateral) |
| `B/` | Ícone badge secundário (equip2) |
| `C/` | Skills (equip1, equip2) |
| `D/` | Ícones adicionais |
| `Effects/01–03/` | Ícones dos blocos de efeito (equip3) |
| `Effects/04/` | Skills do equip3 |
| `Tension/` | Ícones dos blocos de tensão |
| `Enemies/` | Ícones de inimigos |
| `Icons/` | Ícones inline gerais |

Para adicionar novos ícones, basta colocar arquivos `.png` ou `.webp` na subpasta correspondente — a API detecta automaticamente.

---

## Rodando localmente

**Requisitos:** Node.js 18+

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Build de produção
npm run build
```

Acesse em `http://localhost:3000`.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 16 (App Router) |
| Linguagem | TypeScript |
| Estilização | Tailwind CSS 4 |
| Renderização de imagem | html-to-image |
| Geração de PDF | jsPDF |
| Compressão ZIP | JSZip |
| Crop de imagem | react-easy-crop |
| Persistência | IndexedDB (browser) |
| Deploy | Vercel |

---

## Estrutura de arquivos relevante

```
src/
  app/
    cards/       → Editor de cards
    cardbox/     → Gerador de caixas
    api/icons/   → API de listagem de ícones
  data/
    tutorialLayouts.ts   → Layouts de tutorial por jogo
    tutorialTypes.ts     → Tipos e utilitários de tutorial
  lib/
    appDb.ts             → Wrapper de IndexedDB

public/
  models/
    cards/       → Backgrounds dos cards (01–13.png)
    icons/       → Ícones organizados por pasta (A, B, C, Effects...)
    tutorial/    → Assets de tutorial por jogo (RE3, MH)

layouts.json     → Definição de todos os layouts de card
models.json      → Configurações de modelos
```

---

## Armazenamento

Todos os dados ficam **exclusivamente no browser** via IndexedDB — nenhuma informação é enviada a servidores. As stores utilizadas são:

| Store | Conteúdo |
|-------|----------|
| `cards` | Cards salvos individualmente |
| `decks` | Coleções de cards |
| `overlays` | Estado dos overlays de UI |
| `tutorial-texts` | Conteúdo personalizado dos tutoriais |

Para fazer backup, exporte seus cards em JSON pela própria interface.
