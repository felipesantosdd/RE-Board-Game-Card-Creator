"use client";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toPng } from "html-to-image";
import { Bebas_Neue, EB_Garamond } from "next/font/google";
import JSZip from "jszip";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";

/** Gera imagem recortada a partir de croppedAreaPixels (coordenadas na imagem original) */
async function createCroppedImage(
  imageSrc: string,
  pixelCrop: Area,
): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2d não disponível");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );
  return canvas.toDataURL("image/png");
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.src = url;
  });
}

/** Extrai número de valor como "295px" ou "505px" */
function parsePx(value: string): number {
  const n = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 1 : n;
}

type IconOption = {
  id: string;
  label: string;
  description: string;
  src: string;
};

/** True se alguma skill é o ícone 02.png (Enemies), que aparece só na div 2a. */
function hasEnemie02InSkills(
  iconOptions: IconOption[],
  skillIds: string[] | undefined,
): boolean {
  return (skillIds ?? []).some((s) => {
    const icon = iconOptions.find(
      (o) =>
        o.id === s ||
        String(o.id) === String(s) ||
        o.src === s ||
        (s && o.src?.includes(s)),
    );
    if (!icon) return false;
    const id = String(icon.id);
    const src = icon.src ?? "";
    return (
      id === "02" ||
      id === "2" ||
      (src.includes("02.png") && !src.includes("02-A")) ||
      (src.includes("2.png") && !src.includes("2-A"))
    );
  });
}

/** True se alguma skill é o ícone 06.png (Enemies), que fica fixo no início da div 2b. */
function hasEnemie06InSkills(
  iconOptions: IconOption[],
  skillIds: string[] | undefined,
): boolean {
  return (skillIds ?? []).some((s) => {
    const icon = iconOptions.find(
      (o) =>
        o.id === s ||
        String(o.id) === String(s) ||
        o.src === s ||
        (s && o.src?.includes(s)),
    );
    if (!icon) return false;
    const id = String(icon.id);
    const src = icon.src ?? "";
    return (
      id === "06" ||
      (src.includes("06.png") && !src.includes("06-A"))
    );
  });
}

/** True se o id corresponde ao ícone 06.png (Enemies), não 06-A. */
function isId06(id: string): boolean {
  const s = String(id).toLowerCase();
  return s === "06" || (s.includes("06") && !s.includes("06-a"));
}

/** True se o ícone (IconOption) é o 06. */
function isIcon06(icon: { id?: string; src?: string }): boolean {
  return (
    String(icon.id) === "06" ||
    (icon.src?.includes("06.png") && !icon.src?.includes("06-A")) ||
    false
  );
}

/** Listas de ícones vêm da API /api/icons?path= (A, B, C, Effects/01, etc.) */
const DEFAULT_ICON_FALLBACK = "/models/icons/A/01.png";

/** Substituição de códigos 0001–0010 por ícones inline (como emoji). Caminho: public/models/icons/Icons/ */
const INLINE_ICON_MAP: Record<string, string> = {
  "0001": "/models/icons/Icons/01.png",
  "0002": "/models/icons/Icons/02.png",
  "0003": "/models/icons/Icons/03.png",
  "0004": "/models/icons/Icons/04.png",
  "0005": "/models/icons/Icons/05.png",
  "0006": "/models/icons/Icons/06.png",
  "0007": "/models/icons/Icons/07.png",
  "0008": "/models/icons/Icons/08.png",
  "0009": "/models/icons/Icons/09.png",
  "0010": "/models/icons/Icons/10.png",
};

function renderTextWithInlineIcons(
  text: string,
  iconSizePx: number = 38,
): ReactNode {
  if (!text) return text;
  const codes = Object.keys(INLINE_ICON_MAP).sort(
    (a, b) => b.length - a.length || b.localeCompare(a),
  );
  const pattern = codes.length
    ? new RegExp(
        `(${codes
          .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|")})`,
        "g",
      )
    : /(?!)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const src = INLINE_ICON_MAP[match[1]];
    if (src) {
      parts.push(
        <img
          key={`icon-${key++}`}
          src={src}
          alt=""
          className="inline-block"
          style={{
            width: iconSizePx,
            height: iconSizePx,
            verticalAlign: "text-bottom",
            marginBottom: 2,
          }}
        />,
      );
    } else {
      parts.push(match[1]);
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  if (parts.length === 0) return text;
  if (parts.length === 1 && typeof parts[0] === "string") return parts[0];
  return <>{parts}</>;
}

/** Tooltips para rolagem de dados (Bloco 2) */
const TOOLTIP_DICE: Record<string, string> = {
  "1": "dado azul",
  "2": "dado vermelho",
  "3": "Dado azul e vermelho",
};
/** Tooltips para Bloco 3 (Effects/02) */
const TOOLTIP_EFFECT3: Record<string, string> = {
  "1": "Desvio",
  "2": "Empurrão",
  "3": "Dano e explosão",
};
/** Tooltips para Bloco 4 (Effects/03) */
const TOOLTIP_EFFECT4: Record<string, string> = {
  "1": "Dano",
  "2": "Explosão",
  "3": "Dano e explosão",
};
/** Tooltips para skills (número no ícone) */
const TOOLTIP_SKILL_NUMBER: Record<string, string> = {
  "1": "Disparo rápido",
  "2": "Acerto especial",
  "3": "Arma precisa",
  "4": "Dano",
  "5": "Explosão",
  "6": "Uso Único",
};

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
});
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400"],
});

type LayoutPositions = {
  icon: { top: string; left: string };
  icon2?: { top: string; left: string };
  title: {
    top: string;
    left: string;
    width: string;
    height: string;
    fontSize: string;
  };
  description: {
    top: string;
    left: string;
    width?: string;
    height?: string;
  };
  overlay: {
    top: string;
    left: string;
    width: string;
    height: string;
  };
  skills: {
    top: string;
    left: string;
    width: string;
    height: string;
  };
  /** Layout 3: 4 ícones de effects (posição ajustável) */
  effect1?: { top: string; left: string };
  effect2?: { top: string; left: string };
  effect3?: { top: string; left: string };
  effect4?: { top: string; left: string };
  /** Posição do número sobre cada ícone (relativo ao bloco do ícone). Ajuste top/left aqui. */
  effect2NumberPosition?: { top: string; left: string };
  effect3NumberPosition?: { top: string; left: string };
  effect4NumberPosition?: { top: string; left: string };
  /** Layout Enemie: posições dos campos numéricos (perigo, movimentação, vida) */
  enemieRedNumberPosition?: {
    top: string;
    left: string;
    width: string;
    height: string;
  };
  enemieGreenNumberPosition?: {
    top: string;
    left: string;
    width: string;
    height: string;
  };
  enemieBlueNumberPosition?: {
    top: string;
    left: string;
    width: string;
    height: string;
  };
};

type LayoutOption = {
  id: string;
  label: string;
  image: string;
  positions: LayoutPositions;
};

/** Fonte unificada de todos os títulos dos cards; redução por quebra de linha aplicada no CardPreview. */
const UNIFIED_TITLE_FONT_SIZE = "clamp(5rem, 4vw, 4rem)";
/** Quanto reduzir a fonte a cada linha extra do título (0.1 = 10% por linha). */
const TITLE_FONT_REDUCTION_PER_LINE = 0.18;
/** Tamanho mínimo da fonte do título em px (após redução por quebras). */
const TITLE_FONT_MIN_PX = 8;

// Carrega layouts do arquivo JSON e substitui placeholders
import layoutsData from "../../layouts.json";

const layoutOptions: LayoutOption[] = (layoutsData as LayoutOption[]).map(
  (layout) => ({
    ...layout,
    positions: {
      ...layout.positions,
      title: {
        ...layout.positions.title,
        fontSize:
          layout.positions.title.fontSize === "__UNIFIED_TITLE_FONT_SIZE__"
            ? UNIFIED_TITLE_FONT_SIZE
            : layout.positions.title.fontSize,
      },
    },
  }),
);

/** Layouts BG: só base + imagem do layout, sem ícones nem conteúdo (Back-S, Deck-A, Deck-B, Deck-C) */
const BG_LAYOUT_IDS = ["bg", "bg-deck-a", "bg-deck-b", "bg-deck-c"];
const isBgLayout = (layoutId: string) => BG_LAYOUT_IDS.includes(layoutId);

/** Layouts que usam efeitos (equip3): linha de tiro, blocos de efeito, skills Effects/04 */
const EQUIP_LAYOUTS_WITH_EFFECTS = ["equip3"];
const isEquipWithEffectsLayout = (layoutId: string) =>
  EQUIP_LAYOUTS_WITH_EFFECTS.includes(layoutId);

/** Layouts de tensão (equip4–equip16): só título, descrição e ícones de tensão */
const TENSION_LAYOUT_IDS = [
  "equip4",
  "equip5",
  "equip6",
  "equip7",
  "equip8",
  "equip9",
  "equip10",
  "equip11",
  "equip12",
  "equip13",
  "equip14",
  "equip15",
  "equip16",
];
const isTensionLayout = (layoutId: string) =>
  TENSION_LAYOUT_IDS.includes(layoutId);

/** Layout Enemie: card horizontal */
const isEnemieLayout = (layoutId: string) => layoutId === "enemie";

const mergeLayoutPositions = (
  candidate: Partial<LayoutPositions>,
  fallback: LayoutPositions,
): LayoutPositions => ({
  icon: candidate.icon ?? fallback.icon,
  icon2: candidate.icon2 ?? fallback.icon2,
  title: candidate.title ?? fallback.title,
  description: candidate.description
    ? {
        ...fallback.description,
        ...candidate.description,
      }
    : fallback.description,
  overlay: candidate.overlay ?? fallback.overlay,
  skills: candidate.skills ?? fallback.skills,
  effect1: candidate.effect1 ?? fallback.effect1,
  effect2: candidate.effect2 ?? fallback.effect2,
  effect3: candidate.effect3 ?? fallback.effect3,
  effect4: candidate.effect4 ?? fallback.effect4,
  effect2NumberPosition:
    candidate.effect2NumberPosition ?? fallback.effect2NumberPosition,
  effect3NumberPosition:
    candidate.effect3NumberPosition ?? fallback.effect3NumberPosition,
  effect4NumberPosition:
    candidate.effect4NumberPosition ?? fallback.effect4NumberPosition,
  enemieRedNumberPosition:
    candidate.enemieRedNumberPosition ?? fallback.enemieRedNumberPosition,
  enemieGreenNumberPosition:
    candidate.enemieGreenNumberPosition ?? fallback.enemieGreenNumberPosition,
  enemieBlueNumberPosition:
    candidate.enemieBlueNumberPosition ?? fallback.enemieBlueNumberPosition,
});

const DEFAULT_LAYOUT = layoutOptions[0];
const CARD_TEMPLATE_IMAGE = DEFAULT_LAYOUT.image;

/** Dimensões do card para impressão: 63×88mm com borda de 4mm */
const MM_TO_PX_300DPI = 300 / 25.4; // ≈ 11.811 pixels por mm a 300 DPI
const CARD_SIZE_MM = { width: 63, height: 88 };
const BORDER_MM = 4; // Borda de 4mm de cada lado
const CARD_DIMENSIONS = {
  width: Math.round(CARD_SIZE_MM.width * MM_TO_PX_300DPI), // 63mm = 744px
  height: Math.round(CARD_SIZE_MM.height * MM_TO_PX_300DPI), // 88mm = 1039px
};
const INNER_DIMENSIONS = {
  width: Math.round((CARD_SIZE_MM.width - BORDER_MM * 2) * MM_TO_PX_300DPI), // 55mm = 650px
  height: Math.round((CARD_SIZE_MM.height - BORDER_MM * 2) * MM_TO_PX_300DPI), // 80mm = 945px
};

/** Borda (base.png): tamanho real 1096×1599; área interna do layout 921×1416 */
const BASE_IMAGE = "/models/base.png";
const BASE_REAL = { width: 1096, height: 1599 };
const INNER_REAL = { width: 921, height: 1416 };

/** OUTER_DIMENSIONS = tamanho total do card (63×88mm) incluindo borda de 4mm */
const OUTER_DIMENSIONS = {
  width: CARD_DIMENSIONS.width, // 744px (63mm)
  height: CARD_DIMENSIONS.height, // 1039px (88mm)
};

/** Dimensões horizontais para layout Enemie (88×63mm) */
const ENEMIE_CARD_SIZE_MM = { width: 88, height: 63 };
const ENEMIE_BORDER_MM = 2.5; // Borda de 2mm de cada lado para Enemie
const ENEMIE_CARD_DIMENSIONS = {
  width: Math.round(ENEMIE_CARD_SIZE_MM.width * MM_TO_PX_300DPI), // 88mm = 1039px
  height: Math.round(ENEMIE_CARD_SIZE_MM.height * MM_TO_PX_300DPI), // 63mm = 744px
};
const ENEMIE_INNER_DIMENSIONS = {
  width: Math.round(
    (ENEMIE_CARD_SIZE_MM.width - ENEMIE_BORDER_MM * 2) * MM_TO_PX_300DPI,
  ), // 84mm = 992px
  height: Math.round(
    (ENEMIE_CARD_SIZE_MM.height - ENEMIE_BORDER_MM * 2) * MM_TO_PX_300DPI,
  ), // 59mm = 697px
};
const ENEMIE_OUTER_DIMENSIONS = {
  width: ENEMIE_CARD_DIMENSIONS.width, // 1039px (88mm)
  height: ENEMIE_CARD_DIMENSIONS.height, // 744px (63mm)
};

/** Altura de cada linha de skills no layout Enemie */
const ENEMIE_SKILL_LINE_HEIGHT_PX = 70; // Altura fixa de 70px para todas as divs
/** Altura fixa dos ícones nas divs 2a/2b (80% da linha) - evita redimensionamento ao mudar quantidade */
const ENEMIE_SKILL_ICON_SLOT_HEIGHT_PX = Math.floor(
  ENEMIE_SKILL_LINE_HEIGHT_PX * 0.8,
);
/** Largura da div 2b */
const ENEMIE_SKILL_2B_CONTAINER_WIDTH_PX = 212;
/** Margem lateral em 2b para que 3 ícones pareçam centralizados (começam à esquerda) */
const ENEMIE_SKILL_2B_SIDE_MARGIN_PX = 12;
/** Gap entre os slots em 2b (2 gaps entre 3 itens) */
const ENEMIE_SKILL_2B_GAP_PX = 8;
/** Largura de cada slot em 2b: (container - 2*margin - 2*gaps) / 3 */
const ENEMIE_SKILL_2B_SLOT_WIDTH_PX = Math.floor(
  (ENEMIE_SKILL_2B_CONTAINER_WIDTH_PX -
    2 * ENEMIE_SKILL_2B_SIDE_MARGIN_PX -
    ENEMIE_SKILL_2B_GAP_PX) /
    3,
);
/** Fonte dos números nos skills Enemie: 60% do tamanho atual (44px) = 26px */
const ENEMIE_SKILL_NUMBER_FONT_SIZE = 26;
/** Cor da fonte dos números nos skills Enemie */
const ENEMIE_SKILL_NUMBER_COLOR = "#D8C2AB";
/** Campo 1b: cor e fonte do número (25% maior que o padrão) */
const ENEMIE_SKILL_1B_NUMBER_COLOR = "#1F1612";
const ENEMIE_SKILL_1B_NUMBER_FONT_SIZE = 50;
/** Altura total da div de skills no layout Enemie */
const ENEMIE_SKILLS_CONTAINER_HEIGHT_PX = 505;
/** Altura de cada div de cor (dividindo o espaço total entre 3 cores) */
const ENEMIE_COLOR_DIV_HEIGHT_PX = ENEMIE_SKILLS_CONTAINER_HEIGHT_PX / 3;

/** INNER_OFFSET = offset para posicionar a área interna (arte) dentro do card total */
/** Borda de 4mm de cada lado = (CARD_DIMENSIONS - INNER_DIMENSIONS) / 2 */
const INNER_OFFSET = {
  left: Math.round((CARD_DIMENSIONS.width - INNER_DIMENSIONS.width) / 2), // 4mm = 47px
  top: Math.round((CARD_DIMENSIONS.height - INNER_DIMENSIONS.height) / 2), // 4mm = 47px
};

const DEFAULT_ACCENT = "#f97316";
const ICON_DROP_SHADOW = "0 10px 25px rgba(0,0,0,0.15)";
const CARD_TYPE_LABEL = "EQUIP";
const CARD_BORDER_COLOR = "#1f1f1f";

const OVERLAY_DB_NAME = "re-card-creator-overlays";
const OVERLAY_STORE_NAME = "overlays";
const OVERLAY_DB_VERSION = 1;

const openOverlayDb = (): Promise<IDBDatabase | null> => {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(OVERLAY_DB_NAME, OVERLAY_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OVERLAY_STORE_NAME)) {
        db.createObjectStore(OVERLAY_STORE_NAME);
      }
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      console.error("Erro ao abrir IndexedDB para overlays.", request.error);
      resolve(null);
    };
  });
};

const saveOverlayImage = async (key: string, dataUrl: string) => {
  const db = await openOverlayDb();
  if (!db) return;

  return new Promise<void>((resolve) => {
    const tx = db.transaction(OVERLAY_STORE_NAME, "readwrite");
    const store = tx.objectStore(OVERLAY_STORE_NAME);
    store.put(dataUrl, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      console.error("Erro ao salvar overlay no IndexedDB.", tx.error);
      db.close();
      resolve();
    };
  });
};

const getOverlayImage = async (key: string) => {
  const db = await openOverlayDb();
  if (!db) return null;

  return new Promise<string | null>((resolve) => {
    const tx = db.transaction(OVERLAY_STORE_NAME, "readonly");
    const store = tx.objectStore(OVERLAY_STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => {
      db.close();
      resolve(request.result ?? null);
    };
    request.onerror = () => {
      console.error("Erro ao ler overlay do IndexedDB.", request.error);
      db.close();
      resolve(null);
    };
  });
};

const deleteOverlayImage = async (key: string) => {
  const db = await openOverlayDb();
  if (!db) return;

  return new Promise<void>((resolve) => {
    const tx = db.transaction(OVERLAY_STORE_NAME, "readwrite");
    const store = tx.objectStore(OVERLAY_STORE_NAME);
    store.delete(key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      console.error("Erro ao remover overlay no IndexedDB.", tx.error);
      db.close();
      resolve();
    };
  });
};

const clearOverlayStore = async () => {
  const db = await openOverlayDb();
  if (!db) return;

  return new Promise<void>((resolve) => {
    const tx = db.transaction(OVERLAY_STORE_NAME, "readwrite");
    const store = tx.objectStore(OVERLAY_STORE_NAME);
    store.clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      console.error("Erro ao limpar overlays no IndexedDB.", tx.error);
      db.close();
      resolve();
    };
  });
};

const capitalizeLongWords = (text: string) =>
  text.replace(
    /\b(\p{L})(\p{L}{3,})/gu,
    (_, first, rest) => `${first.toUpperCase()}${rest}`,
  );

const getLayoutConfig = (layoutId: string) =>
  layoutOptions.find((option) => option.id === layoutId) ?? DEFAULT_LAYOUT;

const LOCAL_STORAGE_KEY = "re-card-creator-cards";

type FormState = {
  title: string;
  description: string;
  layout: string;
  image: string;
  icon: string;
  icon2: string;
  icon2Id: string;
  accent: string;
  selectedSkills: string[];
  /** Número acima de cada skill: skillId -> número (vazio = null) */
  skillNumbers: Record<string, string>;
  /** Layout Enemie: skills por cor */
  enemieBlueSkills: string[];
  enemieYellowSkills: string[];
  enemiePurpleSkills: string[];
  equip3Number: string;
  linhaDeTiro: string;
  effect2Icon: string;
  effect2Number: string;
  effect3Icon: string;
  effect3Number: string;
  effect4Icon: string;
  effect4Number: string;
  /** Layout 4 (equip4): ícone e texto de tensão, 2 linhas */
  tension1Icon: string;
  tension1Text: string;
  tension2Icon: string;
  tension2Text: string;
  /** Layout Enemie: campos numéricos coloridos */
  enemieRedNumber: string;
  enemieGreenNumber: string;
  enemieBlueNumber: string;
  /** Layout Enemie: cores selecionadas para skills */
  enemieBlueColor: boolean;
  enemieYellowColor: boolean;
  enemiePurpleColor: boolean;
  /** Layout Enemie: ícone principal de inimigos */
  enemieMainIcon: string;
  enemieMainIconNumber: string;
  /** Layout Enemie: número em branco na frente do ícone 06 (quando 06 está selecionado) */
  enemieBlueExtraNumber: string;
  enemiePurpleExtraNumber: string;
  enemieYellowExtraNumber: string;
};

const createInitialFormState = (): FormState => ({
  title: "",
  description: "",
  layout: DEFAULT_LAYOUT.id,
  image: DEFAULT_LAYOUT.image,
  icon: "",
  icon2: "",
  icon2Id: "",
  accent: DEFAULT_ACCENT,
  selectedSkills: [],
  skillNumbers: {},
  enemieBlueSkills: [],
  enemieYellowSkills: [],
  enemiePurpleSkills: [],
  equip3Number: "",
  linhaDeTiro: "LOS",
  effect2Icon: "",
  effect2Number: "1",
  effect3Icon: "",
  effect3Number: "",
  effect4Icon: "",
  effect4Number: "1",
  tension1Icon: "",
  tension1Text: "",
  tension2Icon: "",
  tension2Text: "",
  enemieRedNumber: "0",
  enemieGreenNumber: "0",
  enemieBlueNumber: "0",
  enemieBlueColor: false,
  enemieYellowColor: false,
  enemiePurpleColor: false,
  enemieMainIcon: "",
  enemieMainIconNumber: "",
  enemieBlueExtraNumber: "",
  enemiePurpleExtraNumber: "",
  enemieYellowExtraNumber: "",
});

type CardDesign = {
  id: string;
  title: string;
  description: string;
  image: string;
  icon: string;
  icon2: string | null;
  icon2Id: string | null;
  accent: string;
  type: string;
  layoutId: string;
  layoutPositions: LayoutPositions;
  selectedSkills: string[];
  skillNumbers: Record<string, string>;
  enemieBlueSkills: string[];
  enemieYellowSkills: string[];
  enemiePurpleSkills: string[];
  equip3Number: string;
  linhaDeTiro: string;
  effect2Icon: string;
  effect2Number: string;
  effect3Icon: string;
  effect3Number: string;
  effect4Icon: string;
  effect4Number: string;
  tension1Icon: string;
  tension1Text: string;
  tension2Icon: string;
  tension2Text: string;
  enemieRedNumber: string;
  enemieGreenNumber: string;
  enemieBlueNumber: string;
  enemieBlueColor: boolean;
  enemieYellowColor: boolean;
  enemiePurpleColor: boolean;
  enemieMainIcon: string;
  enemieMainIconNumber: string;
  enemieBlueExtraNumber: string;
  enemiePurpleExtraNumber: string;
  enemieYellowExtraNumber: string;
};

type CardPreviewProps = {
  card: Omit<CardDesign, "id">;
  overlayImage?: string | null;
  htmlId: string;
  iconOptionsA?: IconOption[];
  skillIconOptions?: IconOption[];
  effect2IconOptions?: IconOption[];
  effect3IconOptions?: IconOption[];
  effect4IconOptions?: IconOption[];
  effectIconOptions04?: IconOption[];
  tensionIconOptions?: IconOption[];
  enemieIconOptions?: IconOption[];
  showDebugBackground?: boolean;
};

const BG_LAYOUT_IMAGE = "/models/cards/Back-S.png";

const CardPreview = ({
  card,
  overlayImage,
  htmlId,
  iconOptionsA = [],
  skillIconOptions = [],
  effect2IconOptions = [],
  effect3IconOptions = [],
  effect4IconOptions = [],
  effectIconOptions04 = [],
  tensionIconOptions = [],
  enemieIconOptions = [],
  showDebugBackground = true,
}: CardPreviewProps) => {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleMeasureRef = useRef<HTMLDivElement>(null);
  const [titleFontSizePx, setTitleFontSizePx] = useState<number | null>(null);
  const heroImage = isBgLayout(card.layoutId)
    ? card.image || BG_LAYOUT_IMAGE
    : card.image || CARD_TEMPLATE_IMAGE;
  const layoutPositions = card.layoutPositions || DEFAULT_LAYOUT.positions;

  const titleMeasureKey = `${card.title ?? ""}-${UNIFIED_TITLE_FONT_SIZE}-${layoutPositions.title.width}-${layoutPositions.title.height}`;
  const prevTitleMeasureKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const keyChanged =
      prevTitleMeasureKeyRef.current !== undefined &&
      prevTitleMeasureKeyRef.current !== titleMeasureKey;
    prevTitleMeasureKeyRef.current = titleMeasureKey;
    if (keyChanged) {
      queueMicrotask(() => setTitleFontSizePx(null));
    }
  }, [titleMeasureKey]);

  useLayoutEffect(() => {
    if (titleFontSizePx !== null) return;
    const measureEl = titleMeasureRef.current;
    if (!measureEl) return;
    const style = getComputedStyle(measureEl);
    const fontSizePx = parseFloat(style.fontSize);
    const lineHeight = 0.9;
    const lineHeightPx = fontSizePx * lineHeight;
    const contentHeight = measureEl.offsetHeight;
    const lineCount = Math.ceil(contentHeight / lineHeightPx);
    if (lineCount <= 1) return;
    const level = lineCount - 1;
    const newSize = fontSizePx * (1 - level * TITLE_FONT_REDUCTION_PER_LINE);
    setTitleFontSizePx(Math.max(newSize, TITLE_FONT_MIN_PX));
  }, [titleMeasureKey, titleFontSizePx]);

  const isEnemie = isEnemieLayout(card.layoutId);
  /** Resolve ícone de inimigo (skills por cor) a partir de enemieIconOptions. */
  const findEnemieIconForSkill = (skillId: string) =>
    enemieIconOptions.find(
      (o) =>
        o.id === skillId ||
        String(o.id) === String(skillId) ||
        o.src === skillId ||
        (skillId && o.src?.includes(skillId)),
    );
  /** True se o skillId é o ícone 01.png (exclusivo da div 1a). */
  const isEnemie01 = (skillId: string) => {
    const icon = findEnemieIconForSkill(skillId);
    return (
      icon &&
      (String(icon.id) === "01" ||
        (icon.src?.includes("01.png") && !icon.src?.includes("02")))
    );
  };
  /** True se o skillId é o ícone 02 (exclusivo da div 2a). */
  const isEnemie02 = (skillId: string) => {
    const icon = findEnemieIconForSkill(skillId);
    return (
      icon &&
      (String(icon.id) === "02" ||
        String(icon.id) === "2" ||
        (icon.src?.includes("02.png") && !icon.src?.includes("02-A")) ||
        (icon.src?.includes("2.png") && !icon.src?.includes("2-A")))
    );
  };
  /** True se o skillId é o ícone 06 (fixo no início da div 2b). */
  const isEnemie06 = (skillId: string) => {
    const icon = findEnemieIconForSkill(skillId);
    return (
      icon &&
      (String(icon.id) === "06" ||
        (icon.src?.includes("06.png") && !icon.src?.includes("06-A")))
    );
  };
  const ENEMIE_01_ICON = "/models/icons/Enemies/01.png";
  const ENEMIE_02_ICON = "/models/icons/Enemies/02.png";
  const ENEMIE_06_ICON = "/models/icons/Enemies/06.png";
  const cardOuterDimensions = isEnemie
    ? ENEMIE_OUTER_DIMENSIONS
    : OUTER_DIMENSIONS;
  const cardInnerDimensions = isEnemie
    ? ENEMIE_INNER_DIMENSIONS
    : INNER_DIMENSIONS;
  const cardInnerOffset = isEnemie
    ? {
        left: Math.round(
          (ENEMIE_OUTER_DIMENSIONS.width - ENEMIE_INNER_DIMENSIONS.width) / 2,
        ),
        top: Math.round(
          (ENEMIE_OUTER_DIMENSIONS.height - ENEMIE_INNER_DIMENSIONS.height) / 2,
        ),
      }
    : INNER_OFFSET;

  const innerCardStyle: React.CSSProperties = {
    position: "absolute",
    left: `${cardInnerOffset.left}px`,
    top: `${cardInnerOffset.top}px`,
    width: cardInnerDimensions.width,
    height: cardInnerDimensions.height,
    borderColor: CARD_BORDER_COLOR,
    backgroundImage: `url("${heroImage}")`,
    backgroundSize: "100% 100%",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    fontFamily: bebasNeue.style.fontFamily,
    ...(isBgLayout(card.layoutId) && { borderRadius: 16 }),
  };

  return (
    <div
      id={htmlId}
      className="relative overflow-hidden rounded-3xl border-2 border-white/30 transition"
      style={{
        width: cardOuterDimensions.width,
        height: cardOuterDimensions.height,
        backgroundImage: `url("${BASE_IMAGE}")`,
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="relative overflow-hidden" style={innerCardStyle}>
        {isEnemie && (
          <>
            {(card.enemieRedNumber || card.enemieRedNumber === "0") &&
              layoutPositions.enemieRedNumberPosition && (
                <div
                  className="absolute flex items-center justify-center rounded-lg font-bold drop-shadow-lg z-20 text-center"
                  style={{
                    top: layoutPositions.enemieRedNumberPosition.top,
                    left: layoutPositions.enemieRedNumberPosition.left,
                    width: layoutPositions.enemieRedNumberPosition.width,
                    height: layoutPositions.enemieRedNumberPosition.height,
                    fontSize: "45px",
                    color: "#1F1612",
                    fontFamily: bebasNeue.style.fontFamily,
                  }}
                >
                  {card.enemieRedNumber}
                </div>
              )}
            {(card.enemieGreenNumber || card.enemieGreenNumber === "0") &&
              layoutPositions.enemieGreenNumberPosition && (
                <div
                  className="absolute flex items-center justify-center rounded-lg font-bold drop-shadow-lg z-20 text-center"
                  style={{
                    top: layoutPositions.enemieGreenNumberPosition.top,
                    left: layoutPositions.enemieGreenNumberPosition.left,
                    width: layoutPositions.enemieGreenNumberPosition.width,
                    height: layoutPositions.enemieGreenNumberPosition.height,
                    fontSize: "60px",
                    color: "#1F1612",
                    fontFamily: bebasNeue.style.fontFamily,
                  }}
                >
                  {card.enemieGreenNumber}
                </div>
              )}
            {(card.enemieBlueNumber || card.enemieBlueNumber === "0") &&
              layoutPositions.enemieBlueNumberPosition && (
                <div
                  className="absolute flex items-center justify-center rounded-lg font-bold drop-shadow-lg z-20 text-center"
                  style={{
                    top: layoutPositions.enemieBlueNumberPosition.top,
                    left: layoutPositions.enemieBlueNumberPosition.left,
                    width: layoutPositions.enemieBlueNumberPosition.width,
                    height: layoutPositions.enemieBlueNumberPosition.height,
                    fontSize: "60px",
                    color: "#CDB39E",
                    fontFamily: bebasNeue.style.fontFamily,
                  }}
                >
                  {card.enemieBlueNumber}
                </div>
              )}
          </>
        )}
        {!isBgLayout(card.layoutId) &&
          !isTensionLayout(card.layoutId) &&
          overlayImage && (
            <div
              className="absolute flex items-center justify-center overflow-hidden"
              style={{
                top: layoutPositions.overlay.top,
                left: layoutPositions.overlay.left,
                width: layoutPositions.overlay.width,
                height: layoutPositions.overlay.height,
              }}
            >
              <img
                src={overlayImage}
                alt="Arte personalizada do card"
                className={`h-full w-full object-center ${
                  isEnemie ? "object-cover" : "object-contain"
                }`}
              />
            </div>
          )}
        {!isBgLayout(card.layoutId) &&
          !isTensionLayout(card.layoutId) &&
          (isEnemie || card.selectedSkills?.length > 0) && (
            <div
              className={
                isEnemie
                  ? "flex flex-col items-center"
                  : "flex flex-wrap items-center justify-center gap-2"
              }
              style={{
                position: "absolute",
                top: layoutPositions.skills.top,
                left: layoutPositions.skills.left,
                width: isEnemie ? "285px" : layoutPositions.skills.width,
                height: isEnemie
                  ? `${ENEMIE_SKILLS_CONTAINER_HEIGHT_PX}px`
                  : layoutPositions.skills.height,
                ...(showDebugBackground &&
                  !isEnemie && {
                    backgroundColor: "rgba(0, 0, 255, 0.3)",
                  }),
              }}
            >
              {isEnemie &&
              (card.enemieBlueSkills?.length ||
                card.enemieYellowSkills?.length ||
                card.enemiePurpleSkills?.length) ? (
                <>
                  {/* Div Azul - aparece se tiver pelo menos uma skill azul */}
                  {card.enemieBlueSkills &&
                    card.enemieBlueSkills.length > 0 && (
                      <div
                        className="flex flex-col gap-2"
                        style={{ height: `${ENEMIE_COLOR_DIV_HEIGHT_PX}px` }}
                      >
                        {/* Azul - Linha 1: blue1a (1 ícone) | blue2a (vazio) */}
                        <div className="flex items-center justify-center gap-2">
                          {/* blue1a - coluna esquerda: exclusivo para 01.png */}
                          <div
                            id="blue1a"
                            className="enemie-label-bg flex items-center justify-center gap-1"
                            style={{
                              width: "65px",
                              height: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              minHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              maxHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              border: "2px solid #000000",
                              borderRadius: "20px",
                              boxShadow: "inset 0 0 15px rgba(0, 0, 0, 0.8)",
                              background: `repeating-linear-gradient(135deg, rgba(57, 89, 163, 0.75) 0%, rgba(57, 89, 163, 0.75) 28.57%, transparent 28.57%, transparent 42.86%, rgba(57, 89, 163, 0.75) 42.86%, rgba(57, 89, 163, 0.75) 71.43%, transparent 71.43%, transparent 100%)`,
                              backgroundPosition: "right center",
                            }}
                          >
                            {card.enemieBlueSkills?.find(isEnemie01) && (
                              <img
                                key="blue-l1-01"
                                src={ENEMIE_01_ICON}
                                alt="01"
                                style={{
                                  maxHeight: `${ENEMIE_SKILL_ICON_SLOT_HEIGHT_PX}px`,
                                  width: "auto",
                                  height: "auto",
                                  objectFit: "contain",
                                }}
                              />
                            )}
                          </div>
                          {/* blue2a - coluna direita linha 1: 02.png exclusivo (só aqui) */}
                          <div
                            id="blue2a"
                            className="enemie-label-bg flex items-center justify-start"
                            style={{
                              width: `${ENEMIE_SKILL_2B_CONTAINER_WIDTH_PX}px`,
                              paddingLeft: `${ENEMIE_SKILL_2B_SIDE_MARGIN_PX}px`,
                              paddingRight: `${ENEMIE_SKILL_2B_SIDE_MARGIN_PX}px`,
                              gap: `${ENEMIE_SKILL_2B_GAP_PX / 2}px`,
                              height: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              minHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              maxHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              border: "2px solid #000000",
                              borderRadius: "20px",
                              boxShadow: "inset 0 0 15px rgba(0, 0, 0, 0.8)",
                              background: `repeating-linear-gradient(135deg, rgba(57, 89, 163, 0.75) 0%, rgba(57, 89, 163, 0.75) 14.285%, transparent 14.285%, transparent 28.57%, rgba(57, 89, 163, 0.75) 28.57%, rgba(57, 89, 163, 0.75) 42.855%, transparent 42.855%, transparent 57.14%, rgba(57, 89, 163, 0.75) 57.14%, rgba(57, 89, 163, 0.75) 71.425%, transparent 71.425%, transparent 85.71%, rgba(57, 89, 163, 0.75) 85.71%, rgba(57, 89, 163, 0.75) 100%)`,
                            }}
                          >
                            {hasEnemie02InSkills(
                              enemieIconOptions,
                              card.enemieBlueSkills,
                            ) && (
                              <div
                                className="relative flex shrink-0 items-center justify-center"
                                style={{
                                  height: `${ENEMIE_SKILL_ICON_SLOT_HEIGHT_PX}px`,
                                  width: `${ENEMIE_SKILL_2B_SLOT_WIDTH_PX}px`,
                                  flex: `0 0 ${ENEMIE_SKILL_2B_SLOT_WIDTH_PX}px`,
                                }}
                              >
                                <img
                                  src={ENEMIE_02_ICON}
                                  alt="02"
                                  style={{
                                    maxHeight: `${ENEMIE_SKILL_ICON_SLOT_HEIGHT_PX}px`,
                                    width: "auto",
                                    height: "auto",
                                    objectFit: "contain",
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Azul - Linha 2: blue1b (número do ícone único) | blue2b (3 ícones + números na frente) */}
                        <div className="flex items-center justify-center gap-2">
                          {/* blue1b - coluna esquerda: número do ícone único */}
                          <div
                            id="blue1b"
                            className="enemie-label-bg relative flex items-center justify-center gap-1"
                            style={{
                              width: "65px",
                              height: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              minHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              maxHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              border: "2px solid #000000",
                              borderRadius: "20px",
                              boxShadow: "inset 0 0 15px rgba(0, 0, 0, 0.8)",
                              background: `repeating-linear-gradient(135deg, rgba(57, 89, 163, 0.75) 0%, rgba(57, 89, 163, 0.75) 28.57%, transparent 28.57%, transparent 42.86%, rgba(57, 89, 163, 0.75) 42.86%, rgba(57, 89, 163, 0.75) 71.43%, transparent 71.43%, transparent 100%)`,
                              backgroundPosition: "right center",
                            }}
                          >
                            {card.enemieBlueSkills?.length > 0 &&
                              (() => {
                                const list = card.enemieBlueSkills ?? [];
                                const id01 = list.find(isEnemie01);
                                const num = id01
                                  ? card.skillNumbers?.[
                                      `enemie-blue-${id01}`
                                    ]?.trim()
                                  : undefined;
                                return num ? (
                                  <div
                                    className="flex w-full items-center justify-center font-semibold drop-shadow-lg"
                                    style={{
                                      color: ENEMIE_SKILL_1B_NUMBER_COLOR,
                                      fontSize: `${ENEMIE_SKILL_1B_NUMBER_FONT_SIZE}px`,
                                      fontFamily: bebasNeue.style.fontFamily,
                                      textAlign: "center",
                                    }}
                                  >
                                    {num}
                                  </div>
                                ) : null;
                              })()}
                          </div>
                          {/* blue2b - coluna direita: ícones à esquerda, largura ajustada para 3 parecerem centralizados */}
                          <div
                            id="blue2b"
                            className="enemie-label-bg flex items-center justify-start"
                            style={{
                              width: `${ENEMIE_SKILL_2B_CONTAINER_WIDTH_PX}px`,
                              paddingLeft: `${ENEMIE_SKILL_2B_SIDE_MARGIN_PX}px`,
                              paddingRight: `${ENEMIE_SKILL_2B_SIDE_MARGIN_PX}px`,
                              gap: `${ENEMIE_SKILL_2B_GAP_PX / 2}px`,
                              height: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              minHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              maxHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              border: "2px solid #000000",
                              borderRadius: "20px",
                              boxShadow: "inset 0 0 15px rgba(0, 0, 0, 0.8)",
                              background: `repeating-linear-gradient(135deg, rgba(57, 89, 163, 0.75) 0%, rgba(57, 89, 163, 0.75) 14.285%, transparent 14.285%, transparent 28.57%, rgba(57, 89, 163, 0.75) 28.57%, rgba(57, 89, 163, 0.75) 42.855%, transparent 42.855%, transparent 57.14%, rgba(57, 89, 163, 0.75) 57.14%, rgba(57, 89, 163, 0.75) 71.425%, transparent 71.425%, transparent 85.71%, rgba(57, 89, 163, 0.75) 85.71%, rgba(57, 89, 163, 0.75) 100%)`,
                            }}
                          >
                            {(() => {
                              const list = card.enemieBlueSkills ?? [];
                              const has06 = hasEnemie06InSkills(
                                enemieIconOptions,
                                list,
                              );
                              const others = list.filter(
                                (id) =>
                                  !isEnemie01(id) &&
                                  !isEnemie02(id) &&
                                  !isEnemie06(id),
                              );
                              const ordered: { skillId: string; is06: boolean }[] =
                                has06
                                  ? [
                                      {
                                        skillId:
                                          list.find((id) => isEnemie06(id)) ??
                                          "06",
                                        is06: true,
                                      },
                                      ...others.map((id) => ({
                                        skillId: id,
                                        is06: false,
                                      })),
                                    ]
                                  : others.map((id) => ({
                                      skillId: id,
                                      is06: false,
                                    }));
                              return ordered.slice(0, 3);
                            })().map(({ skillId, is06 }) => {
                              const id06 = (card.enemieBlueSkills ?? []).find(
                                (id) => isEnemie06(id),
                              );
                              const num = is06
                                ? (card.skillNumbers?.[
                                    `enemie-blue-${id06 ?? "06"}`
                                  ] ??
                                    card.enemieBlueExtraNumber)?.trim()
                                : card.skillNumbers?.[
                                    `enemie-blue-${skillId}`
                                  ]?.trim();
                              return (
                                <div
                                  key={`blue-2b-${skillId}`}
                                  className="relative flex shrink-0 items-center justify-center"
                                  style={{
                                    height: `${ENEMIE_SKILL_ICON_SLOT_HEIGHT_PX}px`,
                                    width: `${ENEMIE_SKILL_2B_SLOT_WIDTH_PX}px`,
                                    flex: `0 0 ${ENEMIE_SKILL_2B_SLOT_WIDTH_PX}px`,
                                  }}
                                >
                                  {(() => {
                                    const iconSrc = is06
                                      ? ENEMIE_06_ICON
                                      : (findEnemieIconForSkill(skillId)
                                          ?.src ?? "");
                                    if (!iconSrc) return null;
                                    return (
                                      <img
                                        src={iconSrc}
                                        alt={
                                          is06
                                            ? "06"
                                            : (findEnemieIconForSkill(skillId)
                                                ?.label ?? skillId)
                                        }
                                        style={{
                                          maxHeight: `${ENEMIE_SKILL_ICON_SLOT_HEIGHT_PX}px`,
                                          width: "auto",
                                          height: "auto",
                                          objectFit: "contain",
                                        }}
                                      />
                                    );
                                  })()}
                                  {num ? (
                                    <div
                                      className="absolute inset-0 flex items-center justify-center font-semibold drop-shadow-lg"
                                      style={{
                                        color: ENEMIE_SKILL_NUMBER_COLOR,
                                        fontSize: `${ENEMIE_SKILL_NUMBER_FONT_SIZE}px`,
                                        fontFamily: bebasNeue.style.fontFamily,
                                      }}
                                    >
                                      {num}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  {/* Div Roxo - ordem: Azul, Roxo, Amarelo */}
                  {card.enemiePurpleSkills &&
                    card.enemiePurpleSkills.length > 0 && (
                      <div
                        className="flex flex-col gap-2"
                        style={{ height: `${ENEMIE_COLOR_DIV_HEIGHT_PX}px` }}
                      >
                        {/* Roxo - Linha 1: purple1a (1 ícone) | purple2a (vazio) */}
                        <div className="flex items-center justify-center gap-2">
                          {/* purple1a - coluna esquerda: exclusivo para 01.png */}
                          <div
                            id="purple1a"
                            className="enemie-label-bg flex items-center justify-center gap-1"
                            style={{
                              width: "65px",
                              height: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              minHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              maxHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              border: "2px solid #000000",
                              borderRadius: "20px",
                              boxShadow: "inset 0 0 15px rgba(0, 0, 0, 0.8)",
                              background: `repeating-linear-gradient(135deg, rgba(83, 44, 115, 0.75) 0%, rgba(83, 44, 115, 0.75) 28.57%, transparent 28.57%, transparent 42.86%, rgba(83, 44, 115, 0.75) 42.86%, rgba(83, 44, 115, 0.75) 71.43%, transparent 71.43%, transparent 100%)`,
                              backgroundPosition: "right center",
                            }}
                          >
                            {card.enemiePurpleSkills?.find(isEnemie01) && (
                              <img
                                key="purple-l1-01"
                                src={ENEMIE_01_ICON}
                                alt="01"
                                style={{
                                  maxHeight: `${ENEMIE_SKILL_ICON_SLOT_HEIGHT_PX}px`,
                                  width: "auto",
                                  height: "auto",
                                  objectFit: "contain",
                                }}
                              />
                            )}
                          </div>
                          {/* purple2a - coluna direita linha 1: 02.png exclusivo (só aqui) */}
                          <div
                            id="purple2a"
                            className="enemie-label-bg flex items-center justify-start"
                            style={{
                              width: `${ENEMIE_SKILL_2B_CONTAINER_WIDTH_PX}px`,
                              paddingLeft: `${ENEMIE_SKILL_2B_SIDE_MARGIN_PX}px`,
                              paddingRight: `${ENEMIE_SKILL_2B_SIDE_MARGIN_PX}px`,
                              gap: `${ENEMIE_SKILL_2B_GAP_PX / 2}px`,
                              height: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              minHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              maxHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              border: "2px solid #000000",
                              borderRadius: "20px",
                              boxShadow: "inset 0 0 15px rgba(0, 0, 0, 0.8)",
                              background: `repeating-linear-gradient(135deg, rgba(83, 44, 115, 0.75) 0%, rgba(83, 44, 115, 0.75) 14.285%, transparent 14.285%, transparent 28.57%, rgba(83, 44, 115, 0.75) 28.57%, rgba(83, 44, 115, 0.75) 42.855%, transparent 42.855%, transparent 57.14%, rgba(83, 44, 115, 0.75) 57.14%, rgba(83, 44, 115, 0.75) 71.425%, transparent 71.425%, transparent 85.71%, rgba(83, 44, 115, 0.75) 85.71%, rgba(83, 44, 115, 0.75) 100%)`,
                            }}
                          >
                            {hasEnemie02InSkills(
                              enemieIconOptions,
                              card.enemiePurpleSkills,
                            ) && (
                              <div
                                className="relative flex shrink-0 items-center justify-center"
                                style={{
                                  height: `${ENEMIE_SKILL_ICON_SLOT_HEIGHT_PX}px`,
                                  width: `${ENEMIE_SKILL_2B_SLOT_WIDTH_PX}px`,
                                  flex: `0 0 ${ENEMIE_SKILL_2B_SLOT_WIDTH_PX}px`,
                                }}
                              >
                                <img
                                  src={ENEMIE_02_ICON}
                                  alt="02"
                                  style={{
                                    maxHeight: `${ENEMIE_SKILL_ICON_SLOT_HEIGHT_PX}px`,
                                    width: "auto",
                                    height: "auto",
                                    objectFit: "contain",
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Roxo - Linha 2: purple1b (número) | purple2b (3 ícones + números na frente) */}
                        <div className="flex items-center justify-center gap-2">
                          {/* purple1b - coluna esquerda: número do ícone único */}
                          <div
                            id="purple1b"
                            className="enemie-label-bg flex items-center justify-center gap-1"
                            style={{
                              width: "65px",
                              height: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              minHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              maxHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              border: "2px solid #000000",
                              borderRadius: "20px",
                              boxShadow: "inset 0 0 15px rgba(0, 0, 0, 0.8)",
                              background: `repeating-linear-gradient(135deg, rgba(83, 44, 115, 0.75) 0%, rgba(83, 44, 115, 0.75) 28.57%, transparent 28.57%, transparent 42.86%, rgba(83, 44, 115, 0.75) 42.86%, rgba(83, 44, 115, 0.75) 71.43%, transparent 71.43%, transparent 100%)`,
                              backgroundPosition: "right center",
                            }}
                          >
                            {card.enemiePurpleSkills?.length > 0 &&
                              (() => {
                                const list = card.enemiePurpleSkills ?? [];
                                const id01 = list.find(isEnemie01);
                                const num = id01
                                  ? card.skillNumbers?.[
                                      `enemie-purple-${id01}`
                                    ]?.trim()
                                  : undefined;
                                return num ? (
                                  <div
                                    className="flex w-full items-center justify-center font-semibold drop-shadow-lg"
                                    style={{
                                      color: ENEMIE_SKILL_1B_NUMBER_COLOR,
                                      fontSize: `${ENEMIE_SKILL_1B_NUMBER_FONT_SIZE}px`,
                                      fontFamily: bebasNeue.style.fontFamily,
                                      textAlign: "center",
                                    }}
                                  >
                                    {num}
                                  </div>
                                ) : null;
                              })()}
                          </div>
                          {/* purple2b - coluna direita: ícones à esquerda, largura ajustada para 3 parecerem centralizados */}
                          <div
                            id="purple2b"
                            className="enemie-label-bg flex items-center justify-start"
                            style={{
                              width: `${ENEMIE_SKILL_2B_CONTAINER_WIDTH_PX}px`,
                              paddingLeft: `${ENEMIE_SKILL_2B_SIDE_MARGIN_PX}px`,
                              paddingRight: `${ENEMIE_SKILL_2B_SIDE_MARGIN_PX}px`,
                              gap: `${ENEMIE_SKILL_2B_GAP_PX / 2}px`,
                              height: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              minHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              maxHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              border: "2px solid #000000",
                              borderRadius: "20px",
                              boxShadow: "inset 0 0 15px rgba(0, 0, 0, 0.8)",
                              background: `repeating-linear-gradient(135deg, rgba(83, 44, 115, 0.75) 0%, rgba(83, 44, 115, 0.75) 14.285%, transparent 14.285%, transparent 28.57%, rgba(83, 44, 115, 0.75) 28.57%, rgba(83, 44, 115, 0.75) 42.855%, transparent 42.855%, transparent 57.14%, rgba(83, 44, 115, 0.75) 57.14%, rgba(83, 44, 115, 0.75) 71.425%, transparent 71.425%, transparent 85.71%, rgba(83, 44, 115, 0.75) 85.71%, rgba(83, 44, 115, 0.75) 100%)`,
                            }}
                          >
                            {(() => {
                              const list = card.enemiePurpleSkills ?? [];
                              const has06 = hasEnemie06InSkills(
                                enemieIconOptions,
                                list,
                              );
                              const others = list.filter(
                                (id) =>
                                  !isEnemie01(id) &&
                                  !isEnemie02(id) &&
                                  !isEnemie06(id),
                              );
                              const ordered: { skillId: string; is06: boolean }[] =
                                has06
                                  ? [
                                      {
                                        skillId:
                                          list.find((id) => isEnemie06(id)) ??
                                          "06",
                                        is06: true,
                                      },
                                      ...others.map((id) => ({
                                        skillId: id,
                                        is06: false,
                                      })),
                                    ]
                                  : others.map((id) => ({
                                      skillId: id,
                                      is06: false,
                                    }));
                              return ordered.slice(0, 3);
                            })().map(({ skillId, is06 }) => {
                              const id06 = (card.enemiePurpleSkills ?? []).find(
                                (id) => isEnemie06(id),
                              );
                              const num = is06
                                ? (card.skillNumbers?.[
                                    `enemie-purple-${id06 ?? "06"}`
                                  ] ??
                                    card.enemiePurpleExtraNumber)?.trim()
                                : card.skillNumbers?.[
                                    `enemie-purple-${skillId}`
                                  ]?.trim();
                              return (
                                <div
                                  key={`purple-2b-${skillId}`}
                                  className="relative flex shrink-0 items-center justify-center"
                                  style={{
                                    height: `${ENEMIE_SKILL_ICON_SLOT_HEIGHT_PX}px`,
                                    width: `${ENEMIE_SKILL_2B_SLOT_WIDTH_PX}px`,
                                    flex: `0 0 ${ENEMIE_SKILL_2B_SLOT_WIDTH_PX}px`,
                                  }}
                                >
                                  {(() => {
                                    const iconSrc = is06
                                      ? ENEMIE_06_ICON
                                      : (findEnemieIconForSkill(skillId)
                                          ?.src ?? "");
                                    if (!iconSrc) return null;
                                    return (
                                      <img
                                        src={iconSrc}
                                        alt={
                                          is06
                                            ? "06"
                                            : (findEnemieIconForSkill(skillId)
                                                ?.label ?? skillId)
                                        }
                                        style={{
                                          maxHeight: `${ENEMIE_SKILL_ICON_SLOT_HEIGHT_PX}px`,
                                          width: "auto",
                                          height: "auto",
                                          objectFit: "contain",
                                        }}
                                      />
                                    );
                                  })()}
                                  {num ? (
                                    <div
                                      className="absolute inset-0 flex items-center justify-center font-semibold drop-shadow-lg"
                                      style={{
                                        color: ENEMIE_SKILL_NUMBER_COLOR,
                                        fontSize: `${ENEMIE_SKILL_NUMBER_FONT_SIZE}px`,
                                        fontFamily: bebasNeue.style.fontFamily,
                                      }}
                                    >
                                      {num}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  {/* Div Amarelo - por último na ordem Azul, Roxo, Amarelo */}
                  {card.enemieYellowSkills &&
                    card.enemieYellowSkills.length > 0 && (
                      <div
                        className="flex flex-col gap-2"
                        style={{ height: `${ENEMIE_COLOR_DIV_HEIGHT_PX}px` }}
                      >
                        {/* Amarelo - Linha 1: yellow1a (1 ícone) | yellow2a (vazio) */}
                        <div className="flex items-center justify-center gap-2">
                          {/* yellow1a - coluna esquerda: exclusivo para 01.png */}
                          <div
                            id="yellow1a"
                            className="enemie-label-bg flex items-center justify-center gap-1"
                            style={{
                              width: "65px",
                              height: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              minHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              maxHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              border: "2px solid #000000",
                              borderRadius: "20px",
                              boxShadow: "inset 0 0 15px rgba(0, 0, 0, 0.8)",
                              background: `repeating-linear-gradient(135deg, #CFC752 0%, #CFC752 28.57%, transparent 28.57%, transparent 42.86%, #CFC752 42.86%, #CFC752 71.43%, transparent 71.43%, transparent 100%)`,
                              backgroundPosition: "right center",
                            }}
                          >
                            {card.enemieYellowSkills?.find(isEnemie01) && (
                              <img
                                key="yellow-l1-01"
                                src={ENEMIE_01_ICON}
                                alt="01"
                                style={{
                                  maxHeight: `${ENEMIE_SKILL_ICON_SLOT_HEIGHT_PX}px`,
                                  width: "auto",
                                  height: "auto",
                                  objectFit: "contain",
                                }}
                              />
                            )}
                          </div>
                          {/* yellow2a - coluna direita linha 1: 02.png exclusivo (só aqui) */}
                          <div
                            id="yellow2a"
                            className="enemie-label-bg flex items-center justify-start"
                            style={{
                              width: `${ENEMIE_SKILL_2B_CONTAINER_WIDTH_PX}px`,
                              paddingLeft: `${ENEMIE_SKILL_2B_SIDE_MARGIN_PX}px`,
                              paddingRight: `${ENEMIE_SKILL_2B_SIDE_MARGIN_PX}px`,
                              gap: `${ENEMIE_SKILL_2B_GAP_PX / 2}px`,
                              height: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              minHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              maxHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              border: "2px solid #000000",
                              borderRadius: "20px",
                              boxShadow: "inset 0 0 15px rgba(0, 0, 0, 0.8)",
                              background: `repeating-linear-gradient(135deg, #CFC752 0%, #CFC752 14.285%, transparent 14.285%, transparent 28.57%, #CFC752 28.57%, #CFC752 42.855%, transparent 42.855%, transparent 57.14%, #CFC752 57.14%, #CFC752 71.425%, transparent 71.425%, transparent 85.71%, #CFC752 85.71%, #CFC752 100%)`,
                            }}
                          >
                            {hasEnemie02InSkills(
                              enemieIconOptions,
                              card.enemieYellowSkills,
                            ) && (
                              <div
                                className="relative flex shrink-0 items-center justify-center"
                                style={{
                                  height: `${ENEMIE_SKILL_ICON_SLOT_HEIGHT_PX}px`,
                                  width: `${ENEMIE_SKILL_2B_SLOT_WIDTH_PX}px`,
                                  flex: `0 0 ${ENEMIE_SKILL_2B_SLOT_WIDTH_PX}px`,
                                }}
                              >
                                <img
                                  src={ENEMIE_02_ICON}
                                  alt="02"
                                  style={{
                                    maxHeight: `${ENEMIE_SKILL_ICON_SLOT_HEIGHT_PX}px`,
                                    width: "auto",
                                    height: "auto",
                                    objectFit: "contain",
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        {/* Amarelo - Linha 2: yellow1b (número) | yellow2b (3 ícones + números na frente) */}
                        <div className="flex items-center justify-center gap-2">
                          {/* yellow1b - coluna esquerda: número do ícone único */}
                          <div
                            id="yellow1b"
                            className="enemie-label-bg flex items-center justify-center gap-1"
                            style={{
                              width: "65px",
                              height: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              minHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              maxHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              border: "2px solid #000000",
                              borderRadius: "20px",
                              boxShadow: "inset 0 0 15px rgba(0, 0, 0, 0.8)",
                              background: `repeating-linear-gradient(135deg, #CFC752 0%, #CFC752 28.57%, transparent 28.57%, transparent 42.86%, #CFC752 42.86%, #CFC752 71.43%, transparent 71.43%, transparent 100%)`,
                              backgroundPosition: "right center",
                            }}
                          >
                            {card.enemieYellowSkills?.length > 0 &&
                              (() => {
                                const list = card.enemieYellowSkills ?? [];
                                const id01 = list.find(isEnemie01);
                                const num = id01
                                  ? card.skillNumbers?.[
                                      `enemie-yellow-${id01}`
                                    ]?.trim()
                                  : undefined;
                                return num ? (
                                  <div
                                    className="flex w-full items-center justify-center font-semibold drop-shadow-lg"
                                    style={{
                                      color: ENEMIE_SKILL_1B_NUMBER_COLOR,
                                      fontSize: `${ENEMIE_SKILL_1B_NUMBER_FONT_SIZE}px`,
                                      fontFamily: bebasNeue.style.fontFamily,
                                      textAlign: "center",
                                    }}
                                  >
                                    {num}
                                  </div>
                                ) : null;
                              })()}
                          </div>
                          {/* yellow2b - coluna direita: ícones à esquerda, largura ajustada para 3 parecerem centralizados */}
                          <div
                            id="yellow2b"
                            className="enemie-label-bg flex items-center justify-start"
                            style={{
                              width: `${ENEMIE_SKILL_2B_CONTAINER_WIDTH_PX}px`,
                              paddingLeft: `${ENEMIE_SKILL_2B_SIDE_MARGIN_PX}px`,
                              paddingRight: `${ENEMIE_SKILL_2B_SIDE_MARGIN_PX}px`,
                              gap: `${ENEMIE_SKILL_2B_GAP_PX / 2}px`,
                              height: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              minHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              maxHeight: `${ENEMIE_SKILL_LINE_HEIGHT_PX}px`,
                              border: "2px solid #000000",
                              borderRadius: "20px",
                              boxShadow: "inset 0 0 15px rgba(0, 0, 0, 0.8)",
                              background: `repeating-linear-gradient(135deg, #CFC752 0%, #CFC752 14.285%, transparent 14.285%, transparent 28.57%, #CFC752 28.57%, #CFC752 42.855%, transparent 42.855%, transparent 57.14%, #CFC752 57.14%, #CFC752 71.425%, transparent 71.425%, transparent 85.71%, #CFC752 85.71%, #CFC752 100%)`,
                            }}
                          >
                            {(() => {
                              const list = card.enemieYellowSkills ?? [];
                              const has06 = hasEnemie06InSkills(
                                enemieIconOptions,
                                list,
                              );
                              const others = list.filter(
                                (id) =>
                                  !isEnemie01(id) &&
                                  !isEnemie02(id) &&
                                  !isEnemie06(id),
                              );
                              const ordered: { skillId: string; is06: boolean }[] =
                                has06
                                  ? [
                                      {
                                        skillId:
                                          list.find((id) => isEnemie06(id)) ??
                                          "06",
                                        is06: true,
                                      },
                                      ...others.map((id) => ({
                                        skillId: id,
                                        is06: false,
                                      })),
                                    ]
                                  : others.map((id) => ({
                                      skillId: id,
                                      is06: false,
                                    }));
                              return ordered.slice(0, 3);
                            })().map(({ skillId, is06 }) => {
                              const id06 = (card.enemieYellowSkills ?? []).find(
                                (id) => isEnemie06(id),
                              );
                              const num = is06
                                ? (card.skillNumbers?.[
                                    `enemie-yellow-${id06 ?? "06"}`
                                  ] ??
                                    card.enemieYellowExtraNumber)?.trim()
                                : card.skillNumbers?.[
                                    `enemie-yellow-${skillId}`
                                  ]?.trim();
                              return (
                                <div
                                  key={`yellow-2b-${skillId}`}
                                  className="relative flex shrink-0 items-center justify-center"
                                  style={{
                                    height: `${ENEMIE_SKILL_ICON_SLOT_HEIGHT_PX}px`,
                                    width: `${ENEMIE_SKILL_2B_SLOT_WIDTH_PX}px`,
                                    flex: `0 0 ${ENEMIE_SKILL_2B_SLOT_WIDTH_PX}px`,
                                  }}
                                >
                                  {(() => {
                                    const iconSrc = is06
                                      ? ENEMIE_06_ICON
                                      : (findEnemieIconForSkill(skillId)
                                          ?.src ?? "");
                                    if (!iconSrc) return null;
                                    return (
                                      <img
                                        src={iconSrc}
                                        alt={
                                          is06
                                            ? "06"
                                            : (findEnemieIconForSkill(skillId)
                                                ?.label ?? skillId)
                                        }
                                        style={{
                                          maxHeight: `${ENEMIE_SKILL_ICON_SLOT_HEIGHT_PX}px`,
                                          width: "auto",
                                          height: "auto",
                                          objectFit: "contain",
                                        }}
                                      />
                                    );
                                  })()}
                                  {num ? (
                                    <div
                                      className="absolute inset-0 flex items-center justify-center font-semibold drop-shadow-lg"
                                      style={{
                                        color: ENEMIE_SKILL_NUMBER_COLOR,
                                        fontSize: `${ENEMIE_SKILL_NUMBER_FONT_SIZE}px`,
                                        fontFamily: bebasNeue.style.fontFamily,
                                      }}
                                    >
                                      {num}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                </>
              ) : (
                card.selectedSkills.map((skillId) => {
                  const skill = isEquipWithEffectsLayout(card.layoutId)
                    ? effectIconOptions04.find((o) => o.id === skillId)
                    : skillIconOptions.find((o) => o.id === skillId);
                  if (!skill) return null;
                  const numberInFront = card.skillNumbers?.[skillId]?.trim();
                  const skillTooltip = numberInFront
                    ? TOOLTIP_SKILL_NUMBER[numberInFront]
                    : undefined;
                  const isEffectSkill = isEquipWithEffectsLayout(card.layoutId);
                  return (
                    <div
                      key={skillId}
                      className="group relative flex items-center justify-center"
                      title={skillTooltip}
                    >
                      {skillTooltip && (
                        <span
                          className="pointer-events-none invisible absolute bottom-full left-1/2 z-[100] mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white opacity-0 transition group-hover:visible group-hover:opacity-100"
                          aria-hidden
                        >
                          {skillTooltip}
                        </span>
                      )}
                      <img
                        src={skill.src}
                        alt={skill.label}
                        className="h-26 w-30 object-contain"
                      />
                      {numberInFront ? (
                        <div
                          className="absolute inset-0 z-10 flex items-center justify-center font-semibold drop-shadow-lg"
                          style={{
                            color: "#E3DBD2",
                            fontSize: isEffectSkill ? "40px" : "55px",
                            fontFamily: bebasNeue.style.fontFamily,
                          }}
                        >
                          {numberInFront}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          )}
        {!isBgLayout(card.layoutId) && (
          <div className="flex h-full flex-col gap-0 text-white">
            {!isTensionLayout(card.layoutId) && !isEnemie && (
              <div className="flex items-center gap-4">
                <div
                  className="relative flex h-24 w-24 flex-col items-center justify-center"
                  style={{
                    position: "absolute",
                    top: layoutPositions.icon.top,
                    left: layoutPositions.icon.left,
                  }}
                >
                  {isEquipWithEffectsLayout(card.layoutId) ? null : (
                    <>
                      <img
                        src={
                          card.icon ||
                          iconOptionsA[0]?.src ||
                          DEFAULT_ICON_FALLBACK
                        }
                        alt="Ícone do card"
                        className="h-32 w-32 object-contain"
                      />
                      {card.icon2 && layoutPositions.icon2 && (
                        <img
                          src={card.icon2}
                          alt="Segundo ícone"
                          className="absolute h-32 w-32 object-contain"
                          style={{
                            top: layoutPositions.icon2.top,
                            left: layoutPositions.icon2.left,
                            transform: "translate(-20px, -15px)",
                          }}
                        />
                      )}
                    </>
                  )}

                  <p
                    className="mt-8 ml-5 text-black uppercase text-center font-extrabold "
                    style={{
                      fontSize: "clamp(7.5em, 2vw, 3rem)",
                      letterSpacing: "0.1em",
                      writingMode: "vertical-rl",
                      transform: "rotate(180deg)",
                    }}
                  >
                    {CARD_TYPE_LABEL}
                  </p>
                </div>
                {isEquipWithEffectsLayout(card.layoutId) &&
                  card.equip3Number &&
                  layoutPositions.icon2 && (
                    <div
                      className="flex items-center justify-center"
                      style={{
                        position: "absolute",
                        width: "65px",
                        top: layoutPositions.icon2.top,
                        left: layoutPositions.icon2.left,
                        textAlign: "center",
                        justifyContent: "center",
                        alignItems: "center",
                        flexDirection: "column",
                        flexWrap: "wrap",
                        flexGrow: 1,
                        flexShrink: 1,
                        flexBasis: "auto",
                        flex: 1,
                      }}
                    >
                      <span
                        className="flex text-center items-center justify-center  text-black uppercase"
                        style={{
                          fontSize: "55px",
                          fontFamily: bebasNeue.style.fontFamily,
                        }}
                      >
                        {card.equip3Number}
                      </span>
                    </div>
                  )}
                {isEquipWithEffectsLayout(card.layoutId) &&
                  layoutPositions.effect1 &&
                  layoutPositions.effect2 &&
                  layoutPositions.effect3 &&
                  layoutPositions.effect4 &&
                  [
                    layoutPositions.effect1,
                    layoutPositions.effect2,
                    layoutPositions.effect3,
                    layoutPositions.effect4,
                  ].map((pos, index) => {
                    const effectData =
                      index === 0
                        ? null
                        : index === 1
                          ? {
                              icon: card.effect2Icon,
                              number: card.effect2Number,
                            }
                          : index === 2
                            ? {
                                icon: card.effect3Icon,
                                number: card.effect3Number,
                              }
                            : {
                                icon: card.effect4Icon,
                                number: card.effect4Number,
                              };
                    const optionsForSlot =
                      index === 1
                        ? effect2IconOptions
                        : index === 2
                          ? effect3IconOptions
                          : effect4IconOptions;
                    const effectOption =
                      effectData?.icon &&
                      optionsForSlot.find((o) => o.id === effectData.icon);
                    return (
                      <div
                        key={`effect-${index + 1}`}
                        className="relative flex items-center justify-center text-center"
                        style={{
                          position: "absolute",
                          top: pos.top,
                          left: pos.left,
                          width: "130px",
                          height: "115px",
                          textAlign: "justify",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "column",
                          flexWrap: "wrap",
                          flexGrow: 1,
                          flexShrink: 1,
                          flexBasis: "auto",
                          flex: 1,
                        }}
                      >
                        {index === 0 && card.linhaDeTiro && (
                          <span
                            className="leading-tight text-center text-black drop-shadow-lg"
                            style={{
                              textAlign: "center",
                              justifyContent: "center",
                              alignItems: "center",
                              display: "flex",
                              flexDirection: "column",
                              flexWrap: "wrap",
                              flexGrow: 1,
                              flexShrink: 1,
                              flexBasis: "auto",
                              flex: 1,
                              fontSize: "6rem",
                              fontFamily: bebasNeue.style.fontFamily,
                            }}
                          >
                            {card.linhaDeTiro}
                          </span>
                        )}
                        {index >= 1 && effectOption && (
                          <>
                            {effectData?.number &&
                              (() => {
                                const numberPos =
                                  index === 1
                                    ? layoutPositions.effect2NumberPosition
                                    : index === 2
                                      ? layoutPositions.effect3NumberPosition
                                      : layoutPositions.effect4NumberPosition;
                                const pos = numberPos ?? {
                                  top: "0",
                                  left: "50%",
                                };
                                const isCenterX = pos.left === "50%";
                                const isEffect2WithComma =
                                  index === 1 &&
                                  effectData.number.includes(",");
                                const parts = isEffect2WithComma
                                  ? effectData.number
                                      .split(",")
                                      .map((s) => s.trim())
                                      .filter(Boolean)
                                  : null;
                                const baseNumStyle = {
                                  position: "absolute" as const,
                                  zIndex: 10,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  textAlign: "center" as const,
                                  fontFamily: bebasNeue.style.fontFamily,
                                  fontWeight: 600,
                                  color: "#E3DBD2",
                                  fontSize: "0.5em",
                                  width: "60px",
                                  height: "60px",
                                  lineHeight: 1,
                                };
                                if (
                                  isEffect2WithComma &&
                                  parts &&
                                  parts.length >= 2
                                ) {
                                  const numFontSize = "55px";
                                  const tip0 = TOOLTIP_DICE[parts[0]];
                                  const tip1 = TOOLTIP_DICE[parts[1]];
                                  return (
                                    <>
                                      <div
                                        className="group absolute z-10 flex items-center justify-center text-center font-semibold drop-shadow-lg"
                                        style={{
                                          ...baseNumStyle,
                                          top: "5px",
                                          left: "39px",
                                          transform: isCenterX
                                            ? "translateX(-50%)"
                                            : undefined,
                                          fontSize: numFontSize,
                                        }}
                                        title={tip0 ?? undefined}
                                      >
                                        {tip0 && (
                                          <span
                                            className="pointer-events-none invisible absolute bottom-full left-1/2 z-[100] mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white opacity-0 transition group-hover:visible group-hover:opacity-100"
                                            aria-hidden
                                          >
                                            {tip0}
                                          </span>
                                        )}
                                        <span
                                          style={{
                                            fontSize: "45px",
                                          }}
                                        >
                                          {parts[0]}
                                        </span>
                                      </div>
                                      <div
                                        className="group absolute z-10 flex items-center justify-center text-center font-semibold drop-shadow-lg"
                                        style={{
                                          ...baseNumStyle,
                                          top: "50px",
                                          left: "90px",
                                          transform: isCenterX
                                            ? "translateX(-50%)"
                                            : undefined,
                                          fontSize: "45px",
                                        }}
                                        title={tip1 ?? undefined}
                                      >
                                        {tip1 && (
                                          <span
                                            className="pointer-events-none invisible absolute bottom-full left-1/2 z-[100] mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white opacity-0 transition group-hover:visible group-hover:opacity-100"
                                            aria-hidden
                                          >
                                            {tip1}
                                          </span>
                                        )}
                                        <span
                                          style={{
                                            fontSize: "45px",
                                          }}
                                        >
                                          {parts[1]}
                                        </span>
                                      </div>
                                    </>
                                  );
                                }
                                const isEffect3Or4Icon3 =
                                  (index === 2 || index === 3) &&
                                  effectData.icon === "03";
                                if (isEffect3Or4Icon3) {
                                  const tooltipEffect3Or4 =
                                    index === 2
                                      ? TOOLTIP_EFFECT3[effectData.number]
                                      : TOOLTIP_EFFECT4[effectData.number];
                                  return (
                                    <div
                                      className="group absolute z-10 flex items-center justify-center text-center font-semibold drop-shadow-lg"
                                      style={{
                                        ...baseNumStyle,
                                        top: "5px",
                                        left: "39px",
                                        transform: isCenterX
                                          ? "translateX(-50%)"
                                          : undefined,
                                        fontSize: "45px",
                                        width: "60px",
                                        height: "60px",
                                      }}
                                      title={tooltipEffect3Or4 ?? undefined}
                                    >
                                      {tooltipEffect3Or4 && (
                                        <span
                                          className="pointer-events-none invisible absolute bottom-full left-1/2 z-[100] mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white opacity-0 transition group-hover:visible group-hover:opacity-100"
                                          aria-hidden
                                        >
                                          {tooltipEffect3Or4}
                                        </span>
                                      )}
                                      <span style={{ fontSize: "45px" }}>
                                        {effectData.number}
                                      </span>
                                    </div>
                                  );
                                }
                                const tooltipDefault =
                                  index === 1
                                    ? TOOLTIP_DICE[effectData.number]
                                    : index === 2
                                      ? TOOLTIP_EFFECT3[effectData.number]
                                      : TOOLTIP_EFFECT4[effectData.number];
                                return (
                                  <div
                                    className="group absolute z-10 flex items-center justify-center text-center font-semibold drop-shadow-lg"
                                    style={{
                                      top: pos.top,
                                      left: pos.left,
                                      transform: isCenterX
                                        ? "translateX(-50%)"
                                        : undefined,
                                      width: "120px",
                                      height: "120px",
                                      fontSize: "65px",
                                      fontFamily: bebasNeue.style.fontFamily,
                                    }}
                                    title={tooltipDefault ?? undefined}
                                  >
                                    {tooltipDefault && (
                                      <span
                                        className="pointer-events-none invisible absolute bottom-full left-1/2 z-[100] mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white opacity-0 transition group-hover:visible group-hover:opacity-100"
                                        aria-hidden
                                      >
                                        {tooltipDefault}
                                      </span>
                                    )}
                                    {effectData.number}
                                  </div>
                                );
                              })()}
                            <img
                              src={effectOption.src}
                              alt={effectOption.label}
                              className="h-full w-full object-contain"
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
            {/* Elemento oculto só para medir quantas linhas o título ocupa (altura natural) */}
            <div
              ref={titleMeasureRef}
              aria-hidden
              className="pointer-events-none absolute left-[-9999px] top-0 whitespace-pre-line text-center"
              style={{
                width: layoutPositions.title.width,
                fontSize:
                  titleFontSizePx != null
                    ? `${titleFontSizePx}px`
                    : UNIFIED_TITLE_FONT_SIZE,
                lineHeight: 0.9,
                fontFamily: bebasNeue.style.fontFamily,
              }}
            >
              {card.title || ""}
            </div>
            <h3
              ref={titleRef}
              className="leading-tight text-black text-center drop-shadow-lg "
              style={{
                position: "absolute",
                top: layoutPositions.title.top,
                left: layoutPositions.title.left,
                width: layoutPositions.title.width,
                height: layoutPositions.title.height,
                fontSize:
                  titleFontSizePx != null
                    ? `${titleFontSizePx}px`
                    : UNIFIED_TITLE_FONT_SIZE,
                lineHeight: 0.9,
                textAlign: "center",
                whiteSpace: "pre-line",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                flexWrap: "wrap",
                flexGrow: 1,
                flexShrink: 1,
                flexBasis: "auto",
                flex: 1,
              }}
            >
              {card.title || ""}
            </h3>
            {isTensionLayout(card.layoutId) ? (
              <div
                className="absolute flex flex-col gap-3 text-black text-4xl drop-shadow-lg"
                style={{
                  top: layoutPositions.description.top,
                  left: layoutPositions.description.left,
                  width: layoutPositions.description.width || "570px",
                  height: layoutPositions.description.height,
                  fontFamily: ebGaramond.style.fontFamily,
                  fontWeight: 590,
                  lineHeight: 1,
                }}
              >
                <p
                  className="m-0 w-full text-center whitespace-pre-line"
                  style={{
                    fontFamily: ebGaramond.style.fontFamily,
                    fontWeight: 590,
                    lineHeight: 1,
                  }}
                >
                  {(() => {
                    const desc = card.description || "";
                    const br = desc.indexOf("\n");
                    if (br === -1) return renderTextWithInlineIcons(desc);
                    const first = desc.slice(0, br);
                    const rest = desc.slice(br + 1);
                    return (
                      <>
                        <span style={{ fontWeight: 700 }}>
                          {renderTextWithInlineIcons(first)}
                        </span>
                        {"\n"}
                        {renderTextWithInlineIcons(rest)}
                      </>
                    );
                  })()}
                </p>
                {(card.tension1Icon || card.tension2Icon) && (
                  <div className="flex flex-col gap-3">
                    {card.tension2Icon && tensionIconOptions[1] && (
                      <div className="flex items-center gap-3">
                        <img
                          src={tensionIconOptions[1].src}
                          alt={tensionIconOptions[1].label}
                          className="h-26 w-30 shrink-0 object-contain"
                        />
                        <span
                          className="flex-1 text-left whitespace-pre-line"
                          style={{
                            fontFamily: ebGaramond.style.fontFamily,
                            fontWeight: 590,
                          }}
                        >
                          {renderTextWithInlineIcons(card.tension2Text || "")}
                        </span>
                      </div>
                    )}
                    {card.tension1Icon && tensionIconOptions[0] && (
                      <div className="flex items-center gap-3">
                        <img
                          src={tensionIconOptions[0].src}
                          alt={tensionIconOptions[0].label}
                          className="h-26 w-30 shrink-0 object-contain"
                        />
                        <span
                          className="flex-1 text-left whitespace-pre-line"
                          style={{
                            fontFamily: ebGaramond.style.fontFamily,
                            fontWeight: 590,
                          }}
                        >
                          {renderTextWithInlineIcons(card.tension1Text || "")}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p
                className="absolute text-3xl text-black drop-shadow-lg text-center"
                style={{
                  top: layoutPositions.description.top,
                  left: layoutPositions.description.left,
                  fontFamily: ebGaramond.style.fontFamily,
                  fontWeight: 590,
                  lineHeight: 1,
                  width: layoutPositions.description.width || "570px",
                  height: layoutPositions.description.height || "420px",
                  whiteSpace: "pre-line",
                  ...(isEnemie && {
                    boxShadow: "inset 0 0 10px rgba(0, 0, 0, 0.3)",
                  }),
                }}
              >
                {isEnemie
                  ? (() => {
                      const desc = card.description || "";
                      const br = desc.indexOf("\n");
                      if (br === -1) return renderTextWithInlineIcons(desc);
                      const first = desc.slice(0, br);
                      const rest = desc.slice(br + 1);
                      return (
                        <>
                          <span style={{ fontWeight: 700 }}>
                            {renderTextWithInlineIcons(first)}
                          </span>
                          {"\n"}
                          {renderTextWithInlineIcons(rest)}
                        </>
                      );
                    })()
                  : renderTextWithInlineIcons(card.description || "")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<FormState>(createInitialFormState());
  const [cards, setCards] = useState<CardDesign[]>([]);
  const [overlayImage, setOverlayImage] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropCompleteArea, setCropCompleteArea] = useState<Area | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [overlayCache, setOverlayCache] = useState<
    Record<string, string | null>
  >({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [iconOptionsA, setIconOptionsA] = useState<IconOption[]>([]);
  const [iconOptionsB, setIconOptionsB] = useState<IconOption[]>([]);
  const [skillIconOptions, setSkillIconOptions] = useState<IconOption[]>([]);
  const [effect2IconOptions, setEffect2IconOptions] = useState<IconOption[]>(
    [],
  );
  const [effect3IconOptions, setEffect3IconOptions] = useState<IconOption[]>(
    [],
  );
  const [effect4IconOptions, setEffect4IconOptions] = useState<IconOption[]>(
    [],
  );
  const [effectIconOptions04, setEffectIconOptions04] = useState<IconOption[]>(
    [],
  );
  const [tensionIconOptions, setTensionIconOptions] = useState<IconOption[]>(
    [],
  );
  const [enemieIconOptions, setEnemieIconOptions] = useState<IconOption[]>([]);
  const [exportZipProgress, setExportZipProgress] = useState<number | null>(
    null,
  );
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectedCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = descriptionTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 80)}px`;
  }, [form.description]);

  useEffect(() => {
    const paths = [
      "A",
      "B",
      "C",
      "Effects/01",
      "Effects/02",
      "Effects/03",
      "Effects/04",
      "Tension",
      "Enemies",
    ] as const;
    const setters = [
      setIconOptionsA,
      setIconOptionsB,
      setSkillIconOptions,
      setEffect2IconOptions,
      setEffect3IconOptions,
      setEffect4IconOptions,
      setEffectIconOptions04,
      setTensionIconOptions,
      setEnemieIconOptions,
    ];
    Promise.all(
      paths.map((p) =>
        fetch(`/api/icons?path=${encodeURIComponent(p)}`).then((r) => r.json()),
      ),
    )
      .then((results) => {
        results.forEach((data, i) => {
          if (Array.isArray(data)) setters[i](data);
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (form.icon === "" && iconOptionsA.length > 0) {
      setForm((prev) => ({ ...prev, icon: iconOptionsA[0].src }));
    }
  }, [iconOptionsA.length]);

  const handleArtUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageToCrop(reader.result);
        setCropCompleteArea(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const cropAspect = (() => {
    const config = getLayoutConfig(form.layout);
    const overlay = config.positions?.overlay;
    if (!overlay?.width || !overlay?.height) return 440 / 285;
    const w = parsePx(overlay.width);
    const h = parsePx(overlay.height);
    return w / h;
  })();

  const handleCropConfirm = useCallback(async () => {
    if (!imageToCrop || !cropCompleteArea) return;
    try {
      const cropped = await createCroppedImage(imageToCrop, cropCompleteArea);
      setOverlayImage(cropped);
      setImageToCrop(null);
      setCropCompleteArea(null);
    } catch (err) {
      console.error("Erro ao recortar imagem:", err);
    }
  }, [imageToCrop, cropCompleteArea]);

  const handleCropCancel = useCallback(() => {
    setImageToCrop(null);
    setCropCompleteArea(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const handleLoadCard = async (card: CardDesign) => {
    setForm({
      title: card.title,
      description: card.description,
      layout: card.layoutId,
      image: card.image,
      icon: card.icon,
      icon2: card.icon2 ?? "",
      icon2Id: card.icon2Id ?? "",
      accent: card.accent,
      selectedSkills: card.selectedSkills ?? [],
      skillNumbers: card.skillNumbers ?? {},
      equip3Number: card.equip3Number ?? "",
      linhaDeTiro: card.linhaDeTiro ?? "",
      effect2Icon: card.effect2Icon ?? "",
      effect2Number: card.effect2Number ?? "",
      effect3Icon: card.effect3Icon ?? "",
      effect3Number: "",
      effect4Icon: card.effect4Icon ?? "",
      effect4Number: card.effect4Number ?? "",
      tension1Icon: card.tension1Icon ?? "",
      tension1Text: card.tension1Text ?? "",
      tension2Icon: card.tension2Icon ?? "",
      tension2Text: card.tension2Text ?? "",
      enemieRedNumber: card.enemieRedNumber ?? "0",
      enemieGreenNumber: card.enemieGreenNumber ?? "0",
      enemieBlueNumber: card.enemieBlueNumber ?? "0",
      enemieBlueColor: card.enemieBlueColor ?? false,
      enemieYellowColor: card.enemieYellowColor ?? false,
      enemiePurpleColor: card.enemiePurpleColor ?? false,
      enemieBlueSkills: card.enemieBlueSkills ?? [],
      enemieYellowSkills: card.enemieYellowSkills ?? [],
      enemiePurpleSkills: card.enemiePurpleSkills ?? [],
      enemieMainIcon: card.enemieMainIcon ?? "",
      enemieMainIconNumber: card.enemieMainIconNumber ?? "",
      enemieBlueExtraNumber: card.enemieBlueExtraNumber ?? "",
      enemiePurpleExtraNumber: card.enemiePurpleExtraNumber ?? "",
      enemieYellowExtraNumber: card.enemieYellowExtraNumber ?? "",
    });
    const cachedOverlay = await getOverlayImage(card.id);
    setOverlayImage(cachedOverlay);
    setEditingId(card.id);
  };

  const handleNewCard = () => {
    setForm(createInitialFormState());
    setOverlayImage(null);
    setEditingId(null);
  };

  useEffect(() => {
    if (!editingId) return;
    selectedCardRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [editingId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Array<
        CardDesign & {
          overlayImage?: string | null;
        }
      >;
      const sanitized = parsed.map((card) => {
        const layout = getLayoutConfig(card.layoutId);
        const positions = mergeLayoutPositions(
          card.layoutPositions ?? {},
          layout.positions,
        );
        return {
          ...card,
          layoutPositions: positions,
          selectedSkills: card.selectedSkills ?? [],
          skillNumbers: card.skillNumbers ?? {},
          equip3Number: card.equip3Number ?? "",
          linhaDeTiro: card.linhaDeTiro ?? "",
          effect2Icon: card.effect2Icon ?? "",
          effect2Number: card.effect2Number ?? "",
          effect3Icon: card.effect3Icon ?? "",
          effect3Number: "",
          effect4Icon: card.effect4Icon ?? "",
          effect4Number: card.effect4Number ?? "",
          tension1Icon: card.tension1Icon ?? "",
          tension1Text: card.tension1Text ?? "",
          tension2Icon: card.tension2Icon ?? "",
          tension2Text: card.tension2Text ?? "",
          enemieRedNumber: card.enemieRedNumber ?? "0",
          enemieGreenNumber: card.enemieGreenNumber ?? "0",
          enemieBlueNumber: card.enemieBlueNumber ?? "0",
          enemieBlueColor: card.enemieBlueColor ?? false,
          enemieYellowColor: card.enemieYellowColor ?? false,
          enemiePurpleColor: card.enemiePurpleColor ?? false,
          enemieBlueSkills: card.enemieBlueSkills ?? [],
          enemieYellowSkills: card.enemieYellowSkills ?? [],
          enemiePurpleSkills: card.enemiePurpleSkills ?? [],
          enemieMainIcon: card.enemieMainIcon ?? "",
          enemieMainIconNumber: card.enemieMainIconNumber ?? "",
          enemieBlueExtraNumber: card.enemieBlueExtraNumber ?? "",
          enemiePurpleExtraNumber: card.enemiePurpleExtraNumber ?? "",
          enemieYellowExtraNumber: card.enemieYellowExtraNumber ?? "",
        };
      });
      setCards(sanitized);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cards));
      setStorageWarning(null);
    } catch (error) {
      console.error(
        "Não foi possível persistir os cards no localStorage.",
        error,
      );
      setStorageWarning(
        "O navegador bloqueou o armazenamento local. Tente limpar o cache ou usar outro navegador.",
      );
    }
  }, [cards]);

  useEffect(() => {
    let active = true;

    const syncOverlayCache = async () => {
      const entries = await Promise.all(
        cards.map(
          async (card) => [card.id, await getOverlayImage(card.id)] as const,
        ),
      );
      if (!active) return;
      setOverlayCache(Object.fromEntries(entries));
    };

    syncOverlayCache();
    return () => {
      active = false;
    };
  }, [cards]);

  const currentLayoutConfig = getLayoutConfig(form.layout);
  const showExtraIcons =
    !isEquipWithEffectsLayout(currentLayoutConfig.id) &&
    Boolean(currentLayoutConfig.positions.icon2);

  const previewCard = {
    icon: form.icon,
    icon2: form.icon2 || null,
    icon2Id: form.icon2Id || null,
    title: form.title,
    description: form.description,
    image: form.image,
    type: CARD_TYPE_LABEL,
    accent: form.accent,
    layoutId: form.layout,
    selectedSkills: form.selectedSkills,
    skillNumbers: form.skillNumbers ?? {},
    enemieBlueSkills: form.enemieBlueSkills ?? [],
    enemieYellowSkills: form.enemieYellowSkills ?? [],
    enemiePurpleSkills: form.enemiePurpleSkills ?? [],
    equip3Number: form.equip3Number,
    linhaDeTiro: form.linhaDeTiro,
    effect2Icon: form.effect2Icon,
    effect2Number: form.effect2Number,
    effect3Icon: form.effect3Icon,
    effect3Number: form.effect3Number,
    effect4Icon: form.effect4Icon,
    effect4Number: form.effect4Number,
    tension1Icon: form.tension1Icon,
    tension1Text: form.tension1Text,
    tension2Icon: form.tension2Icon,
    tension2Text: form.tension2Text,
    enemieRedNumber: form.enemieRedNumber,
    enemieGreenNumber: form.enemieGreenNumber,
    enemieBlueNumber: form.enemieBlueNumber,
    enemieBlueColor: form.enemieBlueColor,
    enemieYellowColor: form.enemieYellowColor,
    enemiePurpleColor: form.enemiePurpleColor,
    enemieMainIcon: form.enemieMainIcon || "",
    enemieMainIconNumber: form.enemieMainIconNumber || "",
    enemieBlueExtraNumber: form.enemieBlueExtraNumber ?? "",
    enemiePurpleExtraNumber: form.enemiePurpleExtraNumber ?? "",
    enemieYellowExtraNumber: form.enemieYellowExtraNumber ?? "",
    layoutPositions: currentLayoutConfig.positions,
  };

  const handleSaveCard = async () => {
    const cardId = editingId ?? crypto.randomUUID();
    const cardToSave: CardDesign = {
      id: cardId,
      ...previewCard,
    };

    setCards((prev) => {
      const exists = prev.some((card) => card.id === cardToSave.id);
      if (exists) {
        return prev.map((card) =>
          card.id === cardToSave.id ? cardToSave : card,
        );
      }
      return [cardToSave, ...prev];
    });

    if (overlayImage) {
      await saveOverlayImage(cardId, overlayImage);
    } else {
      await deleteOverlayImage(cardId);
    }

    setOverlayCache((prev) => {
      const next = { ...prev };
      if (overlayImage) {
        next[cardId] = overlayImage;
      } else {
        delete next[cardId];
      }
      return next;
    });

    const nextList = editingId
      ? cards.map((c) => (c.id === cardId ? cardToSave : c))
      : [cardToSave, ...cards];
    const currentIndex = nextList.findIndex((c) => c.id === cardId);
    const nextCardWithoutArt = nextList
      .slice(currentIndex + 1)
      .find((c) => !overlayCache[c.id]);

    if (nextCardWithoutArt) {
      await handleLoadCard(nextCardWithoutArt);
      setStatusMessage(
        'Card salvo! Indo para o próximo sem arte. Clique em "Novo card" para criar outro do zero.',
      );
    } else {
      setEditingId(cardId);
      setStatusMessage("Card salvo! Você pode baixá-lo no painel abaixo.");
    }
  };

  const handleDownload = async (htmlId: string, filename: string) => {
    const node = document.getElementById(htmlId);
    if (!node) return;

    try {
      const dataUrl = await toPng(node, { cacheBust: true });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = filename;
      link.click();
      setStatusMessage("Download iniciado.");
    } catch (error) {
      console.error(error);
      setStatusMessage("Erro ao gerar a imagem. Tente novamente.");
    }
  };

  const handleRemoveCard = (id: string) => {
    setCards((prev) => prev.filter((card) => card.id !== id));
    setOverlayCache((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    void deleteOverlayImage(id);
  };

  const createExportData = () =>
    cards.map(
      ({
        title,
        description,
        layoutId,
        icon,
        icon2Id,
        selectedSkills,
        skillNumbers,
        equip3Number,
        linhaDeTiro,
        effect2Icon,
        effect2Number,
        effect3Icon,
        effect3Number,
        effect4Icon,
        effect4Number,
        tension1Icon,
        tension1Text,
        tension2Icon,
        tension2Text,
        enemieRedNumber,
        enemieGreenNumber,
        enemieBlueNumber,
        enemieBlueColor,
        enemieYellowColor,
        enemiePurpleColor,
        enemieBlueSkills,
        enemieYellowSkills,
        enemiePurpleSkills,
        enemieMainIcon,
        enemieMainIconNumber,
        enemieBlueExtraNumber,
        enemiePurpleExtraNumber,
        enemieYellowExtraNumber,
      }: CardDesign) => ({
        title,
        description,
        layoutId,
        icon,
        icon2Id,
        selectedSkills,
        skillNumbers: skillNumbers ?? {},
        skillId: selectedSkills[0] ?? null,
        equip3Number,
        linhaDeTiro,
        effect2Icon,
        effect2Number,
        effect3Icon,
        effect3Number,
        effect4Icon,
        effect4Number,
        tension1Icon,
        tension1Text,
        tension2Icon,
        tension2Text,
        enemieRedNumber,
        enemieGreenNumber,
        enemieBlueNumber,
        enemieBlueColor,
        enemieYellowColor,
        enemiePurpleColor,
        enemieBlueSkills: enemieBlueSkills ?? [],
        enemieYellowSkills: enemieYellowSkills ?? [],
        enemiePurpleSkills: enemiePurpleSkills ?? [],
        enemieMainIcon: enemieMainIcon ?? "",
        enemieMainIconNumber: enemieMainIconNumber ?? "",
        enemieBlueExtraNumber: enemieBlueExtraNumber ?? "",
        enemiePurpleExtraNumber: enemiePurpleExtraNumber ?? "",
        enemieYellowExtraNumber: enemieYellowExtraNumber ?? "",
      }),
    );

  const handleExportJson = () => {
    if (cards.length === 0) return;
    const data = JSON.stringify(createExportData(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "re-card-creator-cards.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const sanitizeFileName = (title: string) => {
    const base =
      (title || "sem-titulo")
        .trim()
        .replace(/[/\\:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120) || "sem-titulo";
    return base;
  };

  const handleExportZip = async () => {
    if (cards.length === 0) return;
    setExportZipProgress(0);
    const zip = new JSZip();
    const cardsFolder = zip.folder("cards");
    const usedNames = new Set<string>();
    const total = cards.length;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const node = document.getElementById(`zip-card-${card.id}`);
      if (!node) continue;
      try {
        const dataUrl = await toPng(node, { cacheBust: true });
        const base64 = dataUrl.split(",")[1];
        const baseName = sanitizeFileName(card.title);
        let fileName = `${baseName}.png`;
        let n = 0;
        while (usedNames.has(fileName)) {
          n += 1;
          fileName = `${baseName}-${n}.png`;
        }
        usedNames.add(fileName);
        cardsFolder?.file(fileName, base64, { base64: true });
      } catch (error) {
        console.error("Falha ao gerar imagem para exportar:", error);
      }
      setExportZipProgress(Math.round(((i + 1) / total) * 85));
    }
    setExportZipProgress(88);
    const jsonData = JSON.stringify(createExportData(), null, 2);
    zip.file("re-card-creator-cards.json", jsonData);
    setExportZipProgress(90);
    const blob = await zip.generateAsync({ type: "blob" });
    setExportZipProgress(95);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "re-card-creator-cards.zip";
    link.click();
    URL.revokeObjectURL(url);
    setExportZipProgress(100);
    setTimeout(() => setExportZipProgress(null), 400);
  };

  const handleClearData = async () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    setCards([]);
    setOverlayCache({});
    setOverlayImage(null);
    setEditingId(null);
    await clearOverlayStore();
    setStatusMessage("Banco reiniciado. Comece um novo projeto.");
  };

  const handleImportJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (typeof reader.result !== "string") {
          throw new Error("Arquivo inválido.");
        }
        const parsed = JSON.parse(reader.result) as Array<{
          title: string;
          description: string;
          layoutId: string;
          icon: string;
          icon2Id?: string | null;
          icon2?: string | null;
          selectedSkills?: string[];
          skillNumbers?: Record<string, string>;
          equip3Number?: string | null;
          linhaDeTiro?: string | null;
          effect2Icon?: string | null;
          effect2Number?: string | null;
          effect3Icon?: string | null;
          effect3Number?: string | null;
          effect4Icon?: string | null;
          effect4Number?: string | null;
          tension1Icon?: string | null;
          tension1Text?: string | null;
          tension2Icon?: string | null;
          tension2Text?: string | null;
          enemieRedNumber?: string | null;
          enemieGreenNumber?: string | null;
          enemieBlueNumber?: string | null;
          enemieBlueColor?: boolean | null;
          enemieYellowColor?: boolean | null;
          enemiePurpleColor?: boolean | null;
          enemieBlueSkills?: string[];
          enemieYellowSkills?: string[];
          enemiePurpleSkills?: string[];
          enemieMainIcon?: string | null;
          enemieMainIconNumber?: string | null;
          enemieBlueExtraNumber?: string | null;
          enemiePurpleExtraNumber?: string | null;
          enemieYellowExtraNumber?: string | null;
        }>;
        const importedCards = parsed.map((item) => {
          const layout = getLayoutConfig(item.layoutId);
          const icon2Option = item.icon2Id
            ? iconOptionsB.find((option) => option.id === item.icon2Id)
            : undefined;
          return {
            id: crypto.randomUUID(),
            title: item.title,
            description: item.description,
            image: layout.image,
            icon: item.icon,
            icon2: item.icon2 ?? icon2Option?.src ?? null,
            icon2Id: item.icon2Id ?? null,
            accent: DEFAULT_ACCENT,
            type: CARD_TYPE_LABEL,
            layoutId: layout.id,
            selectedSkills: item.selectedSkills ?? [],
            skillNumbers: item.skillNumbers ?? {},
            equip3Number: item.equip3Number ?? "",
            linhaDeTiro: item.linhaDeTiro ?? "",
            effect2Icon: item.effect2Icon ?? "",
            effect2Number: item.effect2Number ?? "",
            effect3Icon: item.effect3Icon ?? "",
            effect3Number: "",
            effect4Icon: item.effect4Icon ?? "",
            effect4Number: item.effect4Number ?? "",
            tension1Icon: item.tension1Icon ?? "",
            tension1Text: item.tension1Text ?? "",
            tension2Icon: item.tension2Icon ?? "",
            tension2Text: item.tension2Text ?? "",
            enemieRedNumber: item.enemieRedNumber ?? "0",
            enemieGreenNumber: item.enemieGreenNumber ?? "0",
            enemieBlueNumber: item.enemieBlueNumber ?? "0",
            enemieBlueColor: item.enemieBlueColor ?? false,
            enemieYellowColor: item.enemieYellowColor ?? false,
            enemiePurpleColor: item.enemiePurpleColor ?? false,
            enemieBlueSkills: item.enemieBlueSkills ?? [],
            enemieYellowSkills: item.enemieYellowSkills ?? [],
            enemiePurpleSkills: item.enemiePurpleSkills ?? [],
            enemieMainIcon: item.enemieMainIcon ?? "",
            enemieMainIconNumber: item.enemieMainIconNumber ?? "",
            enemieBlueExtraNumber: item.enemieBlueExtraNumber ?? "",
            enemiePurpleExtraNumber: item.enemiePurpleExtraNumber ?? "",
            enemieYellowExtraNumber: item.enemieYellowExtraNumber ?? "",
            layoutPositions: layout.positions,
          };
        });
        setCards((prev) => [...importedCards, ...prev]);
        setImportError(null);
      } catch (error) {
        console.error(error);
        setImportError("Arquivo inválido.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const circleRadius = 45;
  const circleCircumference = 2 * Math.PI * circleRadius;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {exportZipProgress !== null && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
          aria-modal="true"
          aria-busy="true"
          aria-label="Preparando download"
          style={{ pointerEvents: "auto" }}
        >
          <div className="flex flex-col items-center gap-6">
            <div className="relative h-28 w-28">
              <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={circleRadius}
                  fill="none"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={circleRadius}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circleCircumference}
                  strokeDashoffset={
                    circleCircumference * (1 - (exportZipProgress ?? 0) / 100)
                  }
                  className="transition-all duration-300 ease-out"
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-white">Preparando ZIP...</p>
            <p className="text-3xl font-bold tabular-nums text-amber-400">
              {exportZipProgress}%
            </p>
          </div>
        </div>
      )}
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.5em] text-slate-400">
            RE Card Creator
          </p>
          <h1 className="text-3xl font-semibold leading-tight">
            Crie cards com base em um canvas inspirado no Canva, inclua ícones e
            texto e baixe em PNG.
          </h1>
          <p className="max-w-3xl text-lg text-slate-300">
            Preencha o formulário e veja o card tomando forma em tempo real. A
            cada versão salva o card é listado abaixo com opções de download e
            gerenciamento.
          </p>
        </header>

        <div className="space-y-3 rounded-3xl border border-white/10 bg-black/50 p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-white">Cards salvos</p>
              <span className="text-xs uppercase tracking-[0.4em] text-slate-400">
                {cards.length} registros
              </span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                className="rounded-2xl border border-white/20 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white transition hover:border-white"
                onClick={handleExportJson}
              >
                Exportar JSON
              </button>
              <button
                type="button"
                disabled={exportZipProgress !== null}
                className="rounded-2xl border border-white/20 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white transition hover:border-white disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={() => void handleExportZip()}
              >
                Exportar ZIP
              </button>
              <button
                type="button"
                className="rounded-2xl border border-white/20 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white transition hover:border-white"
                onClick={() => importFileRef.current?.click()}
              >
                Importar JSON
              </button>
              <button
                type="button"
                className="rounded-2xl border  bg-red-600/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-red-100 transition hover:border-red-300"
                onClick={() => void handleClearData()}
              >
                Limpar DB
              </button>
              <input
                type="file"
                accept="application/json"
                ref={importFileRef}
                className="hidden"
                onChange={handleImportJson}
              />
            </div>
          </div>
          {importError && (
            <p className="text-xs text-rose-300">{importError}</p>
          )}
          {storageWarning && (
            <p className="text-xs text-amber-300">{storageWarning}</p>
          )}
          <div className="overflow-x-auto overflow-y-hidden pb-2">
            {cards.length === 0 ? (
              <div className="flex h-52 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs uppercase tracking-[0.3em] text-slate-400">
                Nenhum card salvo
              </div>
            ) : (
              <div className="flex flex-nowrap gap-3">
                {cards.map((savedCard) => {
                  const scale = 150 / OUTER_DIMENSIONS.width;
                  const isSelected = savedCard.id === editingId;
                  return (
                    <div
                      key={savedCard.id}
                      ref={isSelected ? selectedCardRef : undefined}
                      className="relative group shrink-0"
                    >
                      <button
                        type="button"
                        onClick={() => void handleLoadCard(savedCard)}
                        className={`group relative z-0 block w-[150px] overflow-hidden rounded-2xl border bg-slate-900/50 transition hover:scale-105 hover:z-10 ${
                          isSelected
                            ? "border-orange-500 ring-2 ring-orange-500"
                            : "border-white/10 hover:border-white"
                        }`}
                        style={{
                          height: `${Math.round(
                            OUTER_DIMENSIONS.height * scale,
                          )}px`,
                        }}
                      >
                        <div
                          className="absolute left-0 top-0 origin-top-left"
                          style={{
                            width: OUTER_DIMENSIONS.width,
                            height: OUTER_DIMENSIONS.height,
                            transform: `scale(${scale})`,
                          }}
                        >
                          <CardPreview
                            card={savedCard}
                            overlayImage={overlayCache[savedCard.id] ?? null}
                            htmlId={`thumb-${savedCard.id}`}
                            iconOptionsA={iconOptionsA}
                            skillIconOptions={skillIconOptions}
                            enemieIconOptions={enemieIconOptions}
                            effect2IconOptions={effect2IconOptions}
                            effect3IconOptions={effect3IconOptions}
                            effect4IconOptions={effect4IconOptions}
                            effectIconOptions04={effectIconOptions04}
                            tensionIconOptions={tensionIconOptions}
                            showDebugBackground={false}
                          />
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRemoveCard(savedCard.id);
                        }}
                        className="absolute right-1 top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-white/30 bg-red-600/90 text-xs font-bold text-white opacity-0 transition hover:opacity-100 group-hover:opacity-100"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleNewCard}
            className="w-full rounded-2xl border border-white/20 bg-transparent px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white"
          >
            Novo card
          </button>
        </div>
        <section
          className={`grid gap-8 ${
            isEnemieLayout(form.layout)
              ? "lg:grid-rows-[auto_1fr]"
              : "lg:grid-cols-[1.1fr_0.9fr]"
          }`}
        >
          <div
            className={`space-y-6 rounded-3xl border-white/10 bg-black/40 p-6 shadow-xl ${
              isEnemieLayout(form.layout) ? "order-1" : ""
            }`}
          >
            <div className="flex flex-col gap-3">
              <h2 className="text-2xl font-semibold">Conteúdo do card</h2>
            </div>

            <div className="space-y-4">
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Título (Enter quebra a linha)
                <textarea
                  rows={2}
                  placeholder="Lançamento imperdível"
                  value={form.title || ""}
                  className="rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-base text-white outline-none transition focus:border-slate-300 resize-none"
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Descrição (Enter quebra a linha)
                <textarea
                  ref={descriptionTextareaRef}
                  rows={3}
                  placeholder="Conte um pouco mais sobre a campanha..."
                  value={form.description || ""}
                  className="rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm leading-relaxed text-white outline-none transition focus:border-slate-300 overflow-hidden resize-y min-h-[80px]"
                  style={{ minHeight: 80 }}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      description: capitalizeLongWords(event.target.value),
                    }))
                  }
                />
              </label>
              <div className="flex flex-col gap-2 text-sm text-slate-300">
                <span>Layout</span>
                <div
                  className="grid gap-2 overflow-x-auto overflow-y-auto rounded-2xl border border-white/10 bg-black/50 p-2"
                  style={{
                    maxHeight: 220,
                    gridTemplateColumns: "repeat(3, 100px)",
                  }}
                >
                  {layoutOptions.map((option) => {
                    const layoutScale = 100 / OUTER_DIMENSIONS.width;
                    const thumbW = 100;
                    const thumbH = Math.round(
                      OUTER_DIMENSIONS.height * layoutScale,
                    );
                    const isSelected = form.layout === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          const selected = getLayoutConfig(option.id);
                          const isEquip3 = isEquipWithEffectsLayout(
                            selected.id,
                          );
                          setForm((prev) => ({
                            ...prev,
                            layout: selected.id,
                            image: selected.image,
                            icon: isEquip3
                              ? ""
                              : prev.icon || (iconOptionsA[0]?.src ?? ""),
                            icon2: selected.positions.icon2 ? prev.icon2 : "",
                            icon2Id: selected.positions.icon2
                              ? prev.icon2Id
                              : "",
                          }));
                        }}
                        className={`shrink-0 overflow-hidden rounded-xl border-2 transition ${
                          isSelected
                            ? "border-amber-500 ring-2 ring-amber-500/50"
                            : "border-white/20 hover:border-white/50"
                        }`}
                        style={{
                          width: thumbW,
                          height: thumbH,
                        }}
                        title={option.label}
                      >
                        <img
                          src={option.image}
                          alt={option.label}
                          className="h-full w-full object-cover object-top"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
              {isEnemieLayout(form.layout) && (
                <div className="flex gap-4">
                  <label className="flex flex-col gap-2 text-sm text-slate-300 flex-1">
                    <span className="text-red-400">Perigo</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.enemieRedNumber || "0"}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "");
                        setForm((prev) => ({
                          ...prev,
                          enemieRedNumber: value.slice(-1) || "0",
                        }));
                      }}
                      className="rounded-2xl border border-red-500/50 bg-transparent px-4 py-3 text-base text-white outline-none transition focus:border-red-500"
                      placeholder="0"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-slate-300 flex-1">
                    <span className="text-green-400">Velocidade</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.enemieGreenNumber || "0"}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "");
                        setForm((prev) => ({
                          ...prev,
                          enemieGreenNumber: value.slice(-1) || "0",
                        }));
                      }}
                      className="rounded-2xl border border-green-500/50 bg-transparent px-4 py-3 text-base text-white outline-none transition focus:border-green-500"
                      placeholder="0"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-slate-300 flex-1">
                    <span className="text-blue-400">Vida</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.enemieBlueNumber || "0"}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          enemieBlueNumber:
                            e.target.value.replace(/\D/g, "") || "0",
                        }))
                      }
                      className="rounded-2xl border border-blue-500/50 bg-transparent px-4 py-3 text-base text-white outline-none transition focus:border-blue-500"
                      placeholder="0"
                    />
                  </label>
                </div>
              )}
              <div className="flex flex-col gap-2 text-sm text-slate-300">
                <span>Arte própria?</span>
                <button
                  type="button"
                  className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-700 to-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/60"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Enviar arte
                </button>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleArtUpload}
                />
              </div>
            </div>

            {form.layout !== "equip3" &&
              !isTensionLayout(form.layout) &&
              !isEnemieLayout(form.layout) && (
                <>
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold">Ícone 1</h3>
                    <div className="flex gap-3">
                      {iconOptionsA.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({ ...prev, icon: item.src }))
                          }
                          className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${
                            form.icon === item.src
                              ? "border-amber-400 bg-[#EDE4D7]"
                              : "border-white/20 bg-[#EDE4D7]/70"
                          }`}
                        >
                          <img
                            src={item.src}
                            alt={item.label}
                            className="h-6 w-6 object-contain"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  {showExtraIcons && (
                    <div className="space-y-3">
                      <h3 className="text-xl font-semibold">Dados</h3>
                      <div className="flex gap-3">
                        {iconOptionsB.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                icon2: item.src,
                                icon2Id: item.id,
                              }))
                            }
                            className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${
                              form.icon2 === item.src
                                ? "border-amber-400 bg-[#EDE4D7]"
                                : "border-white/20 bg-[#EDE4D7]/70"
                            }`}
                          >
                            <img
                              src={item.src}
                              alt={item.label}
                              className="h-6 w-6 object-contain"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

            {form.layout !== "equip3" &&
              !isTensionLayout(form.layout) &&
              !isEnemieLayout(form.layout) && (
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold">Skills</h3>
                  <div className="flex flex-wrap gap-4">
                    {skillIconOptions.map((skill) => {
                      const selected = form.selectedSkills.includes(skill.id);
                      return (
                        <div
                          key={skill.id}
                          className="flex flex-col items-center gap-1"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setForm((prev) => {
                                const exists = prev.selectedSkills.includes(
                                  skill.id,
                                );
                                const next = exists
                                  ? prev.selectedSkills.filter(
                                      (id) => id !== skill.id,
                                    )
                                  : [...prev.selectedSkills, skill.id];
                                return { ...prev, selectedSkills: next };
                              })
                            }
                            className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${
                              selected
                                ? "border-amber-400 bg-[#EDE4D7]"
                                : "border-white/20 bg-[#EDE4D7]/70"
                            }`}
                            title={
                              TOOLTIP_SKILL_NUMBER[String(Number(skill.id))] ??
                              skill.label
                            }
                          >
                            <img
                              src={skill.src}
                              alt={skill.label}
                              className="h-6 w-6 object-contain"
                            />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={form.skillNumbers?.[skill.id] || ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                skillNumbers: {
                                  ...prev.skillNumbers,
                                  [skill.id]: e.target.value.replace(/\D/g, ""),
                                },
                              }))
                            }
                            className="w-12 rounded border border-white/10 bg-white/5 px-1 py-0.5 text-center text-xs text-white"
                            placeholder="Nº"
                            title={Object.entries(TOOLTIP_SKILL_NUMBER)
                              .map(([k, v]) => `${k} = ${v}`)
                              .join(" | ")}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 text-xs uppercase tracking-[0.3em] text-slate-300">
                    {form.selectedSkills.length === 0 ? (
                      <span className="w-full text-center text-[0.55rem]">
                        Nenhuma skill selecionada
                      </span>
                    ) : (
                      form.selectedSkills.map((skillId) => {
                        const skill = skillIconOptions.find(
                          (option) => option.id === skillId,
                        );
                        if (!skill) return null;
                        return (
                          <span
                            key={`selected-skill-${skillId}`}
                            className="flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-2 py-1 text-[0.6rem] text-slate-100"
                          >
                            <img
                              src={skill.src}
                              alt={skill.label}
                              className="h-4 w-4 object-contain"
                            />
                            {skill.label}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            {form.layout === "equip3" && (
              <>
                <label className="flex flex-col gap-2 text-sm text-slate-300">
                  Marcador de Munição
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.equip3Number || ""}
                    maxLength={3}
                    className="rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm text-white outline-none transition focus:border-slate-300"
                    placeholder="ex: 09"
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        equip3Number: event.target.value,
                      }))
                    }
                  />
                </label>

                <div className="space-y-4 border-t border-white/10 pt-4">
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-slate-300">
                      1. Linha de tiro
                    </span>
                    <input
                      type="text"
                      value={form.linhaDeTiro || ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          linhaDeTiro: e.target.value.toUpperCase(),
                        }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-slate-400"
                      placeholder="ex: LOS"
                    />
                  </div>

                  <div className="space-y-2">
                    <span className="text-sm font-medium text-slate-300">
                      Dados de Ataque
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.effect2Number || ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            effect2Number: e.target.value.replace(
                              /[^\d,]/g,
                              "",
                            ),
                          }))
                        }
                        className="w-14 rounded-full border border-white/10 bg-white/5 px-2 py-1.5 text-center text-sm text-white"
                        placeholder="Nº ou 1,2"
                        title={Object.entries(TOOLTIP_DICE)
                          .map(([, v]) => `${v}`)
                          .join(" | ")}
                      />
                      {effect2IconOptions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              effect2Icon: item.id,
                            }))
                          }
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
                            form.effect2Icon === item.id
                              ? "border-amber-400 bg-[#EDE4D7]"
                              : "border-white/20 bg-[#D9CCBE]"
                          }`}
                          title={Object.entries(TOOLTIP_DICE)
                            .map(([, v]) => `${v}`)
                            .join(" | ")}
                        >
                          <img
                            src={item.src}
                            alt={item.label}
                            className="h-6 w-6 object-contain"
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-sm font-medium text-slate-300">
                      Efeito secundário
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.effect3Number || ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            effect3Number: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                        className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-center text-sm text-white"
                        placeholder="Nº"
                        title={Object.entries(TOOLTIP_EFFECT3)
                          .map(([k, v]) => `${k} = ${v}`)
                          .join(" | ")}
                      />
                      {effect3IconOptions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              effect3Icon: item.id,
                            }))
                          }
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition ${
                            form.effect3Icon === item.id
                              ? "border-amber-400 bg-[#EDE4D7]"
                              : "border-white/20 bg-[#D9CCBE]"
                          }`}
                          title={
                            TOOLTIP_EFFECT3[String(Number(item.id))] ??
                            item.label
                          }
                        >
                          <img
                            src={item.src}
                            alt={item.label}
                            className="h-6 w-6 object-contain"
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-sm font-medium text-slate-300">
                      Efeito primário
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.effect4Number || ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            effect4Number: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                        className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-center text-sm text-white"
                        placeholder="Nº"
                        title={Object.entries(TOOLTIP_EFFECT4)
                          .map(([k, v]) => `${k} = ${v}`)
                          .join(" | ")}
                      />
                      {effect4IconOptions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              effect4Icon: item.id,
                            }))
                          }
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition ${
                            form.effect4Icon === item.id
                              ? "border-amber-400 bg-[#EDE4D7]"
                              : "border-white/20 bg-[#D9CCBE]"
                          }`}
                          title={
                            TOOLTIP_EFFECT4[String(Number(item.id))] ??
                            item.label
                          }
                        >
                          <img
                            src={item.src}
                            alt={item.label}
                            className="h-6 w-6 object-contain"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border-t border-white/10 pt-4">
                  <h3 className="text-xl font-semibold">Skills</h3>

                  <div className="flex flex-wrap gap-4 justify-center items-start">
                    {effectIconOptions04.map((item) => {
                      const selected = form.selectedSkills.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className="flex flex-col items-center gap-1"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setForm((prev) => {
                                const exists = prev.selectedSkills.includes(
                                  item.id,
                                );
                                const next = exists
                                  ? prev.selectedSkills.filter(
                                      (id) => id !== item.id,
                                    )
                                  : [...prev.selectedSkills, item.id];
                                return { ...prev, selectedSkills: next };
                              })
                            }
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border transition hover:opacity-90 ${
                              selected
                                ? "border-amber-400 bg-[#EDE4D7]"
                                : "border-white/20"
                            }`}
                            style={
                              selected
                                ? undefined
                                : { backgroundColor: "#D9CCBE" }
                            }
                            title={
                              TOOLTIP_SKILL_NUMBER[String(Number(item.id))] ??
                              item.label
                            }
                          >
                            <img
                              src={item.src}
                              alt={item.label}
                              className="h-8 w-8 object-contain"
                            />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={form.skillNumbers?.[item.id] || ""}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                skillNumbers: {
                                  ...prev.skillNumbers,
                                  [item.id]: e.target.value.replace(/\D/g, ""),
                                },
                              }))
                            }
                            className="w-12 rounded border border-white/10 bg-white/5 px-1 py-0.5 text-center text-xs text-white"
                            placeholder="Nº"
                            title={Object.entries(TOOLTIP_SKILL_NUMBER)
                              .map(([k, v]) => `${k} = ${v}`)
                              .join(" | ")}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 text-xs uppercase tracking-[0.3em] text-slate-300">
                    {form.selectedSkills.length === 0
                      ? ""
                      : form.selectedSkills.map((skillId) => {
                          const skill = effectIconOptions04.find(
                            (o) => o.id === skillId,
                          );
                          if (!skill) return null;
                          return (
                            <span
                              key={`selected-skill-04-${skillId}`}
                              className="flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-2 py-1 text-[0.6rem] text-slate-100"
                            >
                              <img
                                src={skill.src}
                                alt={skill.label}
                                className="h-4 w-4 object-contain"
                              />
                              {skill.label}
                            </span>
                          );
                        })}
                  </div>
                </div>
              </>
            )}

            {isTensionLayout(form.layout) && (
              <div className="space-y-4 border-t border-white/10 pt-4">
                <span className="text-sm font-medium text-slate-300">
                  Ícones de tensão (clique no ícone para selecionar)
                </span>
                <div className="space-y-3">
                  {tensionIconOptions[1] && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            tension2Icon:
                              prev.tension2Icon === tensionIconOptions[1].id
                                ? ""
                                : tensionIconOptions[1].id,
                            ...(prev.tension2Icon === tensionIconOptions[1].id
                              ? { tension2Text: "" }
                              : {}),
                          }))
                        }
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
                          form.tension2Icon === tensionIconOptions[1].id
                            ? "border-amber-400 bg-[#EDE4D7]"
                            : "border-white/20 bg-[#D9CCBE]"
                        }`}
                        title={tensionIconOptions[1].label}
                      >
                        <img
                          src={tensionIconOptions[1].src}
                          alt={tensionIconOptions[1].label}
                          className="h-6 w-6 object-contain"
                        />
                      </button>
                      {form.tension2Icon === tensionIconOptions[1].id && (
                        <input
                          type="text"
                          value={form.tension2Text || ""}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              tension2Text: e.target.value,
                            }))
                          }
                          className="min-w-[200px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-slate-400"
                          placeholder="Texto ao lado do ícone (caveira)"
                        />
                      )}
                    </div>
                  )}
                  {tensionIconOptions[0] && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            tension1Icon:
                              prev.tension1Icon === tensionIconOptions[0].id
                                ? ""
                                : tensionIconOptions[0].id,
                            ...(prev.tension1Icon === tensionIconOptions[0].id
                              ? { tension1Text: "" }
                              : {}),
                          }))
                        }
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition ${
                          form.tension1Icon === tensionIconOptions[0].id
                            ? "border-amber-400 bg-[#EDE4D7]"
                            : "border-white/20 bg-[#D9CCBE]"
                        }`}
                        title={tensionIconOptions[0].label}
                      >
                        <img
                          src={tensionIconOptions[0].src}
                          alt={tensionIconOptions[0].label}
                          className="h-6 w-6 object-contain"
                        />
                      </button>
                      {form.tension1Icon === tensionIconOptions[0].id && (
                        <input
                          type="text"
                          value={form.tension1Text || ""}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              tension1Text: e.target.value,
                            }))
                          }
                          className="min-w-[200px] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-slate-400"
                          placeholder="Texto ao lado do ícone (mordida)"
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isEnemieLayout(form.layout) && (
              <div className="space-y-4 border-t border-white/10 pt-4">
                <h3 className="text-xl font-semibold">Skills por cor</h3>
                <p className="text-sm text-slate-400">
                  Clique no ícone para adicionar à cor. O número digitado abaixo
                  do ícone 06 será exibido na frente dele no card.
                </p>
                <div className="flex flex-wrap gap-4">
                {/* Azul */}
                <div className="flex-1 min-w-[320px] space-y-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                  <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <span
                      className="inline-block w-4 h-4 rounded"
                      style={{ backgroundColor: "#3959A3" }}
                    ></span>
                    Azul
                  </span>
                  <div className="grid grid-cols-6 gap-2">
                    {enemieIconOptions.map((icon) => {
                        const list = form.enemieBlueSkills ?? [];
                        const has06 = hasEnemie06InSkills(
                          enemieIconOptions,
                          list,
                        );
                        const is06 = isIcon06(icon);
                        const isSelected = is06
                          ? list.includes(icon.id) ||
                            list.includes(icon.src ?? "") ||
                            has06
                          : list.includes(icon.id) ||
                            list.includes(icon.src ?? "");
                        const skillId = icon.id;
                        return (
                          <div
                            key={icon.id}
                            className="flex flex-col items-center gap-1"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => {
                                  const list = prev.enemieBlueSkills ?? [];
                                  const has06 = hasEnemie06InSkills(
                                    enemieIconOptions,
                                    list,
                                  );
                                  let next: string[];
                                  if (isIcon06(icon)) {
                                    const has06InList = list.some(
                                      (id) =>
                                        id === icon.id ||
                                        id === icon.src ||
                                        isId06(id),
                                    );
                                    if (has06InList) {
                                      next = list.filter(
                                        (id) =>
                                          id !== icon.id &&
                                          id !== icon.src &&
                                          !isId06(id),
                                      );
                                    } else if (has06) {
                                      next = list;
                                    } else {
                                      next = [...list, icon.id];
                                    }
                                  } else {
                                    const exists = list.some(
                                      (id) =>
                                        id === icon.id || id === icon.src,
                                    );
                                    next = exists
                                      ? list.filter(
                                          (id) =>
                                            id !== icon.id && id !== icon.src,
                                        )
                                      : [...list, icon.id];
                                  }
                                  return { ...prev, enemieBlueSkills: next };
                                })
                              }
                              className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
                                isSelected
                                  ? "border-4 border-amber-400 bg-[#EDE4D7]"
                                  : "border border-white/20 bg-[#D9CCBE]"
                              }`}
                              title={icon.label}
                            >
                              <img
                                src={icon.src}
                                alt={icon.label}
                                className="h-6 w-6 object-contain"
                              />
                            </button>
                            {isSelected && (
                              <input
                                type="text"
                                inputMode="numeric"
                                value={
                                  (form.skillNumbers?.[
                                    `enemie-blue-${is06 && has06 ? "06" : skillId}`
                                  ] ??
                                    (is06 && has06
                                      ? form.enemieBlueExtraNumber
                                      : undefined)) ?? ""
                                }
                                onChange={(e) => {
                                  const key = is06 && has06 ? "06" : skillId;
                                  const val = e.target.value.replace(/\D/g, "");
                                  setForm((prev) => ({
                                    ...prev,
                                    ...(is06 && has06
                                      ? { enemieBlueExtraNumber: val }
                                      : {}),
                                    skillNumbers: {
                                      ...prev.skillNumbers,
                                      [`enemie-blue-${key}`]: val,
                                    },
                                  }));
                                }}
                                className="w-12 rounded border border-white/10 bg-white/5 px-1 py-0.5 text-center text-xs text-white"
                                placeholder="Nº"
                              />
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
                {/* Roxo */}
                <div className="flex-1 min-w-[320px] space-y-2 rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
                  <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <span
                      className="inline-block w-4 h-4 rounded"
                      style={{ backgroundColor: "#532C73" }}
                    ></span>
                    Roxo
                  </span>
                  <div className="grid grid-cols-6 gap-2">
                    {enemieIconOptions.map((icon) => {
                        const list = form.enemiePurpleSkills ?? [];
                        const has06 = hasEnemie06InSkills(
                          enemieIconOptions,
                          list,
                        );
                        const is06 = isIcon06(icon);
                        const isSelected = is06
                          ? list.includes(icon.id) ||
                            list.includes(icon.src ?? "") ||
                            has06
                          : list.includes(icon.id) ||
                            list.includes(icon.src ?? "");
                        const skillId = icon.id;
                        return (
                          <div
                            key={icon.id}
                            className="flex flex-col items-center gap-1"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => {
                                  const list = prev.enemiePurpleSkills ?? [];
                                  const has06 = hasEnemie06InSkills(
                                    enemieIconOptions,
                                    list,
                                  );
                                  let next: string[];
                                  if (isIcon06(icon)) {
                                    const has06InList = list.some(
                                      (id) =>
                                        id === icon.id ||
                                        id === icon.src ||
                                        isId06(id),
                                    );
                                    if (has06InList) {
                                      next = list.filter(
                                        (id) =>
                                          id !== icon.id &&
                                          id !== icon.src &&
                                          !isId06(id),
                                      );
                                    } else if (has06) {
                                      next = list;
                                    } else {
                                      next = [...list, icon.id];
                                    }
                                  } else {
                                    const exists = list.some(
                                      (id) =>
                                        id === icon.id || id === icon.src,
                                    );
                                    next = exists
                                      ? list.filter(
                                          (id) =>
                                            id !== icon.id && id !== icon.src,
                                        )
                                      : [...list, icon.id];
                                  }
                                  return { ...prev, enemiePurpleSkills: next };
                                })
                              }
                              className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
                                isSelected
                                  ? "border-4 border-amber-400 bg-[#EDE4D7]"
                                  : "border border-white/20 bg-[#D9CCBE]"
                              }`}
                              title={icon.label}
                            >
                              <img
                                src={icon.src}
                                alt={icon.label}
                                className="h-6 w-6 object-contain"
                              />
                            </button>
                            {isSelected && (
                              <input
                                type="text"
                                inputMode="numeric"
                                value={
                                  (form.skillNumbers?.[
                                    `enemie-purple-${is06 && has06 ? "06" : skillId}`
                                  ] ??
                                    (is06 && has06
                                      ? form.enemiePurpleExtraNumber
                                      : undefined)) ?? ""
                                }
                                onChange={(e) => {
                                  const key = is06 && has06 ? "06" : skillId;
                                  const val = e.target.value.replace(/\D/g, "");
                                  setForm((prev) => ({
                                    ...prev,
                                    ...(is06 && has06
                                      ? { enemiePurpleExtraNumber: val }
                                      : {}),
                                    skillNumbers: {
                                      ...prev.skillNumbers,
                                      [`enemie-purple-${key}`]: val,
                                    },
                                  }));
                                }}
                                className="w-12 rounded border border-white/10 bg-white/5 px-1 py-0.5 text-center text-xs text-white"
                                placeholder="Nº"
                              />
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
                {/* Amarelo */}
                <div className="flex-1 min-w-[320px] space-y-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                  <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <span
                      className="inline-block w-4 h-4 rounded"
                      style={{ backgroundColor: "#CFC752" }}
                    ></span>
                    Amarelo
                  </span>
                  <div className="grid grid-cols-6 gap-2">
                    {enemieIconOptions.map((icon) => {
                        const list = form.enemieYellowSkills ?? [];
                        const has06 = hasEnemie06InSkills(
                          enemieIconOptions,
                          list,
                        );
                        const is06 = isIcon06(icon);
                        const isSelected = is06
                          ? list.includes(icon.id) ||
                            list.includes(icon.src ?? "") ||
                            has06
                          : list.includes(icon.id) ||
                            list.includes(icon.src ?? "");
                        const skillId = icon.id;
                        return (
                          <div
                            key={icon.id}
                            className="flex flex-col items-center gap-1"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => {
                                  const list = prev.enemieYellowSkills ?? [];
                                  const has06 = hasEnemie06InSkills(
                                    enemieIconOptions,
                                    list,
                                  );
                                  let next: string[];
                                  if (isIcon06(icon)) {
                                    const has06InList = list.some(
                                      (id) =>
                                        id === icon.id ||
                                        id === icon.src ||
                                        isId06(id),
                                    );
                                    if (has06InList) {
                                      next = list.filter(
                                        (id) =>
                                          id !== icon.id &&
                                          id !== icon.src &&
                                          !isId06(id),
                                      );
                                    } else if (has06) {
                                      next = list;
                                    } else {
                                      next = [...list, icon.id];
                                    }
                                  } else {
                                    const exists = list.some(
                                      (id) =>
                                        id === icon.id || id === icon.src,
                                    );
                                    next = exists
                                      ? list.filter(
                                          (id) =>
                                            id !== icon.id && id !== icon.src,
                                        )
                                      : [...list, icon.id];
                                  }
                                  return { ...prev, enemieYellowSkills: next };
                                })
                              }
                              className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
                                isSelected
                                  ? "border-4 border-amber-400 bg-[#EDE4D7]"
                                  : "border border-white/20 bg-[#D9CCBE]"
                              }`}
                              title={icon.label}
                            >
                              <img
                                src={icon.src}
                                alt={icon.label}
                                className="h-6 w-6 object-contain"
                              />
                            </button>
                            {isSelected && (
                              <input
                                type="text"
                                inputMode="numeric"
                                value={
                                  (form.skillNumbers?.[
                                    `enemie-yellow-${is06 && has06 ? "06" : skillId}`
                                  ] ??
                                    (is06 && has06
                                      ? form.enemieYellowExtraNumber
                                      : undefined)) ?? ""
                                }
                                onChange={(e) => {
                                  const key = is06 && has06 ? "06" : skillId;
                                  const val = e.target.value.replace(/\D/g, "");
                                  setForm((prev) => ({
                                    ...prev,
                                    ...(is06 && has06
                                      ? { enemieYellowExtraNumber: val }
                                      : {}),
                                    skillNumbers: {
                                      ...prev.skillNumbers,
                                      [`enemie-yellow-${key}`]: val,
                                    },
                                  }));
                                }}
                                className="w-12 rounded border border-white/10 bg-white/5 px-1 py-0.5 text-center text-xs text-white"
                                placeholder="Nº"
                              />
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleSaveCard()}
                className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 font-semibold text-black shadow-lg shadow-amber-500/40 transition hover:translate-y-0.5 hover:shadow-2xl"
              >
                Salvar card
              </button>
              <button
                type="button"
                onClick={() =>
                  handleDownload(
                    "preview-card",
                    `card-${form.title || "sem-titulo"}.png`,
                  )
                }
                className="rounded-2xl border border-white/30 px-5 py-3 font-semibold text-white transition hover:border-white"
              >
                Baixar visualização
              </button>
            </div>

            {statusMessage && (
              <div className="rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {statusMessage}
              </div>
            )}
          </div>
          <div
            className={`flex flex-col items-center gap-5 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl self-start ${
              isEnemieLayout(form.layout) ? "order-2" : ""
            }`}
          >
            <div className="overflow-x-auto" style={{ width: "100%" }}>
              <CardPreview
                card={previewCard}
                overlayImage={overlayImage}
                htmlId="preview-card"
                iconOptionsA={iconOptionsA}
                skillIconOptions={skillIconOptions}
                enemieIconOptions={enemieIconOptions}
                effect2IconOptions={effect2IconOptions}
                effect3IconOptions={effect3IconOptions}
                effect4IconOptions={effect4IconOptions}
                effectIconOptions04={effectIconOptions04}
                tensionIconOptions={tensionIconOptions}
              />
            </div>
          </div>
        </section>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "-9999px",
            top: "0",
            opacity: 0,
            pointerEvents: "none",
          }}
        >
          {cards.map((card) => (
            <CardPreview
              key={`zip-card-${card.id}`}
              card={card}
              overlayImage={overlayCache[card.id] ?? null}
              htmlId={`zip-card-${card.id}`}
              iconOptionsA={iconOptionsA}
              enemieIconOptions={enemieIconOptions}
              skillIconOptions={skillIconOptions}
              effect2IconOptions={effect2IconOptions}
              effect3IconOptions={effect3IconOptions}
              effect4IconOptions={effect4IconOptions}
              effectIconOptions04={effectIconOptions04}
              showDebugBackground={false}
            />
          ))}
        </div>
      </main>

      {/* Modal de crop - selecionar área da imagem para o card */}
      {imageToCrop && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="crop-modal-title"
        >
          <h2
            id="crop-modal-title"
            className="mb-4 text-xl font-semibold text-white"
          >
            Selecione a área da imagem para o card
          </h2>
          <div className="relative h-[60vh] w-full max-w-2xl rounded-xl overflow-hidden bg-slate-800">
            <Cropper
              image={imageToCrop}
              crop={crop}
              zoom={zoom}
              aspect={cropAspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropAreaChange={(_area, croppedAreaPixels) => {
                setCropCompleteArea(croppedAreaPixels);
              }}
              objectFit="contain"
            />
          </div>
          <div className="mt-4 flex gap-4">
            <button
              type="button"
              onClick={handleCropCancel}
              className="rounded-xl border border-white/30 px-6 py-2 font-semibold text-white transition hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleCropConfirm()}
              disabled={!cropCompleteArea}
              className="rounded-xl bg-amber-500 px-6 py-2 font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
