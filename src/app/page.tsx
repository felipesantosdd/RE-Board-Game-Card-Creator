"use client";

import {
  ChangeEvent,
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toPng } from "html-to-image";
import { Bebas_Neue, EB_Garamond, Cinzel, Crimson_Pro } from "next/font/google";
import JSZip from "jszip";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import Link from "next/link";
import {
  FaArchive,
  FaDownload,
  FaEdit,
  FaFileImport,
  FaQuestionCircle,
  FaSave,
} from "react-icons/fa";
import { mhTutorialLayout, re3TutorialLayout } from "@/data/tutorialLayouts";
import { TUTORIAL_BASE_PATHS } from "@/data/tutorialTypes";
import type {
  TutorialBlock,
  TutorialPage,
  TutorialPageNumber,
} from "@/data/tutorialTypes";
import { normalizeTutorialPage } from "@/data/tutorialTypes";

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
    return id === "06" || (src.includes("06.png") && !src.includes("06-A"));
  });
}

/** True se o id corresponde ao ícone 01.png (Enemies). */
function isId01(id: string): boolean {
  const s = String(id);
  return (
    s === "01" || s === "1" || (id.includes("01.png") && !id.includes("02"))
  );
}

/** True se o id corresponde ao ícone 02.png (Enemies), não 02-A. */
function isId02(id: string): boolean {
  const s = String(id).toLowerCase();
  return (
    s === "02" ||
    s === "2" ||
    (id.includes("02.png") && !id.includes("02-A")) ||
    (id.includes("2.png") && !id.includes("2-a"))
  );
}

/** True se o id corresponde ao ícone 06.png (Enemies), não 06-A. */
function isId06(id: string): boolean {
  const s = String(id).toLowerCase();
  return s === "06" || (s.includes("06") && !s.includes("06-a"));
}

/** True se o ícone (IconOption) é o 01. */
function isIcon01(icon: { id?: string; src?: string }): boolean {
  return (
    String(icon.id) === "01" ||
    String(icon.id) === "1" ||
    (icon.src?.includes("01.png") && !icon.src?.includes("02")) ||
    false
  );
}

/** True se o ícone (IconOption) é o 02 (não exibido no picker, auto-selecionado com 01). */
function isIcon02(icon: { id?: string; src?: string }): boolean {
  return (
    String(icon.id) === "02" ||
    String(icon.id) === "2" ||
    (icon.src?.includes("02.png") && !icon.src?.includes("02-A")) ||
    (icon.src?.includes("2.png") && !icon.src?.includes("2-A")) ||
    false
  );
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

function normalizeIconId(value?: string | null): string {
  if (!value) return "";
  const raw = String(value).trim().toLowerCase();
  if (/^\d+$/.test(raw)) return raw.padStart(2, "0");
  return raw;
}

function isIconAllowed(item: IconOption, allowed: Set<string>): boolean {
  if (allowed.size === 0) return true;
  const id = normalizeIconId(item.id);
  const label = normalizeIconId(item.label);
  return (id && allowed.has(id)) || (label && allowed.has(label));
}

function getLayoutIconSlots(layout: LayoutOption): LayoutIconSlot[] {
  if (layout.icons && layout.icons.length > 0) return layout.icons;
  const slots: LayoutIconSlot[] = [];
  if (layout.positions?.icon) {
    slots.push({
      path: "A",
      label: "Ícone 1",
      allowedIds: layout.allowedMainIconIds ?? [],
      positions: layout.positions.icon,
    });
  }
  if (layout.positions?.icon2) {
    slots.push({
      path: "B",
      label: "Dados",
      allowedIds: layout.allowedSecondaryIconIds ?? [],
      positions: layout.positions.icon2,
    });
  }
  return slots;
}

const DEFAULT_ICON_FALLBACK = "/models/icons/A/01.png";

/** Mapa base de ícones inline (fallback até API carregar). Formato: 00{nome} ex: 0015 para 15.png */
const INLINE_ICON_MAP_BASE: Record<string, string> = {
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
  "0011": "/models/icons/Icons/11.png",
};
const TEXT_HUNTER_ICON_ALIASES: Record<string, string> = {
  IconDragon: "/models/icons/textHunter/dragon.webp",
  IconFire: "/models/icons/textHunter/fire.webp",
  IconIce: "/models/icons/textHunter/ice.webp",
  IconThunder: "/models/icons/textHunter/thunder.webp",
  IconWater: "/models/icons/textHunter/water.webp",
};
const buildTextHunterAliases = (base: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(base).flatMap(([key, value]) => [
      [key, value],
      [key.toLowerCase(), value],
    ]),
  );
const TEXT_HUNTER_ICON_MAP = buildTextHunterAliases(TEXT_HUNTER_ICON_ALIASES);
/** Ícone 00.png com número sobreposto. Código: 000-{número} */
const INLINE_ICON_00 = "/models/icons/Icons/00.png";

/** Renderiza texto com **texto** em negrito e ícones inline. */
function renderTextWithBoldAndIcons(
  text: string,
  iconSizePx: number = 38,
  iconMap: Record<string, string> = INLINE_ICON_MAP_BASE,
): ReactNode {
  if (!text) return text;
  const parts = text.split(/\*\*([\s\S]*?)\*\*/g);
  const result: ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const segment = parts[i];
    const content = renderTextWithInlineIcons(segment, iconSizePx, iconMap);
    result.push(
      i % 2 === 1 ? (
        <span key={`b-${i}`} style={{ fontWeight: 700 }}>
          {content}
        </span>
      ) : (
        <Fragment key={`n-${i}`}>{content}</Fragment>
      ),
    );
  }
  if (result.length === 1 && typeof result[0] !== "object") return result[0];
  return <>{result}</>;
}

function renderTextWithInlineIcons(
  text: string,
  iconSizePx: number = 38,
  iconMap: Record<string, string> = INLINE_ICON_MAP_BASE,
): ReactNode {
  if (!text) return text;
  const codes = Object.keys(iconMap).sort(
    (a, b) => b.length - a.length || b.localeCompare(a),
  );
  const pattern = codes.length
    ? new RegExp(
        `(000-\\d+|${codes
          .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|")})`,
        "g",
      )
    : /(000-\d+)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const matched = match[1];
    if (matched.startsWith("000-")) {
      const number = matched.slice(4);
      parts.push(
        <span
          key={`icon-00-${key++}`}
          className="inline-block relative"
          style={{
            width: iconSizePx,
            height: iconSizePx,
            verticalAlign: "text-bottom",
            marginBottom: 2,
          }}
        >
          <img
            src={INLINE_ICON_00}
            alt=""
            className="block w-full h-full object-contain"
            style={{ filter: ICON_OUTLINE_FILTER }}
          />
          <span
            className="absolute inset-0 flex items-center justify-center text-white font-bold"
            style={{
              fontFamily: bebasNeue.style.fontFamily,
              fontSize: Math.round(iconSizePx * 0.55),
            }}
          >
            {number}
          </span>
        </span>,
      );
    } else {
      const src = iconMap[matched];
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
              filter: ICON_OUTLINE_FILTER,
            }}
          />,
        );
      } else {
        parts.push(matched);
      }
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

function hasInlineIconCodes(
  text: string,
  iconMap: Record<string, string>,
): boolean {
  if (!text) return false;
  const codes = Object.keys(iconMap);
  if (codes.length === 0) return false;
  const pattern = new RegExp(
    `(000-\\d+|${codes
      .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|")})`,
    "g",
  );
  return pattern.test(text);
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
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "700"],
});
const crimsonPro = Crimson_Pro({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
});
/** Fonte do tutorial Monster Hunter (carregada via link em layout.tsx) */
const TUTORIAL_MH_FONT_FAMILY = "'IM Fell English', serif";
/** Fonte e cor do tutorial Resident Evil */
const TUTORIAL_RE3_FONT_FAMILY = "var(--font-roboto), 'Roboto', sans-serif";
const TUTORIAL_RE3_COLOR = "#4B4B4B";

type LayoutPositions = {
  icon: { top: string; left: string; width?: string; height?: string };
  icon1BeforeTitle?: {
    top: string;
    left: string;
    width?: string;
    height?: string;
    /** Tamanho do ícone (img) dentro da div - se não definido, preenche a div */
    iconWidth?: string;
    iconHeight?: string;
  };
  icon2?: {
    top: string;
    left: string;
    width?: string;
    height?: string;
    /** Tamanho do ícone (img) dentro da div - se não definido, preenche a div */
    iconWidth?: string;
    iconHeight?: string;
  };
  title: {
    top: string;
    left: string;
    width: string;
    height: string;
    fontSize: string;
    boxShadow?: boolean;
    label?: string;
    /** Fonte quando o título quebra em 2 linhas */
    fontSizeLine2?: string;
    /** Fonte quando o título quebra em 3+ linhas */
    fontSizeLine3?: string;
    widthtWith1Icon?: string;
    /** Largura quando só icon1 está selecionado (título à direita do icon1) */
    widthtWithOnlyIcon1?: string;
    widthtWith2Icons?: string;
    titleLeftWith1Icon?: string;
    /** Tamanho fixo do bg nas 3 divs (título, icon1, icon2) - mesmo em todas, sem esticar */
    titleBgSize?: string;
    /** Espaçamento entre linhas do título */
    lineHeight?: number | string;
  };
  description: {
    top: string;
    left: string;
    width?: string;
    height?: string;
    fontSize?: string;
    lineHeight?: number | string;
    lineWidth?: string;
    paddingTop?: string;
    boxShadow?: boolean;
    label?: string;
  };
  description1?: {
    top: string;
    left: string;
    width?: string;
    height?: string;
    fontSize?: string;
    lineHeight?: number | string;
    lineWidth?: string;
    paddingTop?: string;
    boxShadow?: boolean;
    label?: string;
  };
  description2?: {
    top: string;
    left: string;
    width?: string;
    height?: string;
    fontSize?: string;
    lineHeight?: number | string;
    lineWidth?: string;
    boxShadow?: boolean;
    label?: string;
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
  effect1?: { top: string; left: string; width?: string; height?: string };
  effect2?: { top: string; left: string; width?: string; height?: string };
  effect3?: { top: string; left: string; width?: string; height?: string };
  effect4?: { top: string; left: string; width?: string; height?: string };
  /** Layout 3: linha acima dos effects (para ícones fixos) */
  effect1a?: { top: string; left: string; width?: string; height?: string };
  effect2a?: { top: string; left: string; width?: string; height?: string };
  effect3a?: { top: string; left: string; width?: string; height?: string };
  effect4a?: { top: string; left: string; width?: string; height?: string };
  /** Posição do número sobre cada ícone (relativo ao bloco do ícone). Ajuste top/left aqui. */
  effect2NumberPosition?: { top: string; left: string };
  effect3NumberPosition?: { top: string; left: string };
  effect4NumberPosition?: { top: string; left: string };
  /** Effects/03: posição do número por ícone (03, 04, 06, 07) - permite ajuste individual */
  effect3NumberPositionByIcon?: Record<string, { top: string; left: string }>;
  /** Effects/03 (efeito primário): posição por ícone - central (01,02), dupla (03,04), dupla-cópia (06,07) */
  effect4NumberPositionByIcon?: Record<string, { top: string; left: string }>;
  /** Layout Heroes: posições dos ícones Roll e Bag (heroes/fixed) */
  heroRollPosition?: {
    top: string;
    left: string;
    width?: string;
    height?: string;
    /** Offset do número em relação ao centro (ex: "-10px" para subir) */
    numberOffsetX?: string;
    numberOffsetY?: string;
  };
  heroBagPosition?: {
    top: string;
    left: string;
    width?: string;
    height?: string;
    /** Offset do número em relação ao centro (ex: "-10px" para esquerda) */
    numberOffsetX?: string;
    numberOffsetY?: string;
  };
  /** Layout Heroes: posições das 3 imagens de skill (substituem ícones por cor) */
  heroSkillImage1Position?: {
    top: string;
    left: string;
    width: string;
    height: string;
  };
  heroSkillImage2Position?: {
    top: string;
    left: string;
    width: string;
    height: string;
  };
  heroSkillImage3Position?: {
    top: string;
    left: string;
    width: string;
    height: string;
  };
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
  /** Layout Enemie: ícone principal do card (pasta Enemies/Icons) */
  enemieIcon?: {
    top: string;
    left: string;
    width: string;
    height: string;
  };
  /** Layout equip3-equip: box de skills dentro da descrição (posição absoluta) */
  descriptionSkillsBox?: {
    top?: string;
    left?: string;
    bottom?: string;
    width?: string;
    height?: string;
    minHeight?: string;
    borderRadius?: string;
    boxShadow?: string;
    backgroundColor?: string;
  };
  /** Layout equip4: 3 divs na base do card (verde, amarelo, azul) */
  bottomBar1?: {
    top: string;
    left: string;
    width: string;
    height: string;
    borderRadius?: string;
  };
  bottomBar2?: {
    top: string;
    left: string;
    width: string;
    height: string;
    borderRadius?: string;
  };
  bottomBar3?: {
    top: string;
    left: string;
    width: string;
    height: string;
    borderRadius?: string;
  };
};

type LayoutIconSlot = {
  path: string;
  label: string;
  allowedIds?: string[];
  boxShadow?: boolean;
  positions: {
    top: string;
    left: string;
    width?: string;
    height?: string;
    iconWidth?: string;
    iconHeight?: string;
  };
};

type LayoutSkillsConfig = {
  path: string;
  label?: string;
  allowedIds?: string[];
};

type LayoutOption = {
  id: string;
  label: string;
  image: string;
  positions: LayoutPositions;
  icons?: LayoutIconSlot[];
  skillsConfig?: LayoutSkillsConfig;
  /** Categoria/aba do layout (ex: resident, monster) */
  categoryId?: string;
  /** Rótulo exibido na aba (ex: Resident Evil) */
  categoryLabel?: string;
  /** Imagem de fundo do verso; quando null → layout full bleed (sem borda base) */
  backImage?: string | null;
  /** IDs de ícones permitidos no slot principal deste layout (opcional) */
  allowedMainIconIds?: string[];
  /** IDs de ícones permitidos no slot secundário (icon2) deste layout (opcional) */
  allowedSecondaryIconIds?: string[];
};

/** Fonte unificada de todos os títulos dos cards; redução por quebra de linha aplicada no CardPreview. */
const UNIFIED_TITLE_FONT_SIZE = "clamp(5rem, 4vw, 4rem)";
/** Fonte do título quando quebra em 2 linhas (~82% da base). */
const UNIFIED_TITLE_FONT_SIZE_LINE2 = "clamp(4.1rem, 3.2vw, 3.2rem)";
/** Fonte do título quando quebra em 3+ linhas (~64% da base). */
const UNIFIED_TITLE_FONT_SIZE_LINE3 = "clamp(3.2rem, 2.5vw, 2.5rem)";
/** Fonte padrão da descrição dos cards. */
const UNIFIED_DESCRIPTION_FONT_SIZE = "clamp(1.5rem, 2vw, 1.75rem)";
/** Espaçamento entre linhas do título (distância de uma linha para outra). */
const UNIFIED_TITLE_LINE_HEIGHT = 0.9;
/** Espaçamento entre linhas da descrição. */
const UNIFIED_DESCRIPTION_LINE_HEIGHT = 1.1;

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
        fontSizeLine2:
          layout.positions.title.fontSizeLine2 ===
          "__UNIFIED_TITLE_FONT_SIZE_LINE2__"
            ? UNIFIED_TITLE_FONT_SIZE_LINE2
            : layout.positions.title.fontSizeLine2,
        fontSizeLine3:
          layout.positions.title.fontSizeLine3 ===
          "__UNIFIED_TITLE_FONT_SIZE_LINE3__"
            ? UNIFIED_TITLE_FONT_SIZE_LINE3
            : layout.positions.title.fontSizeLine3,
        lineHeight:
          layout.positions.title.lineHeight === "__UNIFIED_TITLE_LINE_HEIGHT__"
            ? UNIFIED_TITLE_LINE_HEIGHT
            : (layout.positions.title.lineHeight ?? UNIFIED_TITLE_LINE_HEIGHT),
      },
      description: layout.positions.description
        ? {
            ...layout.positions.description,
            fontSize:
              layout.positions.description.fontSize ===
              "__UNIFIED_DESCRIPTION_FONT_SIZE__"
                ? UNIFIED_DESCRIPTION_FONT_SIZE
                : (layout.positions.description.fontSize ??
                  UNIFIED_DESCRIPTION_FONT_SIZE),
            lineHeight:
              layout.positions.description.lineHeight ===
              "__UNIFIED_DESCRIPTION_LINE_HEIGHT__"
                ? UNIFIED_DESCRIPTION_LINE_HEIGHT
                : (layout.positions.description.lineHeight ??
                  UNIFIED_DESCRIPTION_LINE_HEIGHT),
          }
        : layout.positions.description,
      description1: layout.positions.description1
        ? {
            ...layout.positions.description1,
            fontSize:
              layout.positions.description1.fontSize ===
              "__UNIFIED_DESCRIPTION_FONT_SIZE__"
                ? UNIFIED_DESCRIPTION_FONT_SIZE
                : (layout.positions.description1.fontSize ??
                  UNIFIED_DESCRIPTION_FONT_SIZE),
            lineHeight:
              layout.positions.description1.lineHeight ===
              "__UNIFIED_DESCRIPTION_LINE_HEIGHT__"
                ? UNIFIED_DESCRIPTION_LINE_HEIGHT
                : (layout.positions.description1.lineHeight ??
                  UNIFIED_DESCRIPTION_LINE_HEIGHT),
          }
        : layout.positions.description1,
    },
  }),
);

/** Mapa de categorias de layout (abas dinâmicas) derivadas do JSON */
const layoutCategoriesMap: Record<
  string,
  {
    id: string;
    label: string;
  }
> = {};

for (const layout of layoutOptions) {
  const id = layout.categoryId ?? "resident";
  if (!layoutCategoriesMap[id]) {
    layoutCategoriesMap[id] = {
      id,
      label:
        layout.categoryLabel ??
        (id === "monster" ? "Monster Hunter" : "Resident Evil"),
    };
  }
}

const layoutCategories = Object.values(layoutCategoriesMap);

/** Layouts BG: só base + imagem do layout, sem ícones nem conteúdo (Back-S, Deck-A, Deck-B, Deck-C, Deck-D) */
const BG_LAYOUT_IDS = [
  "bg",
  "bg-deck-a",
  "bg-deck-b",
  "bg-deck-c",
  "bg-deck-d",
];
const isBgLayout = (layoutId: string) => BG_LAYOUT_IDS.includes(layoutId);

/** Layouts que usam efeitos (equip3, equip3-equip): linha de tiro, blocos de efeito, skills Effects/04 */
const EQUIP_LAYOUTS_WITH_EFFECTS = ["equip3", "equip3-equip"];
/** Layout equip3-equip: estrutura diferente (efeitos no topo, título+ícone no final) */
const isEquip3EquipLayout = (layoutId: string) => layoutId === "equip3-equip";
/** Ícone fixo na descriptionSkillsBox do equip3-equip */
const EQUIP3_EQUIP_FIXED_ICON = "/models/icons/Effects/04/02.png";
/** IDs dos ícones selecionáveis na descriptionSkillsBox (04, 07, 08) */
const EQUIP3_EQUIP_SELECTABLE_SKILL_IDS = ["04", "07", "08"];
/** Effects/03: ícones que usam posição do número igual ao 03 (top: 5px, left: 39px) */
const EFFECT3_ICONS_SAME_POS_AS_03 = ["03", "04", "06", "07"];
/** Effects/03 (efeito primário): 3 posições - central (01,02), dupla (03,04), dupla-cópia (06,07) */
const EFFECT4_ICONS_CENTRAL = ["01", "02"];
const EFFECT4_ICONS_DUPLA = ["03", "04"];
const EFFECT4_ICONS_DUPLA_COPY = ["06", "07"];
const isEquipWithEffectsLayout = (layoutId: string) =>
  EQUIP_LAYOUTS_WITH_EFFECTS.includes(layoutId);

/** Posições dos ícones do layout equip2 (usadas também no equip3 para icon1 e icon2) */
const EQUIP2_LAYOUT_POSITIONS = {
  icon: {
    top: "195px",
    left: "40px",
    width: "128px",
    height: "128px",
  },
  icon2: {
    top: "-165px",
    left: "460px",
    width: "128px",
    height: "128px",
  },
};

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

/** Layout Enemie/Heroes: card horizontal */
const isEnemieLayout = (layoutId: string) =>
  layoutId === "enemie" || layoutId === "enemie2" || layoutId === "heroes";
/** Layout Enemie/Heroes: tem campo de ícone principal e skills por cor. */
const hasEnemieIconLayout = (layoutId: string) =>
  layoutId === "enemie" || layoutId === "heroes";
/** Layout Heroes: ícones fixos Roll e Bag (heroes/fixed) */
const HERO_ROLL_ICON = "/models/icons/Heroes/Fixed/01.png";
const HERO_BAG_ICON = "/models/icons/Heroes/Fixed/02.png";

const mergeLayoutPositions = (
  candidate: Partial<LayoutPositions>,
  fallback: LayoutPositions,
): LayoutPositions => ({
  icon: candidate.icon ?? fallback.icon,
  icon1BeforeTitle: candidate.icon1BeforeTitle ?? fallback.icon1BeforeTitle,
  icon2: candidate.icon2 ?? fallback.icon2,
  title: candidate.title ?? fallback.title,
  description: candidate.description
    ? {
        ...fallback.description,
        ...candidate.description,
      }
    : fallback.description,
  description1: candidate.description1
    ? {
        ...fallback.description,
        ...candidate.description1,
      }
    : (fallback.description1 ?? fallback.description),
  description2: candidate.description2
    ? {
        ...(fallback.description2 ?? {}),
        ...candidate.description2,
      }
    : fallback.description2,
  overlay: candidate.overlay ?? fallback.overlay,
  skills: candidate.skills ?? fallback.skills,
  effect1: candidate.effect1 ?? fallback.effect1,
  effect2: candidate.effect2 ?? fallback.effect2,
  effect3: candidate.effect3 ?? fallback.effect3,
  effect4: candidate.effect4 ?? fallback.effect4,
  effect1a: candidate.effect1a ?? fallback.effect1a,
  effect2a: candidate.effect2a ?? fallback.effect2a,
  effect3a: candidate.effect3a ?? fallback.effect3a,
  effect4a: candidate.effect4a ?? fallback.effect4a,
  effect2NumberPosition:
    candidate.effect2NumberPosition ?? fallback.effect2NumberPosition,
  effect3NumberPosition:
    candidate.effect3NumberPosition ?? fallback.effect3NumberPosition,
  effect4NumberPosition:
    candidate.effect4NumberPosition ?? fallback.effect4NumberPosition,
  effect3NumberPositionByIcon:
    candidate.effect3NumberPositionByIcon ??
    fallback.effect3NumberPositionByIcon,
  effect4NumberPositionByIcon:
    candidate.effect4NumberPositionByIcon ??
    fallback.effect4NumberPositionByIcon,
  heroRollPosition: candidate.heroRollPosition ?? fallback.heroRollPosition,
  heroBagPosition: candidate.heroBagPosition ?? fallback.heroBagPosition,
  heroSkillImage1Position:
    candidate.heroSkillImage1Position ?? fallback.heroSkillImage1Position,
  heroSkillImage2Position:
    candidate.heroSkillImage2Position ?? fallback.heroSkillImage2Position,
  heroSkillImage3Position:
    candidate.heroSkillImage3Position ?? fallback.heroSkillImage3Position,
  enemieRedNumberPosition:
    candidate.enemieRedNumberPosition ?? fallback.enemieRedNumberPosition,
  enemieGreenNumberPosition:
    candidate.enemieGreenNumberPosition ?? fallback.enemieGreenNumberPosition,
  enemieBlueNumberPosition:
    candidate.enemieBlueNumberPosition ?? fallback.enemieBlueNumberPosition,
  enemieIcon: candidate.enemieIcon ?? fallback.enemieIcon,
  descriptionSkillsBox:
    candidate.descriptionSkillsBox ?? fallback.descriptionSkillsBox,
  bottomBar1: candidate.bottomBar1 ?? fallback.bottomBar1,
  bottomBar2: candidate.bottomBar2 ?? fallback.bottomBar2,
  bottomBar3: candidate.bottomBar3 ?? fallback.bottomBar3,
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
const ICON_DROP_SHADOW = "inset 0 0 14px 10px rgba(0,0,0,0.35)";
const ICON_OUTLINE_FILTER = "drop-shadow(0 0 2px rgba(0,0,0,0.7))";
const CARD_TYPE_LABEL = "EQUIP";
import {
  openAppDb,
  CARDS_STORE_NAME,
  DECKS_STORE_NAME,
  OVERLAY_STORE_NAME,
  getTutorialPagesFromDb,
  saveTutorialPagesToDb,
} from "@/lib/appDb";

const saveOverlayImage = async (key: string, dataUrl: string) => {
  const db = await openAppDb();
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
  const db = await openAppDb();
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
  const db = await openAppDb();
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

const saveCardsToDb = async (cards: CardDesign[]) => {
  const db = await openAppDb();
  if (!db) return;
  return new Promise<void>((resolve) => {
    const tx = db.transaction(CARDS_STORE_NAME, "readwrite");
    const store = tx.objectStore(CARDS_STORE_NAME);
    store.put(cards, "cards");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      console.error("Erro ao salvar cards no IndexedDB.", tx.error);
      db.close();
      resolve();
    };
  });
};

const getCardsFromDb = async (): Promise<CardDesign[] | null> => {
  const db = await openAppDb();
  if (!db) return null;
  return new Promise<CardDesign[] | null>((resolve) => {
    const tx = db.transaction(CARDS_STORE_NAME, "readonly");
    const store = tx.objectStore(CARDS_STORE_NAME);
    const request = store.get("cards");
    request.onsuccess = () => {
      db.close();
      resolve((request.result as CardDesign[] | undefined) ?? null);
    };
    request.onerror = () => {
      console.error("Erro ao ler cards do IndexedDB.", request.error);
      db.close();
      resolve(null);
    };
  });
};

const saveDecksToDb = async (
  decks: Array<{ id: string; name: string; cards: CardDesign[] }>,
) => {
  const db = await openAppDb();
  if (!db) return;
  return new Promise<void>((resolve) => {
    const tx = db.transaction(DECKS_STORE_NAME, "readwrite");
    const store = tx.objectStore(DECKS_STORE_NAME);
    store.put(decks, "decks");
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      console.error("Erro ao salvar decks no IndexedDB.", tx.error);
      db.close();
      resolve();
    };
  });
};

const getDecksFromDb = async (): Promise<Array<{
  id: string;
  name: string;
  cards: CardDesign[];
}> | null> => {
  const db = await openAppDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(DECKS_STORE_NAME, "readonly");
    const store = tx.objectStore(DECKS_STORE_NAME);
    const request = store.get("decks");
    request.onsuccess = () => {
      db.close();
      resolve(request.result ?? null);
    };
    request.onerror = () => {
      console.error("Erro ao ler decks do IndexedDB.", request.error);
      db.close();
      resolve(null);
    };
  });
};

const clearOverlayStore = async () => {
  const db = await openAppDb();
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

/** Formata descrição: capitalizeLongWords + primeiro parágrafo em negrito (**) */
const formatDescription = (text: string): string => {
  const capped = capitalizeLongWords(text);
  const paras = capped.split(/\n\n+/);
  if (paras[0]?.trim()) {
    let content = paras[0].trim();
    // Remove ** já existentes (início e fim independentes) para evitar empilhar
    while (content.startsWith("**") && content.length > 2) {
      content = content.slice(2);
    }
    while (content.endsWith("**") && content.length > 2) {
      content = content.slice(0, -2);
    }
    paras[0] = "**" + content + "**";
  }
  return paras.join("\n\n");
};

const getLayoutConfig = (layoutId: string) =>
  layoutOptions.find((option) => option.id === layoutId) ?? DEFAULT_LAYOUT;

const LOCAL_STORAGE_KEY = "re-card-creator-cards";

type FormState = {
  title: string;
  description: string;
  description2: string;
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
  /** Layout equip4: cor de tensão (#067427, #B26E29, #A63E26) */
  tensionColor: string;
  /** Layout equip4: cor das 3 divs de baixo (#39558E, #C7C554, #512D71) */
  bottomBarColor: string;
  /** Título: 1= fonte maior, 2= média, 3= menor (controlado pelo botão Linhas) */
  titleLines?: 1 | 2 | 3;
  /** Layout Heroes: números Roll e Bag sobre os ícones em heroes/fixed */
  heroRollNumber: string;
  heroBagNumber: string;
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

const createInitialFormState = (layoutId?: string): FormState => {
  const layout = layoutId
    ? (layoutOptions.find((o) => o.id === layoutId) ?? DEFAULT_LAYOUT)
    : DEFAULT_LAYOUT;
  return {
    title: layout.id === "equip4" ? "TUDO LIMPO" : "",
    description: "",
    description2: "",
    layout: layout.id,
    image: layout.image,
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
    tensionColor: "#067427",
    bottomBarColor: "#39558E",
    titleLines: 1,
    heroRollNumber: "0",
    heroBagNumber: "0",
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
  };
};

/** Para equip4: novo card preservando ícones e cores, resetando título, descrição e textos de tensão */
const createEquip4FormStateWithPreservedConfig = (
  card: CardDesign,
): FormState => {
  const base = createInitialFormState(card.layoutId);
  return {
    ...base,
    title: "TUDO LIMPO",
    description: "",
    icon: card.icon ?? "",
    icon2: card.icon2 ?? "",
    icon2Id: card.icon2Id ?? "",
    tension1Icon: card.tension1Icon ?? "",
    tension1Text: "",
    tension2Icon: card.tension2Icon ?? "",
    tension2Text: "",
    tensionColor: card.tensionColor ?? base.tensionColor,
    bottomBarColor: card.bottomBarColor ?? base.bottomBarColor,
    titleLines: 1,
  };
};

type CardDesign = {
  id: string;
  title: string;
  description: string;
  description2: string;
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
  tensionColor: string;
  bottomBarColor: string;
  titleLines?: 1 | 2 | 3;
  heroRollNumber: string;
  heroBagNumber: string;
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
  /** Layout Heroes: imagens das 3 áreas de skill (substituem ícones por cor) */
  heroSkillImage1?: string | null;
  heroSkillImage2?: string | null;
  heroSkillImage3?: string | null;
  htmlId: string;
  iconOptionsA?: IconOption[];
  skillIconOptions?: IconOption[];
  effect2IconOptions?: IconOption[];
  effect3IconOptions?: IconOption[];
  effect4IconOptions?: IconOption[];
  effectIconOptions04?: IconOption[];
  tensionIconOptions?: IconOption[];
  enemieIconOptions?: IconOption[];
  heroIconOptions?: IconOption[];
  /** Mapa de códigos 00{nome} para ícones inline (ex: 0015 → 15.png) */
  inlineIconMap?: Record<string, string>;
  showDebugBackground?: boolean;
  /** Quando true, a área de overlay não é exibida (para miniaturas de layout) */
  isLayoutPreview?: boolean;
};

const BG_LAYOUT_IMAGE = "/models/cards/Back-S.png";

const CardPreview = ({
  card,
  overlayImage,
  heroSkillImage1,
  heroSkillImage2,
  heroSkillImage3,
  htmlId,
  iconOptionsA = [],
  skillIconOptions = [],
  effect2IconOptions = [],
  effect3IconOptions = [],
  effect4IconOptions = [],
  effectIconOptions04 = [],
  tensionIconOptions = [],
  enemieIconOptions = [],
  heroIconOptions = [],
  inlineIconMap = INLINE_ICON_MAP_BASE,
  showDebugBackground = true,
  isLayoutPreview = false,
}: CardPreviewProps) => {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const heroImage = (() => {
    if (isBgLayout(card.layoutId)) return card.image || BG_LAYOUT_IMAGE;
    if (card.layoutId === "equip4" && card.tensionColor === "#A63E26")
      return "/models/cards/bg_com_sangue.png";
    return card.image || CARD_TEMPLATE_IMAGE;
  })();
  const layoutPositions = card.layoutPositions || DEFAULT_LAYOUT.positions;

  const titleFontFromLayout =
    layoutPositions.title?.fontSize ?? UNIFIED_TITLE_FONT_SIZE;
  const effectiveTitleWidth = (() => {
    const t = layoutPositions.title;
    if (!t.widthtWith1Icon && !t.widthtWith2Icons && !t.widthtWithOnlyIcon1)
      return t.width;
    const hasIcon1 = Boolean(card.icon);
    const hasIcon2 = Boolean(card.icon2);
    const iconCount = (hasIcon1 ? 1 : 0) + (hasIcon2 ? 1 : 0);
    if (iconCount >= 2 && t.widthtWith2Icons) return t.widthtWith2Icons;
    if (iconCount === 1) {
      if (hasIcon1 && !hasIcon2 && t.widthtWithOnlyIcon1)
        return t.widthtWithOnlyIcon1;
      if (t.widthtWith1Icon) return t.widthtWith1Icon;
    }
    return t.width;
  })();
  const effectiveTitleLeft =
    card.icon &&
    layoutPositions.icon1BeforeTitle &&
    layoutPositions.title.titleLeftWith1Icon
      ? layoutPositions.title.titleLeftWith1Icon
      : layoutPositions.title.left;
  const titleLinesVal = (card.titleLines ?? 1) as 1 | 2 | 3;
  const effectiveTitleFontSize =
    titleLinesVal === 1
      ? titleFontFromLayout
      : titleLinesVal === 2
        ? (layoutPositions.title?.fontSizeLine2 ?? titleFontFromLayout)
        : (layoutPositions.title?.fontSizeLine3 ??
          layoutPositions.title?.fontSizeLine2 ??
          titleFontFromLayout);

  const isEnemie = isEnemieLayout(card.layoutId);
  const effectiveIconOptions =
    card.layoutId === "heroes" ? heroIconOptions : enemieIconOptions;
  /** Resolve ícone de inimigo/heroi (skills por cor) a partir de effectiveIconOptions. */
  const findEnemieIconForSkill = (skillId: string) =>
    effectiveIconOptions.find(
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
  const HERO_01_ICON = "/models/icons/Heroes/01.png";
  const ICON_01 =
    findEnemieIconForSkill("01")?.src ??
    (card.layoutId === "heroes" ? HERO_01_ICON : ENEMIE_01_ICON);
  const ICON_02 =
    findEnemieIconForSkill("02")?.src ??
    (card.layoutId === "heroes"
      ? "/models/icons/Heroes/02.png"
      : ENEMIE_02_ICON);
  const ICON_06 =
    findEnemieIconForSkill("06")?.src ??
    (card.layoutId === "heroes"
      ? "/models/icons/Heroes/06.png"
      : ENEMIE_06_ICON);
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

  const layoutConfig = getLayoutConfig(card.layoutId);
  const isFullBleedLayout = layoutConfig.backImage === null;
  const isMhLayout = card.layoutId.startsWith("mh");
  const descriptionPositions =
    layoutPositions.description1 ?? layoutPositions.description;
  const hasInlineIconsDesc = hasInlineIconCodes(
    card.description || "",
    inlineIconMap,
  );
  const hasInlineIconsDesc2 = hasInlineIconCodes(
    card.description2 || "",
    inlineIconMap,
  );
  const layoutIconSlots = getLayoutIconSlots(layoutConfig);
  const icon1BoxShadow = layoutIconSlots[0]?.boxShadow ? ICON_DROP_SHADOW : "";
  const icon2BoxShadow = layoutIconSlots[1]?.boxShadow ? ICON_DROP_SHADOW : "";
  const icon1Pos = isEquipWithEffectsLayout(card.layoutId)
    ? EQUIP2_LAYOUT_POSITIONS.icon
    : (layoutIconSlots[0]?.positions ?? layoutPositions.icon);
  const icon2Pos = isEquipWithEffectsLayout(card.layoutId)
    ? EQUIP2_LAYOUT_POSITIONS.icon2
    : (layoutIconSlots[1]?.positions ?? layoutPositions.icon2);

  const innerCardStyle: React.CSSProperties = {
    position: "absolute",
    left: isFullBleedLayout ? 0 : `${cardInnerOffset.left}px`,
    top: isFullBleedLayout ? 0 : `${cardInnerOffset.top}px`,
    width: isFullBleedLayout
      ? cardOuterDimensions.width
      : cardInnerDimensions.width,
    height: isFullBleedLayout
      ? cardOuterDimensions.height
      : cardInnerDimensions.height,
    backgroundImage: `url("${heroImage}")`,
    backgroundSize: "100% 100%",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    fontFamily: bebasNeue.style.fontFamily,
    ...((isBgLayout(card.layoutId) || !isEnemieLayout(card.layoutId)) && {
      borderRadius: 16,
    }),
  };

  return (
    <div
      id={htmlId}
      className="relative overflow-hidden rounded-3xl transition"
      style={{
        width: cardOuterDimensions.width,
        height: cardOuterDimensions.height,
        backgroundImage: isFullBleedLayout ? "none" : `url("${BASE_IMAGE}")`,
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="relative overflow-hidden" style={innerCardStyle}>
        {card.layoutId === "equip4" && card.tensionColor === "#A63E26" && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: "rgba(166, 62, 38, 0.25)",
              mixBlendMode: "multiply",
              borderRadius: 16,
            }}
          />
        )}
        {card.layoutId === "heroes" &&
          layoutPositions.heroRollPosition &&
          layoutPositions.heroBagPosition && (
            <>
              <div
                className="absolute flex flex-col items-center justify-center z-20"
                style={{
                  top: layoutPositions.heroRollPosition.top,
                  left: layoutPositions.heroRollPosition.left,
                  width: layoutPositions.heroRollPosition.width ?? "80px",
                  height: layoutPositions.heroRollPosition.height ?? "60px",
                }}
              >
                <img
                  src={HERO_ROLL_ICON}
                  alt=""
                  className="object-contain w-full h-full"
                />
                {(card.heroRollNumber || card.heroRollNumber === "0") && (
                  <div
                    className="absolute inset-0 flex items-center justify-center font-bold drop-shadow-lg text-center"
                    style={{
                      fontSize: "45px",
                      color: "#1F1612",
                      fontFamily: bebasNeue.style.fontFamily,
                      transform: `translate(${
                        layoutPositions.heroRollPosition?.numberOffsetX ?? "0"
                      }, ${layoutPositions.heroRollPosition?.numberOffsetY ?? "0"})`,
                    }}
                  >
                    {card.heroRollNumber}
                  </div>
                )}
              </div>
              <div
                className="absolute flex flex-col items-center justify-center z-20"
                style={{
                  top: layoutPositions.heroBagPosition.top,
                  left: layoutPositions.heroBagPosition.left,
                  width: layoutPositions.heroBagPosition.width ?? "80px",
                  height: layoutPositions.heroBagPosition.height ?? "60px",
                }}
              >
                <img
                  src={HERO_BAG_ICON}
                  alt=""
                  className="object-contain w-full h-full"
                />
                {(card.heroBagNumber || card.heroBagNumber === "0") && (
                  <div
                    className="absolute inset-0 flex items-center justify-center font-bold drop-shadow-lg text-center"
                    style={{
                      fontSize: "45px",
                      color: "#1F1612",
                      fontFamily: bebasNeue.style.fontFamily,
                      transform: `translate(${
                        layoutPositions.heroBagPosition?.numberOffsetX ?? "0"
                      }, ${layoutPositions.heroBagPosition?.numberOffsetY ?? "0"})`,
                    }}
                  >
                    {card.heroBagNumber}
                  </div>
                )}
              </div>
            </>
          )}
        {card.layoutId === "enemie" && (
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
          (overlayImage || isLayoutPreview || card.layoutId === "heroes") && (
            <div
              className="absolute flex items-center justify-center overflow-hidden"
              style={{
                top: layoutPositions.overlay.top,
                left: layoutPositions.overlay.left,
                width: layoutPositions.overlay.width,
                height: layoutPositions.overlay.height,
                ...(isEnemie && { borderRadius: "12px" }),
                ...(!isEnemieLayout(card.layoutId) && { borderRadius: "15px" }),
              }}
            >
              {overlayImage && !isLayoutPreview && (
                <img
                  src={overlayImage}
                  alt="Arte personalizada do card"
                  className={`h-full w-full object-center ${
                    isEnemie ? "object-cover" : "object-contain"
                  }`}
                />
              )}
              {/* Overlay com box shadow por cima da arte */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  ...(isEnemie && {
                    borderRadius: "12px",
                    boxShadow: "inset 0 0 10px 4px rgba(0, 0, 0, 0.65)",
                  }),
                  ...(!isEnemieLayout(card.layoutId) && {
                    borderRadius: "15px",
                    boxShadow:
                      "inset 0 0 8px 2px rgba(0, 0, 0, 0.5), inset 2px -2px 12px 3px rgba(0, 0, 0, 0.5)",
                  }),
                }}
              />
            </div>
          )}
        {(hasEnemieIconLayout(card.layoutId) || card.layoutId === "enemie2") &&
          layoutPositions.enemieIcon &&
          card.enemieMainIcon && (
            <div
              className={`absolute overflow-hidden ${
                card.layoutId === "heroes"
                  ? "flex items-center justify-center"
                  : ""
              }`}
              style={{
                top: layoutPositions.enemieIcon.top,
                left: layoutPositions.enemieIcon.left,
                width: layoutPositions.enemieIcon.width,
                height: layoutPositions.enemieIcon.height,
              }}
            >
              <img
                src={card.enemieMainIcon}
                className={
                  card.layoutId === "heroes"
                    ? "w-full h-full object-contain object-center"
                    : ""
                }
                style={
                  card.layoutId === "heroes"
                    ? undefined
                    : {
                        objectFit: "fill",
                        objectPosition: "center",
                      }
                }
                alt={
                  card.layoutId === "heroes"
                    ? "Ícone do herói"
                    : "Ícone do inimigo"
                }
              />
            </div>
          )}
        {card.layoutId === "heroes" &&
          layoutPositions.heroSkillImage1Position &&
          layoutPositions.heroSkillImage2Position &&
          layoutPositions.heroSkillImage3Position &&
          (heroSkillImage1 || heroSkillImage2 || heroSkillImage3) && (
            <>
              {heroSkillImage1 && (
                <div
                  className="absolute flex items-center justify-center overflow-hidden z-20"
                  style={{
                    top: layoutPositions.heroSkillImage1Position.top,
                    left: layoutPositions.heroSkillImage1Position.left,
                    width: layoutPositions.heroSkillImage1Position.width,
                    height: layoutPositions.heroSkillImage1Position.height,
                    borderRadius: "8px",
                  }}
                >
                  <img
                    src={heroSkillImage1}
                    alt=""
                    className="w-full h-full object-contain"
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      borderRadius: "8px",
                    }}
                  />
                </div>
              )}
              {heroSkillImage2 && (
                <div
                  className="absolute flex items-center justify-center overflow-hidden z-20"
                  style={{
                    top: layoutPositions.heroSkillImage2Position.top,
                    left: layoutPositions.heroSkillImage2Position.left,
                    width: layoutPositions.heroSkillImage2Position.width,
                    height: layoutPositions.heroSkillImage2Position.height,
                    borderRadius: "8px",
                  }}
                >
                  <img
                    src={heroSkillImage2}
                    alt=""
                    className="w-full h-full object-contain"
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      borderRadius: "8px",
                    }}
                  />
                </div>
              )}
              {heroSkillImage3 && (
                <div
                  className="absolute flex items-center justify-center overflow-hidden z-20"
                  style={{
                    top: layoutPositions.heroSkillImage3Position.top,
                    left: layoutPositions.heroSkillImage3Position.left,
                    width: layoutPositions.heroSkillImage3Position.width,
                    height: layoutPositions.heroSkillImage3Position.height,
                    borderRadius: "8px",
                  }}
                >
                  <img
                    src={heroSkillImage3}
                    alt=""
                    className="w-full h-full object-contain"
                  />
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      borderRadius: "8px",
                    }}
                  />
                </div>
              )}
            </>
          )}
        {!isBgLayout(card.layoutId) &&
          !isTensionLayout(card.layoutId) &&
          !isEquip3EquipLayout(card.layoutId) &&
          card.layoutId !== "heroes" &&
          (isEnemie
            ? hasEnemieIconLayout(card.layoutId)
            : (card.selectedSkills?.length ?? 0) > 0) && (
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
                ...(!isEnemie && {
                  borderRadius: "15px",
                  padding: 8,
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
                                src={ICON_01}
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
                              effectiveIconOptions,
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
                                  src={ICON_02}
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
                                effectiveIconOptions,
                                list,
                              );
                              const others = list.filter(
                                (id) =>
                                  !isEnemie01(id) &&
                                  !isEnemie02(id) &&
                                  !isEnemie06(id),
                              );
                              const ordered: {
                                skillId: string;
                                is06: boolean;
                              }[] = has06
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
                                ? (
                                    card.skillNumbers?.[
                                      `enemie-blue-${id06 ?? "06"}`
                                    ] ?? card.enemieBlueExtraNumber
                                  )?.trim()
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
                                      ? ICON_06
                                      : (findEnemieIconForSkill(skillId)?.src ??
                                        "");
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
                                src={ICON_01}
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
                              effectiveIconOptions,
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
                                  src={ICON_02}
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
                                effectiveIconOptions,
                                list,
                              );
                              const others = list.filter(
                                (id) =>
                                  !isEnemie01(id) &&
                                  !isEnemie02(id) &&
                                  !isEnemie06(id),
                              );
                              const ordered: {
                                skillId: string;
                                is06: boolean;
                              }[] = has06
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
                                ? (
                                    card.skillNumbers?.[
                                      `enemie-purple-${id06 ?? "06"}`
                                    ] ?? card.enemiePurpleExtraNumber
                                  )?.trim()
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
                                      ? ICON_06
                                      : (findEnemieIconForSkill(skillId)?.src ??
                                        "");
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
                                src={ICON_01}
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
                              effectiveIconOptions,
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
                                  src={ICON_02}
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
                                effectiveIconOptions,
                                list,
                              );
                              const others = list.filter(
                                (id) =>
                                  !isEnemie01(id) &&
                                  !isEnemie02(id) &&
                                  !isEnemie06(id),
                              );
                              const ordered: {
                                skillId: string;
                                is06: boolean;
                              }[] = has06
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
                                ? (
                                    card.skillNumbers?.[
                                      `enemie-yellow-${id06 ?? "06"}`
                                    ] ?? card.enemieYellowExtraNumber
                                  )?.trim()
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
                                      ? ICON_06
                                      : (findEnemieIconForSkill(skillId)?.src ??
                                        "");
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
                card.selectedSkills.map((skillId, skillIndex) => {
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
                        style={{ filter: ICON_OUTLINE_FILTER }}
                      />
                      {numberInFront ? (
                        <div
                          className="absolute inset-0 z-10 flex items-center justify-center font-semibold drop-shadow-lg"
                          style={{
                            color: "#F9EBD0",
                            fontSize: isEffectSkill ? "45px" : "60px",
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
                    ...(isEquip3EquipLayout(card.layoutId) && {
                      flexDirection: "column-reverse",
                    }),
                    top: icon1Pos?.top,
                    left: icon1Pos?.left,
                  }}
                >
                  {icon1Pos && (
                    <>
                      <div
                        className="relative flex shrink-0 flex-col items-center justify-center"
                        style={{
                          ...(!isEnemieLayout(card.layoutId)
                            ? {
                                width: (() => {
                                  const icon = icon1Pos;
                                  return icon?.width != null
                                    ? parsePx(icon.width)
                                    : 128;
                                })(),
                                height: (() => {
                                  const icon = icon1Pos;
                                  return icon?.height != null
                                    ? parsePx(icon.height)
                                    : 128;
                                })(),
                                borderRadius: "50%",
                                padding: 20,
                                overflow: "hidden",
                              }
                            : {}),
                          ...(icon1BoxShadow
                            ? { boxShadow: icon1BoxShadow }
                            : {}),
                        }}
                      >
                        <img
                          src={
                            isEquip3EquipLayout(card.layoutId)
                              ? "/models/icons/A/03.png"
                              : card.icon ||
                                iconOptionsA[0]?.src ||
                                DEFAULT_ICON_FALLBACK
                          }
                          alt="Ícone do card"
                          className="h-32 w-32 shrink-0 object-contain"
                          style={{ filter: ICON_OUTLINE_FILTER }}
                        />
                      </div>
                      {!isEquip3EquipLayout(card.layoutId) &&
                        (isEquipWithEffectsLayout(card.layoutId) ||
                          card.icon2) &&
                        icon2Pos && (
                          <div
                            className="absolute flex items-center justify-center overflow-hidden"
                            style={{
                              top: icon2Pos.top,
                              left: icon2Pos.left,
                              width: (() => {
                                const icon2 = icon2Pos;
                                return icon2?.width != null
                                  ? parsePx(icon2.width)
                                  : 128;
                              })(),
                              height: (() => {
                                const icon2 = icon2Pos;
                                return icon2?.height != null
                                  ? parsePx(icon2.height)
                                  : 128;
                              })(),
                              borderRadius: "50%",
                              padding: 20,
                              ...(!isEnemieLayout(card.layoutId) && {}),
                              ...(icon2BoxShadow
                                ? { boxShadow: icon2BoxShadow }
                                : {}),
                            }}
                          >
                            <img
                              src={
                                isEquipWithEffectsLayout(card.layoutId)
                                  ? "/models/icons/A/03.png"
                                  : (card.icon2 ?? "")
                              }
                              alt="Segundo ícone"
                              className="h-full w-full object-contain"
                              style={
                                isEquipWithEffectsLayout(card.layoutId)
                                  ? {
                                      transform: "translateY(-20px)",
                                      filter: ICON_OUTLINE_FILTER,
                                    }
                                  : { filter: ICON_OUTLINE_FILTER }
                              }
                            />
                          </div>
                        )}
                    </>
                  )}
                </div>
                {isEquipWithEffectsLayout(card.layoutId) &&
                  card.equip3Number &&
                  icon2Pos && (
                    <div
                      className="flex items-center justify-center"
                      style={{
                        position: "absolute",
                        width: "65px",
                        top: icon2Pos.top,
                        left: icon2Pos.left,
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
                  layoutPositions.effect1a &&
                  layoutPositions.effect2a &&
                  layoutPositions.effect3a &&
                  layoutPositions.effect4a && (
                    <>
                      {[
                        layoutPositions.effect1a,
                        layoutPositions.effect2a,
                        layoutPositions.effect3a,
                        layoutPositions.effect4a,
                      ].map((pos, index) => {
                        const iconSrc = `/models/icons/effects/0${index + 1}.png`;
                        return (
                          <div
                            key={`effect-a-${index + 1}`}
                            className="relative flex items-center justify-center text-center overflow-hidden"
                            style={{
                              position: "absolute",
                              top: pos.top,
                              left: pos.left,
                              width: pos.width ?? "130px",
                              height: pos.height ?? "115px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "15px",
                              padding: 8,
                            }}
                          >
                            <img
                              src={iconSrc}
                              alt=""
                              className="h-full w-full object-contain"
                            />
                          </div>
                        );
                      })}
                    </>
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
                        className="relative flex items-center justify-center text-center overflow-hidden"
                        style={{
                          position: "absolute",
                          top: pos.top,
                          left: pos.left,
                          width: pos.width ?? "130px",
                          height: pos.height ?? "115px",
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
                          ...(index >= 0
                            ? {
                                borderRadius: "15px",
                                padding: 8,
                              }
                            : {}),
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
                              transform: "translateY(10px)",
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
                                  color: "#F9EBD0",
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
                                            ? "translateX(-50%) translateY(15px)"
                                            : "translateY(15px)",
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
                                            ? "translateX(-50%) translateY(15px)"
                                            : "translateY(15px)",
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
                                const iconIdNorm = String(
                                  effectData.icon,
                                ).padStart(2, "0");
                                const isEffect3SpecialPos =
                                  index === 2 &&
                                  EFFECT3_ICONS_SAME_POS_AS_03.includes(
                                    iconIdNorm,
                                  );
                                const isEffect4DuplaOrCopy =
                                  index === 3 &&
                                  (EFFECT4_ICONS_DUPLA.includes(iconIdNorm) ||
                                    EFFECT4_ICONS_DUPLA_COPY.includes(
                                      iconIdNorm,
                                    ));
                                const isEffect3Or4SpecialPos =
                                  isEffect3SpecialPos || isEffect4DuplaOrCopy;
                                if (isEffect3Or4SpecialPos) {
                                  const posByIcon =
                                    index === 2
                                      ? layoutPositions.effect3NumberPositionByIcon
                                      : layoutPositions.effect4NumberPositionByIcon;
                                  const iconPos =
                                    posByIcon?.[iconIdNorm] ??
                                    (index === 3 &&
                                    EFFECT4_ICONS_DUPLA_COPY.includes(
                                      iconIdNorm,
                                    )
                                      ? (posByIcon?.["03"] ??
                                        posByIcon?.["04"] ?? {
                                          top: "5px",
                                          left: "39px",
                                        })
                                      : {
                                          top: "5px",
                                          left: "39px",
                                        });
                                  const tooltipEffect3Or4 =
                                    index === 2
                                      ? TOOLTIP_EFFECT3[effectData.number]
                                      : TOOLTIP_EFFECT4[effectData.number];
                                  return (
                                    <div
                                      className="group absolute z-10 flex items-center justify-center text-center font-semibold drop-shadow-lg"
                                      style={{
                                        ...baseNumStyle,
                                        top: iconPos.top,
                                        left: iconPos.left,
                                        transform: isCenterX
                                          ? "translateX(-50%) translateY(15px)"
                                          : "translateY(15px)",
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
                                        ? "translateX(-50%) translateY(15px)"
                                        : "translateY(15px)",
                                      width: "120px",
                                      height: "120px",
                                      fontSize: "65px",
                                      fontFamily: bebasNeue.style.fontFamily,
                                      color: "#F9EBD0",
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
            <h3
              ref={titleRef}
              className={`leading-tight text-black drop-shadow-lg ${
                isEnemie ? "text-left" : "text-center"
              }`}
              style={{
                position: "absolute",
                top: layoutPositions.title.top,
                left: effectiveTitleLeft,
                width: effectiveTitleWidth,
                height: layoutPositions.title.height,
                fontSize: effectiveTitleFontSize,
                fontFamily: cinzel.style.fontFamily,
                fontWeight: isMhLayout ? 700 : 400,
                lineHeight:
                  layoutPositions.title?.lineHeight ??
                  UNIFIED_TITLE_LINE_HEIGHT,
                textAlign: isEnemie ? "left" : "center",
                whiteSpace: "pre-line",
                display: "flex",
                alignItems: isEnemie ? "flex-start" : "center",
                justifyContent: "center",
                flexDirection: "column",
                flexWrap: "wrap",
                flexGrow: 1,
                flexShrink: 1,
                flexBasis: "auto",
                flex: 1,
                ...(layoutPositions.title?.boxShadow && {
                  boxShadow: ICON_DROP_SHADOW,
                }),
                ...(card.layoutId === "equip4" &&
                  (() => {
                    const titleBg =
                      card.tensionColor === ""
                        ? 'url("/models/layout/Title-Gren-A.png")'
                        : card.tensionColor === "#A63E26"
                          ? 'url("/models/layout/Title-Red-A.png")'
                          : card.tensionColor === "#B26E29"
                            ? 'url("/models/layout/Title-Ambar-A.png")'
                            : 'url("/models/layout/Title-Gren-A.png")';
                    const titleBgSize =
                      layoutPositions.title.titleBgSize ?? "621px 134px";
                    const titleBaseLeft =
                      parseInt(
                        String(layoutPositions.title.left).replace("px", ""),
                        10,
                      ) || 13;
                    const titleLeftPx =
                      parseInt(
                        String(effectiveTitleLeft).replace("px", ""),
                        10,
                      ) || 13;
                    const bgOffsetX = titleLeftPx - titleBaseLeft;
                    return {
                      backgroundImage: titleBg,
                      backgroundSize: titleBgSize,
                      backgroundPosition:
                        bgOffsetX !== 0 ? `${-bgOffsetX}px center` : "center",
                      backgroundRepeat: "no-repeat",
                      borderRadius: "15px",
                      ...(card.icon2 && {
                        filter:
                          "drop-shadow(0 2px 4px rgba(0,0,0,0.4)) drop-shadow(0 4px 8px rgba(0,0,0,0.3))",
                      }),
                    };
                  })()),
                ...(!isEnemieLayout(card.layoutId) &&
                  card.layoutId !== "equip4" && {
                    borderRadius: "15px",
                  }),
              }}
            >
              {card.title || ""}
            </h3>
            {isTensionLayout(card.layoutId) ? (
              <>
                {card.layoutId === "equip4" &&
                  card.icon &&
                  layoutPositions.icon1BeforeTitle && (
                    <div
                      className="absolute flex items-center justify-center overflow-hidden"
                      style={{
                        top: layoutPositions.icon1BeforeTitle.top,
                        left: layoutPositions.icon1BeforeTitle.left,
                        width:
                          layoutPositions.icon1BeforeTitle.width ?? "134px",
                        height:
                          layoutPositions.icon1BeforeTitle.height ?? "134px",
                        backgroundImage:
                          card.tensionColor === "#067427"
                            ? 'url("/models/layout/Title-Gren-A.png")'
                            : card.tensionColor === "#A63E26"
                              ? 'url("/models/layout/Title-Red-A.png")'
                              : card.tensionColor === "#B26E29"
                                ? 'url("/models/layout/Title-Ambar-A.png")'
                                : 'url("/models/layout/Title-Gren-A.png")',
                        backgroundSize:
                          layoutPositions.title.titleBgSize ?? "621px 134px",
                        backgroundPosition: "left center",
                        backgroundRepeat: "no-repeat",
                        borderRadius: "15px",
                      }}
                    >
                      <img
                        src={card.icon}
                        alt="Ícone"
                        className="object-contain"
                        style={
                          layoutPositions.icon1BeforeTitle?.iconWidth ||
                          layoutPositions.icon1BeforeTitle?.iconHeight
                            ? {
                                width:
                                  layoutPositions.icon1BeforeTitle.iconWidth,
                                height:
                                  layoutPositions.icon1BeforeTitle.iconHeight,
                              }
                            : { width: "100%", height: "100%" }
                        }
                      />
                    </div>
                  )}
                {card.layoutId === "equip4" &&
                  card.icon2 &&
                  layoutPositions.icon2 && (
                    <div
                      className="absolute flex items-center justify-center overflow-hidden"
                      style={{
                        top: layoutPositions.icon2.top,
                        left: layoutPositions.icon2.left,
                        width: layoutPositions.icon2.width ?? "128px",
                        height: layoutPositions.icon2.height ?? "128px",
                        backgroundImage:
                          card.tensionColor === "#067427"
                            ? 'url("/models/layout/Title-Gren-A.png")'
                            : card.tensionColor === "#A63E26"
                              ? 'url("/models/layout/Title-Red-A.png")'
                              : card.tensionColor === "#B26E29"
                                ? 'url("/models/layout/Title-Ambar-A.png")'
                                : 'url("/models/layout/Title-Gren-A.png")',
                        backgroundSize:
                          layoutPositions.title.titleBgSize ?? "621px 134px",
                        backgroundPosition: "right center",
                        backgroundRepeat: "no-repeat",
                        borderRadius: "15px",
                      }}
                    >
                      <img
                        src={card.icon2}
                        alt="Ícone"
                        className="object-contain"
                        style={
                          layoutPositions.icon2?.iconWidth ||
                          layoutPositions.icon2?.iconHeight
                            ? {
                                width: layoutPositions.icon2.iconWidth,
                                height: layoutPositions.icon2.iconHeight,
                              }
                            : { width: "100%", height: "100%" }
                        }
                      />
                    </div>
                  )}
                <div
                  className="absolute flex flex-col gap-3 text-black drop-shadow-lg"
                  style={{
                    top: descriptionPositions.top,
                    left: descriptionPositions.left,
                    width: descriptionPositions.width || "570px",
                    height: descriptionPositions.height,
                    fontFamily: crimsonPro.style.fontFamily,
                    fontWeight: 590,
                    fontSize:
                      descriptionPositions.fontSize ??
                      UNIFIED_DESCRIPTION_FONT_SIZE,
                    lineHeight:
                      descriptionPositions.lineHeight ??
                      UNIFIED_DESCRIPTION_LINE_HEIGHT,
                    padding: "20px",
                    ...(descriptionPositions?.paddingTop && {
                      paddingTop: layoutPositions.description.paddingTop,
                    }),
                    ...(descriptionPositions?.boxShadow && {
                      boxShadow: ICON_DROP_SHADOW,
                    }),
                    ...(card.layoutId === "equip4" && {
                      borderRadius: "15px",
                    }),
                  }}
                >
                  <p
                    className="m-0 w-full text-center whitespace-pre-line"
                    style={{
                      fontFamily: crimsonPro.style.fontFamily,
                      fontWeight: 590,
                      lineHeight:
                        descriptionPositions?.lineHeight ??
                        UNIFIED_DESCRIPTION_LINE_HEIGHT,
                      ...(layoutPositions.description?.lineWidth && {
                        maxWidth: descriptionPositions.lineWidth,
                        marginLeft: "auto",
                        marginRight: "auto",
                      }),
                    }}
                  >
                    {renderTextWithBoldAndIcons(
                      isMhLayout
                        ? (card.description || "").replace(/\*\*/g, "")
                        : card.description || "",
                      38,
                      inlineIconMap,
                    )}
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
                              fontFamily: crimsonPro.style.fontFamily,
                              fontWeight: 590,
                            }}
                          >
                            {renderTextWithInlineIcons(
                              card.tension2Text || "",
                              38,
                              inlineIconMap,
                            )}
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
                              fontFamily: crimsonPro.style.fontFamily,
                              fontWeight: 590,
                            }}
                          >
                            {renderTextWithInlineIcons(
                              card.tension1Text || "",
                              38,
                              inlineIconMap,
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {card.layoutId === "equip4" &&
                  layoutPositions.bottomBar1 &&
                  layoutPositions.bottomBar2 &&
                  layoutPositions.bottomBar3 && (
                    <>
                      <div
                        className="absolute"
                        style={{
                          top: layoutPositions.bottomBar1.top,
                          left: layoutPositions.bottomBar1.left,
                          width: layoutPositions.bottomBar1.width,
                          height: layoutPositions.bottomBar1.height,
                          borderRadius:
                            layoutPositions.bottomBar1.borderRadius ?? "0",
                          ...(card.bottomBarColor === "#39558E"
                            ? {
                                backgroundImage:
                                  'url("/models/layout/Bottom-Icon-A.png")',
                                backgroundSize: "100% 100%",
                                backgroundPosition: "center",
                                backgroundRepeat: "no-repeat",
                              }
                            : card.bottomBarColor === "#512D71"
                              ? {
                                  backgroundImage:
                                    'url("/models/layout/Bottom-Icon-C.png")',
                                  backgroundSize: "100% 100%",
                                  backgroundPosition: "center",
                                  backgroundRepeat: "no-repeat",
                                }
                              : card.bottomBarColor === "#C7C554"
                                ? {
                                    backgroundImage:
                                      'url("/models/layout/Bottom-Icon-B.png")',
                                    backgroundSize: "100% 100%",
                                    backgroundPosition: "center",
                                    backgroundRepeat: "no-repeat",
                                  }
                                : {
                                    backgroundColor:
                                      card.bottomBarColor ?? "#39558E",
                                    opacity: 0.5,
                                  }),
                        }}
                      />
                      <div
                        className="absolute"
                        style={{
                          top: layoutPositions.bottomBar2.top,
                          left: layoutPositions.bottomBar2.left,
                          width: layoutPositions.bottomBar2.width,
                          height: layoutPositions.bottomBar2.height,
                          borderRadius:
                            layoutPositions.bottomBar2.borderRadius ?? "0",
                          ...(card.bottomBarColor === "#512D71"
                            ? {
                                backgroundImage:
                                  'url("/models/layout/Bottom-C.png")',
                                backgroundSize: "100% 100%",
                                backgroundPosition: "center",
                                backgroundRepeat: "no-repeat",
                              }
                            : card.bottomBarColor === "#39558E"
                              ? {
                                  backgroundImage:
                                    'url("/models/layout/Bottom-A.png")',
                                  backgroundSize: "100% 100%",
                                  backgroundPosition: "center",
                                  backgroundRepeat: "no-repeat",
                                }
                              : card.bottomBarColor === "#C7C554"
                                ? {
                                    backgroundImage:
                                      'url("/models/layout/Bottom-B.png")',
                                    backgroundSize: "100% 100%",
                                    backgroundPosition: "center",
                                    backgroundRepeat: "no-repeat",
                                  }
                                : {
                                    backgroundColor:
                                      card.bottomBarColor ?? "#39558E",
                                    opacity: 0.5,
                                  }),
                        }}
                      />
                      <div
                        className="absolute"
                        style={{
                          top: layoutPositions.bottomBar3.top,
                          left: layoutPositions.bottomBar3.left,
                          width: layoutPositions.bottomBar3.width,
                          height: layoutPositions.bottomBar3.height,
                          borderRadius:
                            layoutPositions.bottomBar3.borderRadius ?? "0",
                          ...(card.bottomBarColor === "#39558E"
                            ? {
                                backgroundImage:
                                  'url("/models/layout/Bottom-Icon-A.png")',
                                backgroundSize: "100% 100%",
                                backgroundPosition: "center",
                                backgroundRepeat: "no-repeat",
                              }
                            : card.bottomBarColor === "#512D71"
                              ? {
                                  backgroundImage:
                                    'url("/models/layout/Bottom-Icon-C.png")',
                                  backgroundSize: "100% 100%",
                                  backgroundPosition: "center",
                                  backgroundRepeat: "no-repeat",
                                }
                              : card.bottomBarColor === "#C7C554"
                                ? {
                                    backgroundImage:
                                      'url("/models/layout/Bottom-Icon-B.png")',
                                    backgroundSize: "100% 100%",
                                    backgroundPosition: "center",
                                    backgroundRepeat: "no-repeat",
                                  }
                                : {
                                    backgroundColor:
                                      card.bottomBarColor ?? "#39558E",
                                    opacity: 0.5,
                                  }),
                        }}
                      />
                    </>
                  )}
              </>
            ) : isEquip3EquipLayout(card.layoutId) ? (
              (() => {
                const hasSelectedSkill = (card.selectedSkills ?? []).some(
                  (id) =>
                    EQUIP3_EQUIP_SELECTABLE_SKILL_IDS.includes(
                      String(id).padStart(2, "0"),
                    ) || EQUIP3_EQUIP_SELECTABLE_SKILL_IDS.includes(String(id)),
                );
                return hasSelectedSkill ? (
                  <div
                    className="absolute flex flex-wrap justify-center items-center content-center gap-4 text-black drop-shadow-lg"
                    style={{
                      top: descriptionPositions.top,
                      left: descriptionPositions.left,
                      width: descriptionPositions.width || "570px",
                      height: descriptionPositions.height || "420px",
                      fontFamily: crimsonPro.style.fontFamily,
                      fontWeight: 590,
                      fontSize:
                        descriptionPositions.fontSize ??
                        UNIFIED_DESCRIPTION_FONT_SIZE,
                      lineHeight:
                        descriptionPositions.lineHeight ??
                        UNIFIED_DESCRIPTION_LINE_HEIGHT,
                      padding: "0 40px 40px 40px",
                      borderRadius: "15px",
                      ...(descriptionPositions?.boxShadow && {
                        boxShadow: ICON_DROP_SHADOW,
                      }),
                    }}
                  >
                    <div
                      className="flex shrink-0 items-center justify-center gap-3 mt-[35px] ml-[-20px] "
                      style={{
                        width:
                          layoutPositions.descriptionSkillsBox?.width ??
                          "200px",
                        height:
                          layoutPositions.descriptionSkillsBox?.height ??
                          "80px",
                        minHeight:
                          layoutPositions.descriptionSkillsBox?.minHeight ??
                          "60px",
                        borderRadius:
                          layoutPositions.descriptionSkillsBox?.borderRadius ??
                          "25px",
                        backgroundColor:
                          layoutPositions.descriptionSkillsBox
                            ?.backgroundColor ?? "#ef4444",
                      }}
                    >
                      <img
                        src={EQUIP3_EQUIP_FIXED_ICON}
                        alt=""
                        className="object-contain"
                        style={{
                          width: "75px",
                          height: "75px",
                        }}
                      />
                      {(() => {
                        const selectableId = (card.selectedSkills ?? []).find(
                          (id) =>
                            EQUIP3_EQUIP_SELECTABLE_SKILL_IDS.includes(
                              String(id).padStart(2, "0"),
                            ) ||
                            EQUIP3_EQUIP_SELECTABLE_SKILL_IDS.includes(
                              String(id),
                            ),
                        );
                        const skill = selectableId
                          ? effectIconOptions04.find(
                              (o) =>
                                o.id === selectableId ||
                                String(o.id) === String(selectableId),
                            )
                          : null;
                        if (!skill) return null;
                        const skillId = skill.id;
                        const normalizedId = String(skillId).padStart(2, "0");
                        const is07Or08 =
                          normalizedId === "07" || normalizedId === "08";
                        const numberInFront = (
                          card.skillNumbers?.[skillId] ??
                          (selectableId
                            ? card.skillNumbers?.[selectableId]
                            : undefined)
                        )?.trim();
                        return (
                          <div className="relative flex items-center justify-center">
                            <img
                              src={skill.src}
                              alt={skill.label}
                              className="object-contain"
                              style={{ width: "75px", height: "75px" }}
                            />
                            {numberInFront ? (
                              <div
                                className="absolute inset-0 z-10 flex items-center justify-center font-semibold drop-shadow-lg"
                                style={{
                                  color: "#F9EBD0",
                                  fontSize: is07Or08 ? "25px" : "45px",
                                  fontFamily: bebasNeue.style.fontFamily,
                                  ...(is07Or08 && {
                                    transform: "translate(-19px, -13px)",
                                  }),
                                }}
                              >
                                {numberInFront}
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                    <p
                      className="min-w-0 flex-1 text-xl whitespace-pre-line text-justify mt-[40px] h-[105px] "
                      style={{
                        textAlignLast: "center",
                        letterSpacing: "-0.03em",
                        lineHeight:
                          descriptionPositions?.lineHeight ??
                          UNIFIED_DESCRIPTION_LINE_HEIGHT,
                      }}
                    >
                      {renderTextWithBoldAndIcons(
                        isMhLayout
                          ? (card.description || "").replace(/\*\*/g, "")
                          : card.description || "",
                        38,
                        inlineIconMap,
                      )}
                    </p>
                  </div>
                ) : (
                  <p
                    className="absolute text-black drop-shadow-lg text-center flex flex-wrap justify-center items-center content-center"
                    style={{
                      top: descriptionPositions.top,
                      left: descriptionPositions.left,
                      width: descriptionPositions.width || "570px",
                      height: descriptionPositions.height || "420px",
                      fontFamily: crimsonPro.style.fontFamily,
                      fontWeight: 590,
                      fontSize:
                        descriptionPositions.fontSize ??
                        UNIFIED_DESCRIPTION_FONT_SIZE,
                      lineHeight:
                        descriptionPositions.lineHeight ??
                        UNIFIED_DESCRIPTION_LINE_HEIGHT,
                      letterSpacing: "-0.03em",
                      padding: "0 40px 40px 40px",
                      borderRadius: "15px",
                      ...(descriptionPositions?.boxShadow && {
                        boxShadow: ICON_DROP_SHADOW,
                      }),
                      whiteSpace: "pre-line",
                      textAlign: "center",
                      textAlignLast: "center",
                    }}
                  >
                    {renderTextWithBoldAndIcons(
                      isMhLayout
                        ? (card.description || "").replace(/\*\*/g, "")
                        : card.description || "",
                      38,
                      inlineIconMap,
                    )}
                  </p>
                );
              })()
            ) : card.layoutId === "equip3" ? null : (
              <>
                {isMhLayout ? (
                  <div
                    className="absolute text-black drop-shadow-lg"
                    style={{
                      top: descriptionPositions.top,
                      left: descriptionPositions.left,
                      width: descriptionPositions.width || "570px",
                      height: descriptionPositions.height || "420px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "16px 20px",
                      borderRadius: "12px",
                      ...(descriptionPositions?.boxShadow && {
                        boxShadow: ICON_DROP_SHADOW,
                      }),
                    }}
                  >
                    <p
                      className="m-0 w-full"
                      style={{
                        fontFamily: crimsonPro.style.fontFamily,
                        fontWeight: card.layoutId === "mh1" ? 400 : 590,
                        fontSize:
                          descriptionPositions.fontSize ??
                          UNIFIED_DESCRIPTION_FONT_SIZE,
                        lineHeight:
                          descriptionPositions?.lineHeight ??
                          UNIFIED_DESCRIPTION_LINE_HEIGHT,
                        whiteSpace: "pre-line",
                        textAlign: "justify",
                        textAlignLast: "center",
                      }}
                    >
                      {renderTextWithBoldAndIcons(
                        (card.description || "").replace(/\*\*/g, ""),
                        38,
                        inlineIconMap,
                      )}
                    </p>
                  </div>
                ) : (
                  <p
                    className={`absolute text-black drop-shadow-lg ${
                      isEnemie ? "text-left" : "text-center"
                    }`}
                    style={{
                      top: descriptionPositions.top,
                      left: descriptionPositions.left,
                      fontFamily: crimsonPro.style.fontFamily,
                      fontWeight: card.layoutId === "mh1" ? 400 : 590,
                      fontSize:
                        descriptionPositions.fontSize ??
                        UNIFIED_DESCRIPTION_FONT_SIZE,
                      lineHeight:
                        descriptionPositions?.lineHeight ??
                        UNIFIED_DESCRIPTION_LINE_HEIGHT,
                      width: descriptionPositions.width || "570px",
                      height: descriptionPositions.height || "420px",
                      whiteSpace: "pre-line",
                      textAlign: isEnemie ? "left" : "center",
                      padding: "40px",
                      ...(descriptionPositions?.boxShadow && {
                        boxShadow: ICON_DROP_SHADOW,
                      }),
                      ...(isEnemie && (card.description || "").trim()
                        ? { borderRadius: "12px" }
                        : {}),
                      ...(isEnemie && { padding: "2%" }),
                      ...(!isEnemieLayout(card.layoutId) &&
                        !isEquipWithEffectsLayout(card.layoutId) && {
                          borderRadius: "15px",
                        }),
                    }}
                  >
                    {renderTextWithBoldAndIcons(
                      card.description || "",
                      38,
                      inlineIconMap,
                    )}
                  </p>
                )}
                {isMhLayout && layoutPositions.description2 && (
                  <div
                    className="absolute text-black drop-shadow-lg"
                    style={{
                      top: layoutPositions.description2.top,
                      left: layoutPositions.description2.left,
                      width: layoutPositions.description2.width || "580px",
                      height: layoutPositions.description2.height || "360px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "16px 20px",
                      borderRadius: "12px",
                      ...(layoutPositions.description2?.boxShadow && {
                        boxShadow: ICON_DROP_SHADOW,
                      }),
                    }}
                  >
                    <p
                      className="m-0 w-full"
                      style={{
                        fontFamily: crimsonPro.style.fontFamily,
                        fontWeight: card.layoutId === "mh1" ? 400 : 590,
                        fontSize:
                          layoutPositions.description2.fontSize ??
                          UNIFIED_DESCRIPTION_FONT_SIZE,
                        lineHeight:
                          layoutPositions.description2.lineHeight ??
                          UNIFIED_DESCRIPTION_LINE_HEIGHT,
                        whiteSpace: "pre-line",
                        textAlign: "justify",
                        textAlignLast: "center",
                      }}
                    >
                      {renderTextWithBoldAndIcons(
                        (card.description2 || "").replace(/\*\*/g, ""),
                        38,
                        inlineIconMap,
                      )}
                    </p>
                  </div>
                )}
              </>
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
  const [heroSkillImage1, setHeroSkillImage1] = useState<string | null>(null);
  const [heroSkillImage2, setHeroSkillImage2] = useState<string | null>(null);
  const [heroSkillImage3, setHeroSkillImage3] = useState<string | null>(null);
  const [heroSkillImagesCache, setHeroSkillImagesCache] = useState<
    Record<
      string,
      { skill1: string | null; skill2: string | null; skill3: string | null }
    >
  >({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isJsonTextModalOpen, setIsJsonTextModalOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonTextError, setJsonTextError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [layoutCategory, setLayoutCategory] = useState<string>(
    layoutCategories[0]?.id ?? "resident",
  );
  const [iconOptionsA, setIconOptionsA] = useState<IconOption[]>([]);
  const [iconOptionsB, setIconOptionsB] = useState<IconOption[]>([]);
  const [iconOptionsD, setIconOptionsD] = useState<IconOption[]>([]);
  const [layoutIconOptionsByPath, setLayoutIconOptionsByPath] = useState<
    Record<string, IconOption[]>
  >({});
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
  const [enemieMainIconOptions, setEnemieMainIconOptions] = useState<
    IconOption[]
  >([]);
  const [heroIconOptions, setHeroIconOptions] = useState<IconOption[]>([]);
  const [inlineIconMap, setInlineIconMap] = useState<Record<string, string>>(
    () => ({ ...INLINE_ICON_MAP_BASE, ...TEXT_HUNTER_ICON_MAP }),
  );
  const [exportZipProgress, setExportZipProgress] = useState<number | null>(
    null,
  );
  const [decks, setDecks] = useState<
    Array<{ id: string; name: string; cards: CardDesign[] }>
  >([]);
  const [isDeckModalOpen, setIsDeckModalOpen] = useState<boolean>(false);
  const [isTutorialModalOpen, setIsTutorialModalOpen] =
    useState<boolean>(false);
  const [tutorialPageIndex, setTutorialPageIndex] = useState<number>(0);
  const [isTutorialEditMode, setIsTutorialEditMode] = useState<boolean>(false);
  const [tutorialPagesState, setTutorialPagesState] = useState<
    import("@/data/tutorialTypes").TutorialLayout | null
  >(null);

  useEffect(() => {
    if (isTutorialModalOpen) {
      setTutorialPageIndex(0);
      setIsTutorialEditMode(false);
      const gameKey = layoutCategory === "monster" ? "MH" : "RE3";
      const fallback = {
        RE3: re3TutorialLayout as import("@/data/tutorialTypes").TutorialLayout,
        MH: mhTutorialLayout as import("@/data/tutorialTypes").TutorialLayout,
      };
      (async () => {
        const saved = await getTutorialPagesFromDb(fallback);
        const pagesForGame = saved[gameKey];
        const raw = pagesForGame?.length ? pagesForGame : fallback[gameKey];
        setTutorialPagesState(
          JSON.parse(JSON.stringify(raw)).map(normalizeTutorialPage),
        );
      })();
    } else {
      setTutorialPagesState(null);
    }
  }, [isTutorialModalOpen, layoutCategory]);
  const [deckName, setDeckName] = useState<string>("");
  const [deckError, setDeckError] = useState<string | null>(null);
  const [isRenameDeckOpen, setIsRenameDeckOpen] = useState<boolean>(false);
  const [renameDeckId, setRenameDeckId] = useState<string | null>(null);
  const [renameDeckName, setRenameDeckName] = useState<string>("");
  const [renameDeckError, setRenameDeckError] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const heroSkillImage1Ref = useRef<HTMLInputElement | null>(null);
  const heroSkillImage2Ref = useRef<HTMLInputElement | null>(null);
  const heroSkillImage3Ref = useRef<HTMLInputElement | null>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionRef = useRef<string>("");
  const descriptionFormatTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const selectedCardRef = useRef<HTMLDivElement | null>(null);
  const lastSavedLayoutIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (descriptionFormatTimeoutRef.current) {
        clearTimeout(descriptionFormatTimeoutRef.current);
      }
    };
  }, []);

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
      "D",
      "Effects/01",
      "Effects/02",
      "Effects/03",
      "Effects/04",
      "Tension",
      "Enemies",
      "Enemies/Icons",
      "Heroes",
      "Icons",
      "textHunter",
    ] as const;
    const processIcons = (data: IconOption[], isTextHunter = false) => {
      const built: Record<string, string> = {};
      for (const item of data) {
        if (isTextHunter) {
          const label = String(item.label || "").trim();
          if (!label) continue;
          const key = `Icon${label
            .split(/[^a-zA-Z0-9]+/)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join("")}`;
          if (!key) continue;
          built[key] = item.src;
          built[key.toLowerCase()] = item.src;
        } else if (item.label !== "00") {
          built["00" + item.label] = item.src;
        }
      }
      setInlineIconMap(() => ({
        ...INLINE_ICON_MAP_BASE,
        ...TEXT_HUNTER_ICON_MAP,
        ...built,
      }));
    };
    const handlers: Record<string, (data: IconOption[]) => void> = {
      A: setIconOptionsA,
      B: setIconOptionsB,
      C: setSkillIconOptions,
      D: setIconOptionsD,
      "Effects/01": setEffect2IconOptions,
      "Effects/02": setEffect3IconOptions,
      "Effects/03": setEffect4IconOptions,
      "Effects/04": setEffectIconOptions04,
      Tension: setTensionIconOptions,
      Enemies: setEnemieIconOptions,
      "Enemies/Icons": setEnemieMainIconOptions,
      Heroes: setHeroIconOptions,
      Icons: (data) => processIcons(data, false),
      textHunter: (data) => processIcons(data, true),
    };
    Promise.allSettled(
      paths.map((p) =>
        fetch(`/api/icons?path=${encodeURIComponent(p)}`).then((r) => r.json()),
      ),
    ).then((results) => {
      results.forEach((result, i) => {
        const data = result.status === "fulfilled" ? result.value : null;
        const handler = handlers[paths[i]];
        if (Array.isArray(data) && handler) handler(data);
      });
    });
  }, []);

  useEffect(() => {
    const paths = Array.from(
      new Set(
        layoutOptions
          .flatMap((layout) => {
            const iconPaths = (layout.icons ?? []).map((slot) => slot.path);
            const skillPath = layout.skillsConfig?.path
              ? [layout.skillsConfig.path]
              : [];
            return [...iconPaths, ...skillPath];
          })
          .filter((p) => typeof p === "string" && p.trim() !== ""),
      ),
    );
    if (paths.length === 0) return;
    Promise.allSettled(
      paths.map((p) =>
        fetch(`/api/icons?path=${encodeURIComponent(p)}`).then((r) => r.json()),
      ),
    ).then((results) => {
      const next: Record<string, IconOption[]> = {};
      results.forEach((result, i) => {
        const data = result.status === "fulfilled" ? result.value : null;
        if (Array.isArray(data)) next[paths[i]] = data;
      });
      if (Object.keys(next).length > 0) {
        setLayoutIconOptionsByPath((prev) => ({ ...prev, ...next }));
      }
    });
  }, []);

  useEffect(() => {
    if (
      form.layout === "equip3-equip" &&
      form.icon !== "/models/icons/A/03.png"
    ) {
      setForm((prev) => ({ ...prev, icon: "/models/icons/A/03.png" }));
    } else if (form.icon === "" && form.layout !== "equip4") {
      const layout = getLayoutConfig(form.layout);
      const iconSlot = getLayoutIconSlots(layout)[0];
      const options =
        iconSlot?.path && layoutIconOptionsByPath[iconSlot.path]
          ? layoutIconOptionsByPath[iconSlot.path]
          : iconOptionsA;
      if (options.length > 0) {
        setForm((prev) => ({ ...prev, icon: options[0].src }));
      }
    }
  }, [form.layout, form.icon, iconOptionsA, layoutIconOptionsByPath]);

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

  const handleHeroSkillImageUpload =
    (slot: 1 | 2 | 3) => (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          if (slot === 1) setHeroSkillImage1(reader.result);
          else if (slot === 2) setHeroSkillImage2(reader.result);
          else setHeroSkillImage3(reader.result);
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
    if (descriptionFormatTimeoutRef.current) {
      clearTimeout(descriptionFormatTimeoutRef.current);
      descriptionFormatTimeoutRef.current = null;
    }
    descriptionRef.current = card.description ?? "";
    setForm({
      title: card.title,
      description: card.description,
      description2: card.description2 ?? "",
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
      tensionColor: card.tensionColor ?? "#067427",
      bottomBarColor: card.bottomBarColor ?? "#39558E",
      titleLines: (card.titleLines ?? 1) as 1 | 2 | 3,
      heroRollNumber: card.heroRollNumber ?? "0",
      heroBagNumber: card.heroBagNumber ?? "0",
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
    if (card.layoutId === "heroes") {
      const [s1, s2, s3] = await Promise.all([
        getOverlayImage(`${card.id}-hero-skill1`),
        getOverlayImage(`${card.id}-hero-skill2`),
        getOverlayImage(`${card.id}-hero-skill3`),
      ]);
      setHeroSkillImage1(s1);
      setHeroSkillImage2(s2);
      setHeroSkillImage3(s3);
    } else {
      setHeroSkillImage1(null);
      setHeroSkillImage2(null);
      setHeroSkillImage3(null);
    }
    setEditingId(card.id);
  };

  const handleNewCard = () => {
    if (descriptionFormatTimeoutRef.current) {
      clearTimeout(descriptionFormatTimeoutRef.current);
      descriptionFormatTimeoutRef.current = null;
    }
    descriptionRef.current = "";
    setForm(createInitialFormState(lastSavedLayoutIdRef.current ?? undefined));
    setOverlayImage(null);
    setHeroSkillImage1(null);
    setHeroSkillImage2(null);
    setHeroSkillImage3(null);
    setEditingId(null);
  };

  const getDefaultLayoutIdForCategory = (categoryId: string) =>
    layoutOptions.find((opt) => (opt.categoryId ?? "resident") === categoryId)
      ?.id ??
    layoutOptions[0]?.id ??
    DEFAULT_LAYOUT.id;

  const resetDraft = () => {
    setCards([]);
    const defaultLayoutId = getDefaultLayoutIdForCategory(layoutCategory);
    setForm(createInitialFormState(defaultLayoutId));
    setOverlayImage(null);
    setHeroSkillImage1(null);
    setHeroSkillImage2(null);
    setHeroSkillImage3(null);
    setEditingId(null);
  };

  const resolveIconSrcForSlot = (
    layout: LayoutOption,
    slotIndex: number,
    value: unknown,
  ): string => {
    if (typeof value !== "string") return "";
    if (value.includes("/")) return value;
    const normalized = normalizeIconId(value);
    if (!normalized) return "";
    const slots = getLayoutIconSlots(layout);
    const slot = slots[slotIndex];
    if (!slot?.path) return "";
    const options = getOptionsForPath(slot.path);
    const match = options.find(
      (item) =>
        normalizeIconId(item.id) === normalized ||
        normalizeIconId(item.label) === normalized,
    );
    return match?.src ?? "";
  };

  const normalizeIdArray = (input: unknown): string[] => {
    if (!Array.isArray(input)) return [];
    return input
      .map((item) => {
        if (typeof item === "number") return String(item).padStart(2, "0");
        if (typeof item === "string") return normalizeIconId(item);
        return "";
      })
      .filter(Boolean);
  };

  const handleSaveDeck = () => {
    setDeckError(null);
    const name = deckName.trim();
    if (!name) {
      setDeckError("Digite um nome para o deck.");
      return;
    }
    if (cards.length === 0) {
      setDeckError("Não há cards para salvar.");
      return;
    }
    const existing = decks.find(
      (d) => d.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      setDecks((prev) =>
        prev.map((d) =>
          d.id === existing.id ? { ...d, cards: [...cards] } : d,
        ),
      );
    } else {
      const newDeck = {
        id: crypto.randomUUID(),
        name,
        cards: [...cards],
      };
      setDecks((prev) => [newDeck, ...prev]);
    }
    resetDraft();
    setDeckName("");
    setIsDeckModalOpen(false);
  };

  const handleRenameDeck = () => {
    setRenameDeckError(null);
    if (!renameDeckId) return;
    const name = renameDeckName.trim();
    if (!name) {
      setRenameDeckError("Digite um nome para o deck.");
      return;
    }
    const exists = decks.find(
      (d) =>
        d.name.toLowerCase() === name.toLowerCase() && d.id !== renameDeckId,
    );
    if (exists) {
      setRenameDeckError("Já existe um deck com esse nome.");
      return;
    }
    setDecks((prev) =>
      prev.map((d) => (d.id === renameDeckId ? { ...d, name } : d)),
    );
    setIsRenameDeckOpen(false);
    setRenameDeckId(null);
    setRenameDeckName("");
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
    let active = true;

    const sanitizeCards = (parsed: CardDesign[]) =>
      parsed.map((card) => {
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
          tensionColor: card.tensionColor ?? "#067427",
          bottomBarColor: card.bottomBarColor ?? "#39558E",
          heroRollNumber: card.heroRollNumber ?? "0",
          heroBagNumber: card.heroBagNumber ?? "0",
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

    const loadCards = async () => {
      if (typeof window === "undefined") return;
      const storedDb = await getCardsFromDb();
      if (!active) return;
      if (storedDb && storedDb.length > 0) {
        setCards(sanitizeCards(storedDb));
        return;
      }
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!stored) return;
      try {
        const parsed = JSON.parse(stored) as CardDesign[];
        const sanitized = sanitizeCards(parsed);
        setCards(sanitized);
        await saveCardsToDb(sanitized);
        window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      } catch (error) {
        console.error(error);
      }
    };

    loadCards();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    void saveCardsToDb(cards);
  }, [cards]);

  useEffect(() => {
    let active = true;
    const loadDecks = async () => {
      if (typeof window === "undefined") return;
      const stored = await getDecksFromDb();
      if (!active) return;
      if (stored && Array.isArray(stored)) {
        setDecks(stored);
      }
    };
    loadDecks();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    void saveDecksToDb(decks);
  }, [decks]);

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

  useEffect(() => {
    let active = true;

    const syncHeroSkillImagesCache = async () => {
      const heroCards = cards.filter((c) => c.layoutId === "heroes");
      const entries = await Promise.all(
        heroCards.map(async (card) => {
          const [skill1, skill2, skill3] = await Promise.all([
            getOverlayImage(`${card.id}-hero-skill1`),
            getOverlayImage(`${card.id}-hero-skill2`),
            getOverlayImage(`${card.id}-hero-skill3`),
          ]);
          return [card.id, { skill1, skill2, skill3 }] as const;
        }),
      );
      if (!active) return;
      setHeroSkillImagesCache(Object.fromEntries(entries));
    };

    syncHeroSkillImagesCache();
    return () => {
      active = false;
    };
  }, [cards]);

  const currentLayoutConfig = getLayoutConfig(form.layout);
  const layoutIconSlots = getLayoutIconSlots(currentLayoutConfig);
  const getOptionsForPath = (path: string): IconOption[] => {
    if (layoutIconOptionsByPath[path]) return layoutIconOptionsByPath[path];
    if (path === "A") return iconOptionsA;
    if (path === "B") return iconOptionsB;
    if (path === "D") return iconOptionsD;
    if (path === "C") return skillIconOptions;
    return [];
  };
  const getSkillOptionsForLayout = (layoutId: string): IconOption[] => {
    const layout = getLayoutConfig(layoutId);
    const config = layout.skillsConfig;
    const path = config?.path ?? "C";
    const optionsRaw = getOptionsForPath(path);
    const allowedSet = new Set(
      (config?.allowedIds ?? []).map(normalizeIconId).filter(Boolean),
    );
    return allowedSet.size > 0
      ? optionsRaw.filter((item) => isIconAllowed(item, allowedSet))
      : optionsRaw;
  };
  const skillOptionsForCurrentLayout = getSkillOptionsForLayout(
    currentLayoutConfig.id,
  );
  const showLayoutIcons =
    layoutIconSlots.length > 0 &&
    !isEquipWithEffectsLayout(currentLayoutConfig.id);

  const previewCard = {
    icon: form.icon,
    icon2: form.icon2 || null,
    icon2Id: form.icon2Id || null,
    title: form.title,
    description: form.description,
    description2: form.description2 ?? "",
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
    tensionColor: form.tensionColor,
    bottomBarColor: form.bottomBarColor,
    titleLines: form.titleLines ?? 1,
    heroRollNumber: form.heroRollNumber ?? "0",
    heroBagNumber: form.heroBagNumber ?? "0",
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

    if (cardToSave.layoutId === "heroes") {
      await Promise.all([
        heroSkillImage1
          ? saveOverlayImage(`${cardId}-hero-skill1`, heroSkillImage1)
          : deleteOverlayImage(`${cardId}-hero-skill1`),
        heroSkillImage2
          ? saveOverlayImage(`${cardId}-hero-skill2`, heroSkillImage2)
          : deleteOverlayImage(`${cardId}-hero-skill2`),
        heroSkillImage3
          ? saveOverlayImage(`${cardId}-hero-skill3`, heroSkillImage3)
          : deleteOverlayImage(`${cardId}-hero-skill3`),
      ]);
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

    if (cardToSave.layoutId === "heroes") {
      setHeroSkillImagesCache((prev) => ({
        ...prev,
        [cardId]: {
          skill1: heroSkillImage1,
          skill2: heroSkillImage2,
          skill3: heroSkillImage3,
        },
      }));
    }

    lastSavedLayoutIdRef.current = cardToSave.layoutId;

    const nextList = editingId
      ? cards.map((c) => (c.id === cardId ? cardToSave : c))
      : [cardToSave, ...cards];
    const currentIndex = nextList.findIndex((c) => c.id === cardId);
    const remaining = nextList.slice(currentIndex + 1);

    const isTension = isTensionLayout(cardToSave.layoutId);
    const hasTitleAndDesc =
      (cardToSave.title ?? "").trim() !== "" &&
      (cardToSave.description ?? "").trim() !== "";

    // Layout de tensão (equip4 etc): não tem imagem; se título e descrição preenchidos → novo card
    if (isTension && hasTitleAndDesc) {
      if (descriptionFormatTimeoutRef.current) {
        clearTimeout(descriptionFormatTimeoutRef.current);
        descriptionFormatTimeoutRef.current = null;
      }
      descriptionRef.current = "";
      setForm(createEquip4FormStateWithPreservedConfig(cardToSave));
      setOverlayImage(null);
      setEditingId(null);
      setStatusMessage(
        "Card salvo! Novo card criado. Preencha título e descrição.",
      );
      return;
    }

    // Equipamento/arma: próximo sem título E sem imagem (overlay)
    // Tensão: próximo sem título E sem descrição
    const nextCard = remaining.find((c) => {
      if (isTensionLayout(c.layoutId)) {
        return (
          (c.title ?? "").trim() === "" && (c.description ?? "").trim() === ""
        );
      }
      if (!isEnemieLayout(c.layoutId) && !isTensionLayout(c.layoutId)) {
        return (c.title ?? "").trim() === "" && !overlayCache[c.id];
      }
      return false;
    });

    if (nextCard) {
      await handleLoadCard(nextCard);
      setStatusMessage(
        'Card salvo! Indo para o próximo sem preenchimento. Clique em "Novo card" para criar outro do zero.',
      );
    } else {
      if (descriptionFormatTimeoutRef.current) {
        clearTimeout(descriptionFormatTimeoutRef.current);
        descriptionFormatTimeoutRef.current = null;
      }
      descriptionRef.current = "";
      setForm(
        isTension
          ? createEquip4FormStateWithPreservedConfig(cardToSave)
          : createInitialFormState(cardToSave.layoutId),
      );
      setOverlayImage(null);
      setEditingId(null);
      setStatusMessage(
        "Card salvo! Novo card criado com o mesmo layout. Preencha para continuar.",
      );
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
    setHeroSkillImagesCache((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    void deleteOverlayImage(id);
    void Promise.all([
      deleteOverlayImage(`${id}-hero-skill1`),
      deleteOverlayImage(`${id}-hero-skill2`),
      deleteOverlayImage(`${id}-hero-skill3`),
    ]);
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
        tensionColor,
        bottomBarColor,
        heroRollNumber,
        heroBagNumber,
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
        tensionColor,
        bottomBarColor,
        heroRollNumber: heroRollNumber ?? "0",
        heroBagNumber: heroBagNumber ?? "0",
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
    setHeroSkillImagesCache({});
    setHeroSkillImage1(null);
    setHeroSkillImage2(null);
    setHeroSkillImage3(null);
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
          tensionColor?: string | null;
          bottomBarColor?: string | null;
          heroRollNumber?: string | null;
          heroBagNumber?: string | null;
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
            tensionColor: item.tensionColor ?? "#067427",
            bottomBarColor: item.bottomBarColor ?? "#39558E",
            heroRollNumber: item.heroRollNumber ?? "0",
            heroBagNumber: item.heroBagNumber ?? "0",
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

  const openJsonTextModal = () => {
    setJsonTextError(null);
    setJsonText(buildJsonExampleForLayout(form.layout));
    setIsJsonTextModalOpen(true);
  };

  const resolveIconFromSlot = (
    value: unknown,
    slotIndex: number,
    layoutId: string,
  ) => {
    if (!value) return { src: "", id: "" };
    const raw = String(value).trim();
    if (!raw) return { src: "", id: "" };
    const layout = getLayoutConfig(layoutId);
    const slot = layout.icons?.[slotIndex];
    const options = slot ? getOptionsForPath(slot.path) : [];

    if (raw.includes("/") || raw.endsWith(".png") || raw.endsWith(".webp")) {
      const match = options.find((o) => o.src === raw);
      return { src: raw, id: match?.id ?? "" };
    }

    const normalized = normalizeIconId(raw);
    const match = options.find(
      (o) =>
        normalizeIconId(String(o.id)) === normalized || String(o.id) === raw,
    );
    return { src: match?.src ?? "", id: match?.id ?? "" };
  };

  const handleImportJsonText = () => {
    setJsonTextError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (error) {
      console.error(error);
      setJsonTextError("JSON inválido.");
      return;
    }

    if (!Array.isArray(parsed)) {
      setJsonTextError("O JSON deve ser um array de objetos.");
      return;
    }

    const layout = getLayoutConfig(form.layout);
    const skillOptions = getSkillOptionsForLayout(layout.id);
    const allowedSkillIds = new Map<string, string>();
    skillOptions.forEach((skill) => {
      allowedSkillIds.set(normalizeIconId(String(skill.id)), String(skill.id));
    });

    const importedCards = parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        const data = item as Record<string, unknown>;
        const iconResult = resolveIconFromSlot(data.icon, 0, layout.id);
        const icon2Result = resolveIconFromSlot(data.icon2, 1, layout.id);

        const selectedSkillsRaw = Array.isArray(data.selectedSkills)
          ? data.selectedSkills.map((id) => normalizeIconId(String(id)))
          : [];
        const selectedSkills = selectedSkillsRaw
          .map((id) => allowedSkillIds.get(id))
          .filter(Boolean) as string[];

        const skillNumbers: Record<string, string> = {};
        if (data.skillNumbers && typeof data.skillNumbers === "object") {
          Object.entries(data.skillNumbers as Record<string, unknown>).forEach(
            ([key, value]) => {
              const normalized = normalizeIconId(String(key));
              const mapped = allowedSkillIds.get(normalized);
              if (!mapped) return;
              skillNumbers[mapped] = String(value ?? "").replace(/\D/g, "");
            },
          );
        }

        return {
          id: crypto.randomUUID(),
          title: String(data.title ?? ""),
          description: String(data.description ?? ""),
          description2: String(data.description2 ?? ""),
          image: layout.image,
          icon: iconResult.src,
          icon2: icon2Result.src || null,
          icon2Id: icon2Result.id || null,
          accent: DEFAULT_ACCENT,
          type: CARD_TYPE_LABEL,
          layoutId: layout.id,
          selectedSkills,
          skillNumbers,
          enemieBlueSkills: Array.isArray(data.enemieBlueSkills)
            ? (data.enemieBlueSkills as string[])
            : [],
          enemieYellowSkills: Array.isArray(data.enemieYellowSkills)
            ? (data.enemieYellowSkills as string[])
            : [],
          enemiePurpleSkills: Array.isArray(data.enemiePurpleSkills)
            ? (data.enemiePurpleSkills as string[])
            : [],
          equip3Number: String(data.equip3Number ?? ""),
          linhaDeTiro: String(data.linhaDeTiro ?? ""),
          effect2Icon: String(data.effect2Icon ?? ""),
          effect2Number: String(data.effect2Number ?? ""),
          effect3Icon: String(data.effect3Icon ?? ""),
          effect3Number: String(data.effect3Number ?? ""),
          effect4Icon: String(data.effect4Icon ?? ""),
          effect4Number: String(data.effect4Number ?? ""),
          tension1Icon: String(data.tension1Icon ?? ""),
          tension1Text: String(data.tension1Text ?? ""),
          tension2Icon: String(data.tension2Icon ?? ""),
          tension2Text: String(data.tension2Text ?? ""),
          tensionColor: String(data.tensionColor ?? "#067427"),
          bottomBarColor: String(data.bottomBarColor ?? "#39558E"),
          titleLines: Number(data.titleLines ?? 1) as 1 | 2 | 3,
          heroRollNumber: String(data.heroRollNumber ?? "0"),
          heroBagNumber: String(data.heroBagNumber ?? "0"),
          enemieRedNumber: String(data.enemieRedNumber ?? "0"),
          enemieGreenNumber: String(data.enemieGreenNumber ?? "0"),
          enemieBlueNumber: String(data.enemieBlueNumber ?? "0"),
          enemieBlueColor: Boolean(data.enemieBlueColor ?? false),
          enemieYellowColor: Boolean(data.enemieYellowColor ?? false),
          enemiePurpleColor: Boolean(data.enemiePurpleColor ?? false),
          enemieMainIcon: String(data.enemieMainIcon ?? ""),
          enemieMainIconNumber: String(data.enemieMainIconNumber ?? ""),
          enemieBlueExtraNumber: String(data.enemieBlueExtraNumber ?? ""),
          enemiePurpleExtraNumber: String(data.enemiePurpleExtraNumber ?? ""),
          enemieYellowExtraNumber: String(data.enemieYellowExtraNumber ?? ""),
          layoutPositions: layout.positions,
        } as CardDesign;
      });

    if (importedCards.length === 0) {
      setJsonTextError("Nenhum card válido encontrado.");
      return;
    }

    setCards((prev) => [...importedCards, ...prev]);
    setIsJsonTextModalOpen(false);
    setJsonTextError(null);
    setStatusMessage(`${importedCards.length} card(s) importados.`);
  };

  const circleRadius = 45;
  const circleCircumference = 2 * Math.PI * circleRadius;

  const formEnemieIconOptions =
    form.layout === "heroes" ? heroIconOptions : enemieIconOptions;

  const buildJsonExampleForLayout = (layoutId: string) => {
    const layout = getLayoutConfig(layoutId);
    const example: Record<string, unknown> = {
      title: "Exemplo de titulo",
      description: "Texto principal com IconFire no meio.",
    };

    if (layout.positions.description2) {
      example.description2 = "Segundo bloco de texto.";
    }

    if (layout.icons?.[0]) {
      example.icon = layout.icons[0]?.allowedIds?.[0] ?? "01";
    }

    if (layout.icons?.[1]) {
      example.icon2 = layout.icons[1]?.allowedIds?.[0] ?? "01";
    }

    const skillOptions = getSkillOptionsForLayout(layoutId);
    if (skillOptions.length > 0) {
      const skillId = String(skillOptions[0]?.id ?? "01");
      example.selectedSkills = [skillId];
      example.skillNumbers = { [skillId]: "1" };
    }

    if (layoutId === "equip3") {
      example.equip3Number = "1";
      example.linhaDeTiro = "LOS";
    }

    if (layoutId === "heroes") {
      example.heroRollNumber = "1";
      example.heroBagNumber = "1";
    }

    if (isTensionLayout(layoutId)) {
      example.tension1Text = "Texto tensao 1";
      example.tension2Text = "Texto tensao 2";
      example.tensionColor = "#067427";
      example.bottomBarColor = "#39558E";
    }

    if (isEnemieLayout(layoutId)) {
      example.enemieRedNumber = "1";
      example.enemieGreenNumber = "2";
      example.enemieBlueNumber = "3";
      example.enemieBlueColor = true;
      example.enemieYellowColor = false;
      example.enemiePurpleColor = false;
    }

    return JSON.stringify([example], null, 2);
  };

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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-white">Decks</p>
                <span className="text-xs uppercase tracking-[0.4em] text-slate-400">
                  {decks.length} decks
                </span>
              </div>
              <div className="flex items-center gap-2">
                {cards.length > 0 && (
                  <span className="rounded-full border border-amber-400/50 bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-amber-200">
                    Deck atual (rascunho) · {cards.length}
                  </span>
                )}
                {cards.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      resetDraft();
                      setStatusMessage(null);
                    }}
                    className="rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-red-200 transition hover:border-red-300"
                  >
                    Descartar rascunho
                  </button>
                )}
              </div>
            </div>
            {decks.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum deck salvo ainda.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {decks.map((deck) => (
                  <div
                    key={deck.id}
                    className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (cards.length > 0) {
                          setStatusMessage(
                            "Salve o deck atual antes de carregar outro.",
                          );
                          return;
                        }
                        setStatusMessage(null);
                        setCards(deck.cards ?? []);
                        setEditingId(null);
                      }}
                      className="text-xs uppercase tracking-[0.3em] text-white transition hover:text-amber-200"
                      title={`Carregar ${deck.name}`}
                    >
                      {deck.name} ({deck.cards?.length ?? 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenameDeckError(null);
                        setRenameDeckId(deck.id);
                        setRenameDeckName(deck.name);
                        setIsRenameDeckOpen(true);
                      }}
                      className="rounded-xl border border-white/20 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-200 transition hover:border-white"
                    >
                      Renomear
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
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
                onClick={openJsonTextModal}
              >
                Importar JSON (Texto)
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
                className="rounded-2xl border  bg-red-600/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-red-100 transition hover:border-red-300"
                onClick={() => void handleClearData()}
              >
                Limpar DB
              </button>
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
                            heroSkillImage1={
                              savedCard.layoutId === "heroes"
                                ? (heroSkillImagesCache[savedCard.id]?.skill1 ??
                                  null)
                                : null
                            }
                            heroSkillImage2={
                              savedCard.layoutId === "heroes"
                                ? (heroSkillImagesCache[savedCard.id]?.skill2 ??
                                  null)
                                : null
                            }
                            heroSkillImage3={
                              savedCard.layoutId === "heroes"
                                ? (heroSkillImagesCache[savedCard.id]?.skill3 ??
                                  null)
                                : null
                            }
                            htmlId={`thumb-${savedCard.id}`}
                            iconOptionsA={iconOptionsA}
                            skillIconOptions={getSkillOptionsForLayout(
                              savedCard.layoutId,
                            )}
                            enemieIconOptions={enemieIconOptions}
                            heroIconOptions={heroIconOptions}
                            inlineIconMap={inlineIconMap}
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
          <div className="order-1 space-y-6 rounded-3xl border-white/10 bg-black/40 p-6 shadow-xl">
            <div className="flex flex-col gap-3">
              <h2 className="text-2xl font-semibold">Conteúdo do card</h2>
            </div>

            <div className="space-y-4">
              <div className="flex w-full min-w-0 flex-col gap-2 text-sm text-slate-300">
                <span>Layout</span>
                <div className="mb-2 flex gap-2">
                  {layoutCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setLayoutCategory(category.id)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        layoutCategory === category.id
                          ? "bg-amber-500 text-black"
                          : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                      }`}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
                <div
                  className="grid w-full min-w-[220px] gap-2 overflow-x-auto overflow-y-auto rounded-2xl border border-white/10 bg-black/50 p-2"
                  style={{
                    maxHeight: 220,
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(100px, 1fr))",
                  }}
                >
                  {layoutOptions
                    .filter(
                      (option) =>
                        (option.categoryId ?? "resident") === layoutCategory,
                    )
                    .map((option) => {
                      const layoutConfig = getLayoutConfig(option.id);
                      const isEnemie = isEnemieLayout(option.id);
                      const dims = isEnemie
                        ? ENEMIE_OUTER_DIMENSIONS
                        : OUTER_DIMENSIONS;
                      const layoutScale = 100 / dims.width;
                      const thumbW = 100;
                      const thumbH = Math.round(dims.height * layoutScale);
                      const isSelected = form.layout === option.id;
                      const isEquip3 = isEquipWithEffectsLayout(option.id);
                      const layoutIconSlots = getLayoutIconSlots(layoutConfig);
                      const icon1Slot = layoutIconSlots[0];
                      const icon2Slot = layoutIconSlots[1];
                      const icon1Allowed = new Set(
                        (icon1Slot?.allowedIds ?? [])
                          .map(normalizeIconId)
                          .filter(Boolean),
                      );
                      const icon2Allowed = new Set(
                        (icon2Slot?.allowedIds ?? [])
                          .map(normalizeIconId)
                          .filter(Boolean),
                      );
                      const icon1OptionsRaw = icon1Slot
                        ? getOptionsForPath(icon1Slot.path)
                        : iconOptionsA;
                      const icon2OptionsRaw = icon2Slot
                        ? getOptionsForPath(icon2Slot.path)
                        : iconOptionsB;
                      const icon1Options =
                        icon1Allowed.size > 0
                          ? icon1OptionsRaw.filter((item) =>
                              isIconAllowed(item, icon1Allowed),
                            )
                          : icon1OptionsRaw;
                      const icon2Options =
                        icon2Allowed.size > 0
                          ? icon2OptionsRaw.filter((item) =>
                              isIconAllowed(item, icon2Allowed),
                            )
                          : icon2OptionsRaw;
                      const layoutPreviewCard: Omit<CardDesign, "id"> = {
                        ...previewCard,
                        layoutId: option.id,
                        layoutPositions: layoutConfig.positions,
                        image: option.image,
                        icon:
                          option.id === "equip3-equip"
                            ? "/models/icons/A/03.png"
                            : isEquip3 || isEnemie
                              ? ""
                              : option.id === "equip4"
                                ? form.icon
                                : (icon1Options[0]?.src ?? form.icon),
                        icon2: Boolean(icon2Slot)
                          ? (icon2Options[0]?.src ?? form.icon2)
                          : null,
                        icon2Id: Boolean(icon2Slot)
                          ? (icon2Options[0]?.id ?? form.icon2Id)
                          : null,
                        linhaDeTiro: isEquip3 ? "LOS" : form.linhaDeTiro,
                        effect2Icon:
                          effect2IconOptions[0]?.id ?? form.effect2Icon,
                        effect2Number: "1",
                        effect3Icon:
                          effect3IconOptions[0]?.id ?? form.effect3Icon,
                        effect3Number: "",
                        effect4Icon:
                          effect4IconOptions[0]?.id ?? form.effect4Icon,
                        effect4Number: "1",
                      };
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => {
                            const selected = getLayoutConfig(option.id);
                            const isEquip3Click = isEquipWithEffectsLayout(
                              selected.id,
                            );
                            const isEquip3EquipClick =
                              selected.id === "equip3-equip";
                            const hasIcon2 = Boolean(icon2Slot);
                            const defaultIcon1 = icon1Options[0]?.src ?? "";
                            setForm((prev) => ({
                              ...prev,
                              layout: selected.id,
                              image: selected.image,
                              icon: isEquip3EquipClick
                                ? "/models/icons/A/03.png"
                                : isEquip3Click || selected.id === "equip4"
                                  ? ""
                                  : prev.icon || defaultIcon1,
                              icon2: hasIcon2 ? prev.icon2 : "",
                              icon2Id: hasIcon2 ? prev.icon2Id : "",
                              ...(selected.id === "equip4" &&
                                !(prev.title ?? "").trim() && {
                                  title: "TUDO LIMPO",
                                }),
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
                            position: "relative",
                          }}
                          title={option.label}
                        >
                          <div
                            className="absolute left-0 top-0 origin-top-left"
                            style={{
                              width: dims.width,
                              height: dims.height,
                              transform: `scale(${layoutScale})`,
                            }}
                          >
                            <CardPreview
                              card={layoutPreviewCard}
                              overlayImage={null}
                              isLayoutPreview
                              htmlId={`layout-preview-${option.id}`}
                              iconOptionsA={iconOptionsA}
                              skillIconOptions={getSkillOptionsForLayout(
                                option.id,
                              )}
                              effect2IconOptions={effect2IconOptions}
                              effect3IconOptions={effect3IconOptions}
                              effect4IconOptions={effect4IconOptions}
                              effectIconOptions04={effectIconOptions04}
                              tensionIconOptions={tensionIconOptions}
                              enemieIconOptions={enemieIconOptions}
                              heroIconOptions={heroIconOptions}
                              inlineIconMap={inlineIconMap}
                              showDebugBackground={false}
                            />
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
              {form.layout === "equip4" && (
                <>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-slate-300">
                      Tension Color
                    </span>
                    <div className="flex justify-around">
                      {[
                        { value: "#067427", label: "1" },
                        { value: "#B26E29", label: "2" },
                        { value: "#A63E26", label: "3" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              tensionColor: opt.value,
                            }))
                          }
                          className={`h-10 w-10 shrink-0 rounded-xl border-2 transition ${
                            form.tensionColor === opt.value
                              ? "border-amber-400 ring-2 ring-amber-400/50"
                              : "border-white/20 hover:border-white/50"
                          }`}
                          style={{ backgroundColor: opt.value }}
                          title={opt.value}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-slate-300">
                      Cor das barras inferiores
                    </span>
                    <div className="flex justify-around">
                      {[
                        {
                          value: "#39558E",
                          label: "1",
                          bgImage: "/models/layout/Bottom-Icon-A.png",
                        },
                        {
                          value: "#C7C554",
                          label: "2",
                          bgImage: "/models/layout/Bottom-Icon-B.png",
                        },
                        {
                          value: "#512D71",
                          label: "3",
                          bgImage: "/models/layout/Bottom-Icon-C.png",
                        },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              bottomBarColor: opt.value,
                            }))
                          }
                          className={`h-10 w-10 shrink-0 rounded-xl border-2 transition ${
                            form.bottomBarColor === opt.value
                              ? "border-amber-400 ring-2 ring-amber-400/50"
                              : "border-white/20 hover:border-white/50"
                          }`}
                          style={{
                            backgroundImage: `url("${opt.bgImage}")`,
                            backgroundSize: "100% 100%",
                            backgroundPosition: "center",
                            backgroundRepeat: "no-repeat",
                          }}
                          title={opt.value}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-slate-300">
                      Ícone
                    </span>
                    <div className="flex flex-wrap justify-around items-center gap-2">
                      {iconOptionsD.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              icon: prev.icon === item.src ? "" : item.src,
                            }))
                          }
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 transition overflow-hidden ${
                            form.icon === item.src
                              ? "border-amber-400 ring-2 ring-amber-400/50"
                              : "border-white/20 hover:border-white/50"
                          }`}
                          style={{ backgroundColor: "#E3C590" }}
                        >
                          <img
                            src={item.src}
                            alt={item.label}
                            className="h-6 w-6 object-contain"
                            style={{ filter: ICON_OUTLINE_FILTER }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-slate-300">
                      Ícone adicional
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          icon2:
                            prev.icon2 === "/models/icons/B/04.png"
                              ? ""
                              : "/models/icons/B/04.png",
                          icon2Id:
                            prev.icon2 === "/models/icons/B/04.png" ? "" : "04",
                        }))
                      }
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 transition ${
                        form.icon2 === "/models/icons/B/04.png"
                          ? "border-amber-400 ring-2 ring-amber-400/50"
                          : "border-white/20 hover:border-white/50"
                      }`}
                      style={{ backgroundColor: "#E3C590" }}
                    >
                      <img
                        src="/models/icons/B/04.png"
                        alt="Ícone 04"
                        className="h-6 w-6 object-contain"
                      />
                    </button>
                  </div>
                </>
              )}
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {getLayoutConfig(form.layout).positions.title.label ??
                      "Título"}{" "}
                    (Enter quebra a linha)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        titleLines: (((prev.titleLines ?? 1) % 3) + 1) as
                          | 1
                          | 2
                          | 3,
                      }))
                    }
                    className="shrink-0 rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
                  >
                    Linhas {form.titleLines ?? 1}
                  </button>
                </div>
                <textarea
                  rows={1}
                  placeholder="Lançamento imperdível"
                  value={form.title || ""}
                  className="rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-base text-white outline-none transition focus:border-slate-300 resize-none"
                  onFocus={(e) => {
                    if (form.title === "TUDO LIMPO") {
                      (e.target as HTMLTextAreaElement).select();
                    }
                  }}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                />
              </label>
              {form.layout !== "equip3" && (
                <label className="flex flex-col gap-2 text-sm text-slate-300">
                  {form.layout.startsWith("mh") ? (
                    <span className="flex items-center gap-2">
                      {getLayoutConfig(form.layout).positions.description1
                        ?.label ?? "Descrição 1"}
                      <span className="inline-block h-3 w-3 rounded-full bg-red-500/70" />
                    </span>
                  ) : (
                    (getLayoutConfig(form.layout).positions.description
                      ?.label ?? "Descrição (Enter quebra a linha)")
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setStatusMessage(
                        "Códigos: IconFire, IconIce, IconWater, IconThunder, IconDragon (variações minúsculas também)",
                      )
                    }
                    className="self-start rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-200 transition hover:border-white"
                  >
                    Ver códigos
                  </button>
                  <textarea
                    ref={descriptionTextareaRef}
                    rows={3}
                    placeholder="Conte um pouco mais sobre a campanha..."
                    value={form.description || ""}
                    className="rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm leading-relaxed text-white outline-none transition focus:border-slate-300 overflow-hidden resize-y min-h-[80px]"
                    style={{ minHeight: 80 }}
                    title="Códigos: IconFire, IconIce, IconWater, IconThunder, IconDragon (variações minúsculas também)"
                    onChange={(event) => {
                      const v = event.target.value;
                      descriptionRef.current = v;
                      if (descriptionFormatTimeoutRef.current) {
                        clearTimeout(descriptionFormatTimeoutRef.current);
                      }
                      setForm((prev) => ({ ...prev, description: v }));
                      descriptionFormatTimeoutRef.current = setTimeout(() => {
                        if (form.layout.startsWith("mh")) return;
                        setForm((prev) => ({
                          ...prev,
                          description: formatDescription(
                            descriptionRef.current,
                          ),
                        }));
                      }, 3000);
                    }}
                  />
                </label>
              )}
              {getLayoutConfig(form.layout).positions.description2 && (
                <label className="flex flex-col gap-2 text-sm text-slate-300">
                  <span className="flex items-center gap-2">
                    {getLayoutConfig(form.layout).positions.description2
                      ?.label ?? "Descrição 2"}
                    <span className="inline-block h-3 w-3 rounded-full bg-blue-500/70" />
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setStatusMessage(
                        "Códigos: IconFire, IconIce, IconWater, IconThunder, IconDragon (variações minúsculas também)",
                      )
                    }
                    className="self-start rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-slate-200 transition hover:border-white"
                  >
                    Ver códigos
                  </button>
                  <textarea
                    rows={3}
                    placeholder="Texto da segunda área de descrição..."
                    value={form.description2 || ""}
                    className="rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm leading-relaxed text-white outline-none transition focus:border-slate-300 overflow-hidden resize-y min-h-[80px]"
                    style={{ minHeight: 80 }}
                    title="Códigos: IconFire, IconIce, IconWater, IconThunder, IconDragon (variações minúsculas também)"
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        description2: event.target.value,
                      }))
                    }
                  />
                </label>
              )}
              {form.layout !== "equip3" &&
                form.layout !== "equip3-equip" &&
                !isTensionLayout(form.layout) &&
                !isEnemieLayout(form.layout) &&
                showLayoutIcons && (
                  <div className="space-y-6">
                    {layoutIconSlots.map((slot, index) => {
                      const optionsRaw = getOptionsForPath(slot.path);
                      const allowedSet = new Set(
                        (slot.allowedIds ?? [])
                          .map(normalizeIconId)
                          .filter(Boolean),
                      );
                      const options =
                        allowedSet.size > 0
                          ? optionsRaw.filter((item) =>
                              isIconAllowed(item, allowedSet),
                            )
                          : optionsRaw;
                      const isIcon1 = index === 0;
                      const isIcon2 = index === 1;
                      if (!isIcon1 && !isIcon2) return null;
                      const selectedSrc = isIcon2 ? form.icon2 : form.icon;
                      return (
                        <div key={index} className="space-y-3">
                          <h3 className="text-xl font-semibold">
                            {slot.label}
                          </h3>
                          <div className="flex flex-wrap justify-around items-center gap-3">
                            {options.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() =>
                                  setForm((prev) =>
                                    isIcon2
                                      ? {
                                          ...prev,
                                          icon2: item.src,
                                          icon2Id: item.id,
                                        }
                                      : { ...prev, icon: item.src },
                                  )
                                }
                                className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${
                                  selectedSrc === item.src
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
                      );
                    })}
                  </div>
                )}

              {form.layout !== "equip3" &&
                form.layout !== "equip3-equip" &&
                !isTensionLayout(form.layout) &&
                !isEnemieLayout(form.layout) && (
                  <div className="space-y-3">
                    <h3 className="text-xl font-semibold">
                      {getLayoutConfig(form.layout).skillsConfig?.label ??
                        "Skills"}
                    </h3>
                    <div className="flex flex-wrap justify-around items-center gap-4">
                      {skillOptionsForCurrentLayout.map((skill) => {
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
                                TOOLTIP_SKILL_NUMBER[
                                  String(Number(skill.id))
                                ] ?? skill.label
                              }
                            >
                              <img
                                src={skill.src}
                                alt={skill.label}
                                className="h-6 w-6 object-contain"
                                style={{ filter: ICON_OUTLINE_FILTER }}
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
                                    [skill.id]: e.target.value.replace(
                                      /\D/g,
                                      "",
                                    ),
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
                    <div className="flex flex-wrap justify-around items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 text-xs uppercase tracking-[0.3em] text-slate-300">
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
              {(form.layout === "equip3" || form.layout === "equip3-equip") && (
                <>
                  {form.layout === "equip3" && (
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
                  )}

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
                              style={{ filter: ICON_OUTLINE_FILTER }}
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

                    <div className="flex flex-wrap justify-around items-center gap-4">
                      {(form.layout === "equip3-equip"
                        ? effectIconOptions04.filter(
                            (o) =>
                              EQUIP3_EQUIP_SELECTABLE_SKILL_IDS.includes(
                                String(o.id).padStart(2, "0"),
                              ) ||
                              EQUIP3_EQUIP_SELECTABLE_SKILL_IDS.includes(
                                String(o.id),
                              ),
                          )
                        : effectIconOptions04
                      ).map((item) => {
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
                                  let next: string[];
                                  if (form.layout === "equip3-equip") {
                                    if (exists) {
                                      next = prev.selectedSkills.filter(
                                        (id) => id !== item.id,
                                      );
                                    } else {
                                      next = [
                                        ...prev.selectedSkills.filter(
                                          (id) =>
                                            !EQUIP3_EQUIP_SELECTABLE_SKILL_IDS.includes(
                                              String(id).padStart(2, "0"),
                                            ) &&
                                            !EQUIP3_EQUIP_SELECTABLE_SKILL_IDS.includes(
                                              String(id),
                                            ),
                                        ),
                                        item.id,
                                      ];
                                    }
                                  } else {
                                    next = exists
                                      ? prev.selectedSkills.filter(
                                          (id) => id !== item.id,
                                        )
                                      : [...prev.selectedSkills, item.id];
                                  }
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
                                    [item.id]: e.target.value.replace(
                                      /\D/g,
                                      "",
                                    ),
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
                      {(form.layout === "equip3-equip"
                        ? form.selectedSkills.filter(
                            (id) =>
                              EQUIP3_EQUIP_SELECTABLE_SKILL_IDS.includes(
                                String(id).padStart(2, "0"),
                              ) ||
                              EQUIP3_EQUIP_SELECTABLE_SKILL_IDS.includes(
                                String(id),
                              ),
                          )
                        : form.selectedSkills
                      ).length === 0
                        ? ""
                        : (form.layout === "equip3-equip"
                            ? form.selectedSkills.filter(
                                (id) =>
                                  EQUIP3_EQUIP_SELECTABLE_SKILL_IDS.includes(
                                    String(id).padStart(2, "0"),
                                  ) ||
                                  EQUIP3_EQUIP_SELECTABLE_SKILL_IDS.includes(
                                    String(id),
                                  ),
                              )
                            : form.selectedSkills
                          ).map((skillId) => {
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
                  {(hasEnemieIconLayout(form.layout) ||
                    form.layout === "enemie2") && (
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-slate-300">
                        {form.layout === "heroes"
                          ? "Ícone do herói"
                          : "Ícone do inimigo"}
                      </span>
                      <p className="text-xs text-slate-400">
                        {form.layout === "heroes"
                          ? "Ícones da pasta Heroes (carregados automaticamente)"
                          : "Ícones da pasta Enemies/Icons"}
                      </p>
                      <div className="flex flex-wrap justify-around items-center gap-2">
                        {(form.layout === "heroes"
                          ? heroIconOptions
                          : enemieMainIconOptions
                        ).map((icon) => {
                          const src = icon.src ?? "";
                          const isSelected =
                            form.enemieMainIcon === src ||
                            form.enemieMainIcon === icon.id;
                          return (
                            <button
                              key={icon.id}
                              type="button"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  enemieMainIcon: isSelected ? "" : src,
                                }))
                              }
                              className={`flex h-12 w-12 items-center justify-center rounded-lg transition ${
                                form.layout === "heroes"
                                  ? `${isSelected ? "border-2 border-amber-400" : "border border-white/40 hover:border-amber-400"}`
                                  : isSelected
                                    ? "border-2 border-amber-400 bg-amber-500/20"
                                    : "border border-white/20 bg-white/5 hover:border-white/40"
                              }`}
                              title={icon.label}
                              style={
                                form.layout === "heroes"
                                  ? { backgroundColor: "#EFDDB9" }
                                  : undefined
                              }
                            >
                              {src ? (
                                <img
                                  src={src}
                                  alt={icon.label}
                                  className="h-8 w-8 object-contain"
                                />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {form.layout === "enemie" && (
                    <>
                      <h3 className="text-xl font-semibold">Skills por cor</h3>
                      <p className="text-sm text-slate-400">
                        Clique no ícone para adicionar à cor. O número digitado
                        abaixo do ícone 06 será exibido na frente dele no card.
                      </p>
                      <div className="flex flex-wrap justify-around items-center gap-4">
                        {/* Azul */}
                        <div className="flex-1 min-w-[320px] space-y-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
                          <div className="grid grid-cols-6 place-items-center gap-2">
                            {formEnemieIconOptions
                              .filter((icon) => !isIcon02(icon))
                              .map((icon) => {
                                const list = form.enemieBlueSkills ?? [];
                                const has06 = hasEnemie06InSkills(
                                  formEnemieIconOptions,
                                  list,
                                );
                                const is06 = isIcon06(icon);
                                const is01 = isIcon01(icon);
                                const icon02 =
                                  formEnemieIconOptions.find(isIcon02);
                                const id02 = icon02?.id ?? icon02?.src ?? "02";
                                const isSelected = is06
                                  ? list.includes(icon.id) ||
                                    list.includes(icon.src ?? "") ||
                                    has06
                                  : is01
                                    ? list.some(
                                        (id) => isId01(id) || isId02(id),
                                      )
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
                                          const list =
                                            prev.enemieBlueSkills ?? [];
                                          const has06 = hasEnemie06InSkills(
                                            formEnemieIconOptions,
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
                                          } else if (is01) {
                                            const has01 = list.some(
                                              (id) => isId01(id) || isId02(id),
                                            );
                                            next = has01
                                              ? list.filter(
                                                  (id) =>
                                                    !isId01(id) && !isId02(id),
                                                )
                                              : [...list, icon.id, id02];
                                          } else {
                                            const exists = list.some(
                                              (id) =>
                                                id === icon.id ||
                                                id === icon.src,
                                            );
                                            next = exists
                                              ? list.filter(
                                                  (id) =>
                                                    id !== icon.id &&
                                                    id !== icon.src,
                                                )
                                              : [...list, icon.id];
                                          }
                                          return {
                                            ...prev,
                                            enemieBlueSkills: next,
                                          };
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
                                        inputMode={is01 ? "text" : "numeric"}
                                        value={
                                          form.skillNumbers?.[
                                            `enemie-blue-${is06 && has06 ? "06" : skillId}`
                                          ] ??
                                          (is06 && has06
                                            ? form.enemieBlueExtraNumber
                                            : undefined) ??
                                          ""
                                        }
                                        onChange={(e) => {
                                          const key =
                                            is06 && has06 ? "06" : skillId;
                                          const val = is01
                                            ? e.target.value
                                                .toUpperCase()
                                                .replace(/[^0-9A-Za-z]/g, "")
                                                .slice(0, 5)
                                            : e.target.value.replace(/\D/g, "");
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
                                        placeholder={is01 ? "Nº ou LOS" : "Nº"}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                        {/* Roxo */}
                        <div className="flex-1 min-w-[320px] space-y-2 rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
                          <div className="grid grid-cols-6 place-items-center gap-2">
                            {formEnemieIconOptions
                              .filter((icon) => !isIcon02(icon))
                              .map((icon) => {
                                const list = form.enemiePurpleSkills ?? [];
                                const has06 = hasEnemie06InSkills(
                                  formEnemieIconOptions,
                                  list,
                                );
                                const is06 = isIcon06(icon);
                                const is01 = isIcon01(icon);
                                const icon02 =
                                  formEnemieIconOptions.find(isIcon02);
                                const id02 = icon02?.id ?? icon02?.src ?? "02";
                                const isSelected = is06
                                  ? list.includes(icon.id) ||
                                    list.includes(icon.src ?? "") ||
                                    has06
                                  : is01
                                    ? list.some(
                                        (id) => isId01(id) || isId02(id),
                                      )
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
                                          const list =
                                            prev.enemiePurpleSkills ?? [];
                                          const has06 = hasEnemie06InSkills(
                                            formEnemieIconOptions,
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
                                          } else if (is01) {
                                            const has01 = list.some(
                                              (id) => isId01(id) || isId02(id),
                                            );
                                            next = has01
                                              ? list.filter(
                                                  (id) =>
                                                    !isId01(id) && !isId02(id),
                                                )
                                              : [...list, icon.id, id02];
                                          } else {
                                            const exists = list.some(
                                              (id) =>
                                                id === icon.id ||
                                                id === icon.src,
                                            );
                                            next = exists
                                              ? list.filter(
                                                  (id) =>
                                                    id !== icon.id &&
                                                    id !== icon.src,
                                                )
                                              : [...list, icon.id];
                                          }
                                          return {
                                            ...prev,
                                            enemiePurpleSkills: next,
                                          };
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
                                        inputMode={is01 ? "text" : "numeric"}
                                        value={
                                          form.skillNumbers?.[
                                            `enemie-purple-${is06 && has06 ? "06" : skillId}`
                                          ] ??
                                          (is06 && has06
                                            ? form.enemiePurpleExtraNumber
                                            : undefined) ??
                                          ""
                                        }
                                        onChange={(e) => {
                                          const key =
                                            is06 && has06 ? "06" : skillId;
                                          const val = is01
                                            ? e.target.value
                                                .toUpperCase()
                                                .replace(/[^0-9A-Za-z]/g, "")
                                                .slice(0, 5)
                                            : e.target.value.replace(/\D/g, "");
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
                                        placeholder={is01 ? "Nº ou LOS" : "Nº"}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                        {/* Amarelo */}
                        <div className="flex-1 min-w-[320px] space-y-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                          <div className="grid grid-cols-6 place-items-center gap-2">
                            {formEnemieIconOptions
                              .filter((icon) => !isIcon02(icon))
                              .map((icon) => {
                                const list = form.enemieYellowSkills ?? [];
                                const has06 = hasEnemie06InSkills(
                                  formEnemieIconOptions,
                                  list,
                                );
                                const is06 = isIcon06(icon);
                                const is01 = isIcon01(icon);
                                const icon02 =
                                  formEnemieIconOptions.find(isIcon02);
                                const id02 = icon02?.id ?? icon02?.src ?? "02";
                                const isSelected = is06
                                  ? list.includes(icon.id) ||
                                    list.includes(icon.src ?? "") ||
                                    has06
                                  : is01
                                    ? list.some(
                                        (id) => isId01(id) || isId02(id),
                                      )
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
                                          const list =
                                            prev.enemieYellowSkills ?? [];
                                          const has06 = hasEnemie06InSkills(
                                            formEnemieIconOptions,
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
                                          } else if (is01) {
                                            const has01 = list.some(
                                              (id) => isId01(id) || isId02(id),
                                            );
                                            next = has01
                                              ? list.filter(
                                                  (id) =>
                                                    !isId01(id) && !isId02(id),
                                                )
                                              : [...list, icon.id, id02];
                                          } else {
                                            const exists = list.some(
                                              (id) =>
                                                id === icon.id ||
                                                id === icon.src,
                                            );
                                            next = exists
                                              ? list.filter(
                                                  (id) =>
                                                    id !== icon.id &&
                                                    id !== icon.src,
                                                )
                                              : [...list, icon.id];
                                          }
                                          return {
                                            ...prev,
                                            enemieYellowSkills: next,
                                          };
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
                                        inputMode={is01 ? "text" : "numeric"}
                                        value={
                                          form.skillNumbers?.[
                                            `enemie-yellow-${is06 && has06 ? "06" : skillId}`
                                          ] ??
                                          (is06 && has06
                                            ? form.enemieYellowExtraNumber
                                            : undefined) ??
                                          ""
                                        }
                                        onChange={(e) => {
                                          const key =
                                            is06 && has06 ? "06" : skillId;
                                          const val = is01
                                            ? e.target.value
                                                .toUpperCase()
                                                .replace(/[^0-9A-Za-z]/g, "")
                                                .slice(0, 5)
                                            : e.target.value.replace(/\D/g, "");
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
                                        placeholder={is01 ? "Nº ou LOS" : "Nº"}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {statusMessage && (
                <div className="rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-slate-200">
                  {statusMessage}
                </div>
              )}
            </div>
          </div>
          <div className="order-2 flex flex-col items-center gap-5 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl self-start">
            <div className="overflow-x-auto" style={{ width: "100%" }}>
              <CardPreview
                card={previewCard}
                overlayImage={overlayImage}
                heroSkillImage1={
                  form.layout === "heroes" ? heroSkillImage1 : null
                }
                heroSkillImage2={
                  form.layout === "heroes" ? heroSkillImage2 : null
                }
                heroSkillImage3={
                  form.layout === "heroes" ? heroSkillImage3 : null
                }
                htmlId="preview-card"
                iconOptionsA={iconOptionsA}
                skillIconOptions={getSkillOptionsForLayout(form.layout)}
                enemieIconOptions={enemieIconOptions}
                heroIconOptions={heroIconOptions}
                inlineIconMap={inlineIconMap}
                effect2IconOptions={effect2IconOptions}
                effect3IconOptions={effect3IconOptions}
                effect4IconOptions={effect4IconOptions}
                effectIconOptions04={effectIconOptions04}
                tensionIconOptions={tensionIconOptions}
              />
            </div>
          </div>
        </section>

        {/* Botões flutuantes: Tutorial (?), Importar, Salvar deck, Salvar card, Baixar */}
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col gap-3"
          aria-label="Ações do card"
        >
          <button
            type="button"
            onClick={() => setIsTutorialModalOpen(true)}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/30 bg-slate-800/95 text-white backdrop-blur-sm transition hover:scale-105 hover:border-white"
            title="Tutorial"
            aria-label="Abrir tutorial"
          >
            <FaQuestionCircle className="h-6 w-6" />
          </button>
          <Link
            href="/tutorials"
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/30 bg-slate-800/95 text-white backdrop-blur-sm transition hover:scale-105 hover:border-white"
            title="Editar tutoriais"
            aria-label="Editar tutoriais"
          >
            <FaEdit className="h-6 w-6" />
          </Link>
          <button
            type="button"
            onClick={openJsonTextModal}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/30 bg-slate-800/95 text-white backdrop-blur-sm transition hover:scale-105 hover:border-white"
            title="Importar JSON"
            aria-label="Importar JSON"
          >
            <FaFileImport className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => {
              setDeckError(null);
              setIsDeckModalOpen(true);
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/30 bg-slate-800/95 text-white backdrop-blur-sm transition hover:scale-105 hover:border-white"
            title="Salvar deck"
            aria-label="Salvar deck"
          >
            <FaArchive className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => void handleSaveCard()}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/40 transition hover:scale-110 hover:shadow-xl"
            title="Salvar card"
          >
            <FaSave className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() =>
              handleDownload(
                "preview-card",
                `card-${form.title || "sem-titulo"}.png`,
              )
            }
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/30 bg-slate-800/95 text-white backdrop-blur-sm transition hover:scale-110 hover:border-white"
            title="Baixar PNG"
          >
            <FaDownload className="h-6 w-6" />
          </button>
        </div>

        {isDeckModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6">
            <div className="w-full max-w-2xl rounded-3xl border border-white/20 bg-slate-900/95 p-6 shadow-2xl">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-semibold text-white">
                  Salvar Deck
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsDeckModalOpen(false);
                    setDeckError(null);
                  }}
                  className="h-8 w-8 rounded-full border border-white/20 text-white transition hover:border-white"
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                Salve os cards atuais como um deck reutilizável.
              </p>
              {decks.some(
                (d) => d.name.toLowerCase() === deckName.trim().toLowerCase(),
              ) && (
                <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  Este nome já existe. O deck será atualizado.
                </div>
              )}
              <input
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                className="mt-4 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400"
                placeholder="Nome do deck"
              />
              {deckError && (
                <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {deckError}
                </div>
              )}
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeckModalOpen(false);
                    setDeckError(null);
                  }}
                  className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveDeck}
                  className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {isRenameDeckOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6">
            <div className="w-full max-w-xl rounded-3xl border border-white/20 bg-slate-900/95 p-6 shadow-2xl">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-semibold text-white">
                  Renomear Deck
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsRenameDeckOpen(false);
                    setRenameDeckError(null);
                  }}
                  className="h-8 w-8 rounded-full border border-white/20 text-white transition hover:border-white"
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
              <input
                value={renameDeckName}
                onChange={(e) => setRenameDeckName(e.target.value)}
                className="mt-4 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400"
                placeholder="Novo nome do deck"
              />
              {renameDeckError && (
                <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {renameDeckError}
                </div>
              )}
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsRenameDeckOpen(false);
                    setRenameDeckError(null);
                  }}
                  className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleRenameDeck}
                  className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
                >
                  Renomear
                </button>
              </div>
            </div>
          </div>
        )}

        {isTutorialModalOpen &&
          (() => {
            const tutorialGameKey = layoutCategory === "monster" ? "MH" : "RE3";
            const tutorialPages =
              layoutCategory === "monster"
                ? mhTutorialLayout
                : re3TutorialLayout;
            const pages = tutorialPagesState ?? tutorialPages;
            const basePath = TUTORIAL_BASE_PATHS[tutorialGameKey];
            const currentPage: TutorialPage | undefined =
              pages[tutorialPageIndex];
            const totalPages = pages.length;

            const updateTutorialTitle = (
              titleIndex: number,
              updates: Partial<TutorialBlock>,
            ) => {
              setTutorialPagesState((prev) => {
                if (!prev) return prev;
                const next = prev.slice();
                const page = next[tutorialPageIndex];
                const titles = page.titles.slice();
                titles[titleIndex] = { ...titles[titleIndex], ...updates };
                next[tutorialPageIndex] = { ...page, titles };
                return next;
              });
            };
            const updateTutorialDescription = (
              descIndex: number,
              updates: Partial<TutorialBlock>,
            ) => {
              setTutorialPagesState((prev) => {
                if (!prev) return prev;
                const next = prev.slice();
                const page = next[tutorialPageIndex];
                const descriptions = page.descriptions.slice();
                descriptions[descIndex] = {
                  ...descriptions[descIndex],
                  ...updates,
                };
                next[tutorialPageIndex] = { ...page, descriptions };
                return next;
              });
            };

            const blockStyle = (
              block: TutorialBlock,
              isEdit: boolean,
              isTitle?: boolean,
            ) => {
              const base: React.CSSProperties = {
                top: block.top,
                left: block.left,
                width: block.width ?? "auto",
                fontSize: block.fontSize,
                lineHeight: block.lineHeight ?? undefined,
                transform:
                  block.alignment === "center" ? "translateX(-50%)" : undefined,
                textAlign: block.alignment,
              };
              if (tutorialGameKey === "MH") {
                base.color = "#555543";
                base.fontFamily = TUTORIAL_MH_FONT_FAMILY;
              } else {
                base.fontFamily = TUTORIAL_RE3_FONT_FAMILY;
                base.color = block.color ?? TUTORIAL_RE3_COLOR;
                if (isTitle) base.fontWeight = "bold";
              }
            if (isTitle) {
              base.textTransform = "uppercase";
              base.WebkitTextStroke = "0.1px #000";
              base.textShadow =
                "1px 1px 0 rgba(0,0,0,0.5), -1px -1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.35)";
            }
              if (isEdit) {
                base.boxShadow = block.boxShadow
                  ? "0 0 12px rgba(0,0,0,0.8)"
                  : undefined;
                base.padding = "4px 8px";
                base.minHeight = "24px";
                base.minWidth = "40px";
                if (!block.boxShadow)
                  base.border = "2px dashed rgba(255,255,255,0.6)";
              } else if (block.boxShadow) {
                base.boxShadow = "0 0 12px rgba(0,0,0,0.8)";
                base.padding = "4px 8px";
              }
              return base;
            };

            const renderBlock = (
              block: TutorialBlock,
              kind: "title" | "desc",
              index: number,
            ) => {
              const showInView = block.text.trim();
              if (!isTutorialEditMode && !showInView) return null;
              const style = blockStyle(
                block,
                isTutorialEditMode,
                kind === "title",
              );
              const placeholder =
                kind === "title"
                  ? `Título ${index + 1}`
                  : `Descrição ${index + 1}`;
              if (isTutorialEditMode) {
                return (
                  <div
                    key={`${tutorialPageIndex}-${kind}-${index}`}
                    className={`absolute outline-none ${!block.text.trim() ? "tutorial-block-edit-empty opacity-80" : ""}`}
                    style={style}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) =>
                      kind === "title"
                        ? updateTutorialTitle(index, {
                            text: e.currentTarget.innerText,
                          })
                        : updateTutorialDescription(index, {
                            text: e.currentTarget.innerText,
                          })
                    }
                    onBlur={(e) => {
                      const t = e.currentTarget.innerText.trim();
                      const text =
                        t === placeholder ? "" : e.currentTarget.innerText;
                      if (kind === "title")
                        updateTutorialTitle(index, { text });
                      else updateTutorialDescription(index, { text });
                    }}
                    data-placeholder={placeholder}
                  >
                    {block.text}
                  </div>
                );
              }
              return (
                <div
                  key={`${kind}-${index}`}
                  className="absolute"
                  style={style}
                >
                  {renderTextWithBoldAndIcons(block.text, 24, inlineIconMap)}
                </div>
              );
            };

            return (
              <div
                className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6"
                aria-modal="true"
                aria-labelledby="tutorial-modal-title"
              >
                <div className="flex w-full max-w-4xl flex-col rounded-3xl border border-white/20 bg-slate-900/95 shadow-2xl">
                  <div className="flex items-center justify-between gap-4 p-4">
                    <h2
                      id="tutorial-modal-title"
                      className="text-xl font-semibold text-white"
                    >
                      Tutorial{" "}
                      {layoutCategory === "monster"
                        ? "Monster Hunter"
                        : "Resident Evil"}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsTutorialEditMode((e) => !e)}
                        className="rounded-xl border border-white/20 bg-white/5 px-3 py-1.5 text-sm text-white transition hover:border-white"
                      >
                        {isTutorialEditMode ? "Visualizar" : "Editar"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const gameKey =
                            layoutCategory === "monster" ? "MH" : "RE3";
                          const pages = tutorialPagesState;
                          if (pages && pages.length > 0) {
                            const fallback = {
                              RE3: re3TutorialLayout,
                              MH: mhTutorialLayout,
                            };
                            const saved =
                              await getTutorialPagesFromDb(fallback);
                            saved[gameKey] = JSON.parse(JSON.stringify(pages));
                            await saveTutorialPagesToDb(saved);
                          }
                          setIsTutorialModalOpen(false);
                          setTutorialPageIndex(0);
                          setIsTutorialEditMode(false);
                        }}
                        className="h-8 w-8 rounded-full border border-white/20 text-white transition hover:border-white"
                        aria-label="Fechar tutorial"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="relative min-h-[400px] overflow-hidden rounded-b-3xl p-4">
                    {currentPage ? (
                      <>
                        <div className="relative mx-auto aspect-[3/4] max-h-[70vh] w-full max-w-2xl overflow-hidden rounded-xl bg-slate-800">
                          {currentPage.backgroundImageDataUrl ? (
                            <img
                              src={currentPage.backgroundImageDataUrl}
                              alt=""
                              className="h-full w-full object-contain object-top"
                            />
                          ) : currentPage.imagePath ? (
                            <img
                              src={`${basePath}/${currentPage.imagePath}`}
                              alt=""
                              className="h-full w-full object-contain object-top"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-700/80 text-slate-500 text-sm">
                              Sem imagem de fundo
                            </div>
                          )}
                          {currentPage.titles.map((block, i) =>
                            renderBlock(block, "title", i),
                          )}
                          {currentPage.descriptions.map((block, i) =>
                            renderBlock(block, "desc", i),
                          )}
                          {currentPage.pageNumber?.show && (
                            <div
                              className="absolute"
                              style={{
                                top: currentPage.pageNumber.top,
                                left: currentPage.pageNumber.left,
                                fontSize:
                                  currentPage.pageNumber.fontSize ?? "1rem",
                                fontWeight: "bold",
                                transform:
                                  (currentPage.pageNumber.alignment ??
                                    "center") === "center"
                                    ? "translateX(-50%)"
                                    : undefined,
                                textAlign:
                                  currentPage.pageNumber.alignment ?? "center",
                                color:
                                  tutorialGameKey === "MH"
                                    ? "#555543"
                                    : TUTORIAL_RE3_COLOR,
                                fontFamily:
                                  tutorialGameKey === "MH"
                                    ? TUTORIAL_MH_FONT_FAMILY
                                    : TUTORIAL_RE3_FONT_FAMILY,
                              }}
                            >
                              {tutorialPageIndex + 1}
                            </div>
                          )}
                        </div>
                        {isTutorialEditMode && currentPage && (
                          <div className="mt-4 rounded-xl border border-white/20 bg-slate-800/80 p-4">
                            <p className="mb-3 text-sm font-medium text-slate-300">
                              Posição dos blocos (top, left)
                            </p>
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                              {currentPage.titles.map((b, i) => (
                                <div
                                  key={`t-${i}`}
                                  className="flex flex-col gap-1"
                                >
                                  <span className="text-xs text-slate-400">
                                    Título {i + 1}
                                  </span>
                                  <div className="flex gap-1">
                                    <input
                                      type="text"
                                      value={b.top}
                                      onChange={(e) =>
                                        updateTutorialTitle(i, {
                                          top: e.target.value,
                                        })
                                      }
                                      className="w-16 rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
                                      placeholder="top"
                                    />
                                    <input
                                      type="text"
                                      value={b.left}
                                      onChange={(e) =>
                                        updateTutorialTitle(i, {
                                          left: e.target.value,
                                        })
                                      }
                                      className="w-16 rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
                                      placeholder="left"
                                    />
                                  </div>
                                </div>
                              ))}
                              {currentPage.descriptions.map((b, i) => (
                                <div
                                  key={`d-${i}`}
                                  className="flex flex-col gap-1"
                                >
                                  <span className="text-xs text-slate-400">
                                    Descrição {i + 1}
                                  </span>
                                  <div className="flex gap-1">
                                    <input
                                      type="text"
                                      value={b.top}
                                      onChange={(e) =>
                                        updateTutorialDescription(i, {
                                          top: e.target.value,
                                        })
                                      }
                                      className="w-16 rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
                                      placeholder="top"
                                    />
                                    <input
                                      type="text"
                                      value={b.left}
                                      onChange={(e) =>
                                        updateTutorialDescription(i, {
                                          left: e.target.value,
                                        })
                                      }
                                      className="w-16 rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
                                      placeholder="left"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="mt-4 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() =>
                              setTutorialPageIndex((i) => Math.max(0, i - 1))
                            }
                            disabled={tutorialPageIndex === 0}
                            className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white disabled:opacity-50"
                          >
                            Anterior
                          </button>
                          <span className="text-sm text-slate-400">
                            {tutorialPageIndex + 1} / {totalPages}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setTutorialPageIndex((i) =>
                                Math.min(totalPages - 1, i + 1),
                              )
                            }
                            disabled={tutorialPageIndex >= totalPages - 1}
                            className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white disabled:opacity-50"
                          >
                            Próxima
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="py-8 text-center text-slate-400">
                        Nenhuma página no tutorial.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

        {isJsonTextModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-6">
            <div className="w-full max-w-4xl rounded-3xl border border-white/20 bg-slate-900/95 p-6 shadow-2xl">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-xl font-semibold text-white">
                  Importar JSON (Texto)
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsJsonTextModalOpen(false);
                    setJsonTextError(null);
                  }}
                  className="h-8 w-8 rounded-full border border-white/20 text-white transition hover:border-white"
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                Cole um array de objetos para o layout atual. Use apenas o
                número do ícone (ex: 01, 02).
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.3em] text-slate-400">
                Layout atual: {getLayoutConfig(form.layout).label}
              </p>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={14}
                className="mt-4 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-400"
                spellCheck={false}
              />
              {jsonTextError && (
                <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {jsonTextError}
                </div>
              )}
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsJsonTextModalOpen(false);
                    setJsonTextError(null);
                  }}
                  className="rounded-2xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleImportJsonText}
                  className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:brightness-110"
                >
                  Importar
                </button>
              </div>
            </div>
          </div>
        )}

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
              heroSkillImage1={
                card.layoutId === "heroes"
                  ? (heroSkillImagesCache[card.id]?.skill1 ?? null)
                  : null
              }
              heroSkillImage2={
                card.layoutId === "heroes"
                  ? (heroSkillImagesCache[card.id]?.skill2 ?? null)
                  : null
              }
              heroSkillImage3={
                card.layoutId === "heroes"
                  ? (heroSkillImagesCache[card.id]?.skill3 ?? null)
                  : null
              }
              htmlId={`zip-card-${card.id}`}
              iconOptionsA={iconOptionsA}
              enemieIconOptions={enemieIconOptions}
              heroIconOptions={heroIconOptions}
              inlineIconMap={inlineIconMap}
              skillIconOptions={getSkillOptionsForLayout(card.layoutId)}
              effect2IconOptions={effect2IconOptions}
              effect3IconOptions={effect3IconOptions}
              effect4IconOptions={effect4IconOptions}
              effectIconOptions04={effectIconOptions04}
              tensionIconOptions={tensionIconOptions}
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
              minZoom={0.2}
              maxZoom={4}
              aspect={cropAspect}
              onCropChange={setCrop}
              onZoomChange={(z) => {
                setZoom(z);
                setCrop({ x: 0, y: 0 });
              }}
              onCropAreaChange={(_area, croppedAreaPixels) => {
                setCropCompleteArea(croppedAreaPixels);
              }}
              objectFit="contain"
            />
          </div>
          <div className="mt-4 flex w-full max-w-2xl flex-col gap-4">
            <label className="flex items-center gap-3 text-sm text-white">
              <span className="shrink-0 font-medium">Zoom</span>
              <input
                type="range"
                min={0.2}
                max={4}
                step={0.1}
                value={zoom}
                onChange={(e) => {
                  setZoom(Number(e.target.value));
                  setCrop({ x: 0, y: 0 });
                }}
                className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-white/20 accent-amber-500"
              />
              <span className="shrink-0 w-10 text-right tabular-nums text-slate-300">
                {Math.round(zoom * 100)}%
              </span>
            </label>
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
