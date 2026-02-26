/** Bloco de texto/título em uma página do tutorial (posição e estilo) */
export type TutorialBlock = {
  /** Conteúdo em pt-BR */
  text: string;
  top: string;
  left: string;
  /** Ex.: "1.25rem", "18px" */
  fontSize: string;
  boxShadow: boolean;
  /** Alinhamento do texto na div */
  alignment: "center" | "left";
  /** Largura opcional para quebra de linha (ex.: "80%", "400px") */
  width?: string;
  /** Altura da linha (ex.: "1.5", "1.25rem") */
  lineHeight?: string;
  /** Cor do texto (ex.: #D9E2DF). Usado nos títulos RE. */
  color?: string;
};

/** Número da página (exibido como index + 1; capa/contracapa costumam ter show: false) */
export type TutorialPageNumber = {
  /** Se true, exibe o número da página (padrão index + 1) */
  show: boolean;
  /** Posição vertical (ex.: "95%") */
  top: string;
  /** Posição horizontal (ex.: "50%") */
  left: string;
  /** Tamanho da fonte (ex.: "1rem") */
  fontSize?: string;
  alignment?: "center" | "left";
};

/** Uma página do tutorial: imagem de fundo + blocos de título e descrição (arrays) + número da página */
export type TutorialPage = {
  /** Caminho relativo à pasta base do jogo (legado). Preferir backgroundImageDataUrl. */
  imagePath?: string;
  /** Imagem de fundo em WebP (data URL), economiza espaço. Usado quando definido. */
  backgroundImageDataUrl?: string;
  /** Títulos (por padrão 1; pode adicionar mais). */
  titles: TutorialBlock[];
  /** Descrições (por padrão 1; pode adicionar mais). */
  descriptions: TutorialBlock[];
  /** Número da página (valor inicial top 95%, left 50%; show false em capa/contracapa) */
  pageNumber?: TutorialPageNumber;
};

/** Formato antigo (4 blocos fixos). Usado só para migração. */
export type TutorialPageLegacy = {
  imagePath?: string;
  backgroundImageDataUrl?: string;
  titulo1?: TutorialBlock;
  titulo2?: TutorialBlock;
  texto1?: TutorialBlock;
  texto2?: TutorialBlock;
  pageNumber?: TutorialPageNumber;
};

/** Layout completo: array de páginas */
export type TutorialLayout = TutorialPage[];

function defaultTutorialBlock(): TutorialBlock {
  return {
    text: "",
    top: "0",
    left: "0",
    fontSize: "1rem",
    boxShadow: false,
    alignment: "left",
  };
}

/** Retorna um bloco vazio (para "Adicionar título" / "Adicionar descrição"). */
export function createEmptyTutorialBlock(): TutorialBlock {
  return defaultTutorialBlock();
}

function defaultTutorialPageNumber(show: boolean): TutorialPageNumber {
  return {
    show,
    top: "95%",
    left: "50%",
    fontSize: "1rem",
    alignment: "center",
  };
}

function isLegacyPage(p: unknown): p is TutorialPageLegacy {
  if (!p || typeof p !== "object") return false;
  const page = p as Record<string, unknown>;
  return "titulo1" in page || "texto1" in page;
}

/** Converte página no formato antigo (titulo1, texto1, etc.) para o novo (titles[], descriptions[]). */
export function normalizeTutorialPage(page: unknown): TutorialPage {
  if (isLegacyPage(page)) {
    const defaultBlock = defaultTutorialBlock();
    let titles = [page.titulo1 ?? defaultBlock, page.titulo2 ?? defaultBlock];
    let descriptions = [page.texto1 ?? defaultBlock, page.texto2 ?? defaultBlock];
    if (titles.length === 0) titles = [defaultBlock];
    if (descriptions.length === 0) descriptions = [defaultBlock];
    return {
      imagePath: page.imagePath ?? "",
      backgroundImageDataUrl: page.backgroundImageDataUrl,
      titles,
      descriptions,
      pageNumber: page.pageNumber ?? defaultTutorialPageNumber(true),
    };
  }
  const p = page as TutorialPage;
  if (Array.isArray(p.titles) && Array.isArray(p.descriptions)) {
    return {
      ...p,
      titles: p.titles.length >= 1 ? p.titles : [defaultTutorialBlock()],
      descriptions: p.descriptions.length >= 1 ? p.descriptions : [defaultTutorialBlock()],
    };
  }
  return createEmptyTutorialPage();
}

/** Cria uma página vazia (para "Adicionar página"). Por padrão 1 título e 1 descrição. */
export function createEmptyTutorialPage(): TutorialPage {
  return {
    imagePath: "",
    titles: [defaultTutorialBlock()],
    descriptions: [defaultTutorialBlock()],
    pageNumber: defaultTutorialPageNumber(true),
  };
}

export type TutorialPagesByGame = {
  RE3: TutorialPage[];
  MH: TutorialPage[];
};

/** Um jogo com uma página vazia; usado quando não há dados no IndexedDB. */
export function getDefaultTutorialPagesByGame(): TutorialPagesByGame {
  return {
    RE3: [createEmptyTutorialPage()],
    MH: [createEmptyTutorialPage()],
  };
}

/** Chave do jogo para resolver a pasta base */
export type TutorialGameKey = "RE3" | "MH";

/**
 * Pastas base em public (sem barra final).
 * Imagens: public/models/tutorial/RE3/ e public/models/tutorial/MH/
 * No layout use caminho relativo, ex.: "01/01.png", "01/02.jpg"
 */
export const TUTORIAL_BASE_PATHS: Record<TutorialGameKey, string> = {
  RE3: "/models/tutorial/RE3",
  MH: "/models/tutorial/MH",
};
