"use client";

import { Fragment, type ReactNode } from "react";

const TEXT_HUNTER_ICON_ALIASES: Record<string, string> = {
  IconDragon: "/models/icons/textHunter/dragon.webp",
  IconFire: "/models/icons/textHunter/fire.webp",
  IconIce: "/models/icons/textHunter/ice.webp",
  IconThunder: "/models/icons/textHunter/thunder.webp",
  IconWater: "/models/icons/textHunter/water.webp",
};

const buildAliases = (base: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(base).flatMap(([key, value]) => [
      [key, value],
      [key.toLowerCase(), value],
    ])
  );

export const TUTORIAL_ICON_MAP = buildAliases(TEXT_HUNTER_ICON_ALIASES);

/** Renderiza texto substituindo códigos (IconFire, etc.) por <img>. */
export function renderTutorialTextWithIcons(
  text: string,
  iconSizePx: number = 24,
  iconMap: Record<string, string> = TUTORIAL_ICON_MAP
): ReactNode {
  if (!text?.trim()) return null;
  const codes = Object.keys(iconMap).sort(
    (a, b) => b.length - a.length || b.localeCompare(a)
  );
  if (codes.length === 0) return text;
  const pattern = new RegExp(
    `(${codes.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "g"
  );
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const src = iconMap[match[1]];
    if (src) {
      parts.push(
        <img
          key={`icon-${key++}`}
          src={src}
          alt=""
          className="inline-block align-text-bottom"
          style={{
            width: iconSizePx,
            height: iconSizePx,
            verticalAlign: "text-bottom",
            marginBottom: 2,
          }}
        />
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

/** Renderiza texto com **trecho** em negrito e ícones (para descrições do tutorial). */
export function renderTutorialTextWithBoldAndIcons(
  text: string,
  iconSizePx: number = 24,
  iconMap: Record<string, string> = TUTORIAL_ICON_MAP
): ReactNode {
  if (!text?.trim()) return null;
  const parts = text.split(/\*\*([\s\S]*?)\*\*/g);
  const result: ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const segment = parts[i];
    const content = renderTutorialTextWithIcons(segment, iconSizePx, iconMap);
    result.push(
      i % 2 === 1 ? (
        <strong key={`b-${i}`}>{content}</strong>
      ) : (
        <Fragment key={`n-${i}`}>{content}</Fragment>
      )
    );
  }
  return <>{result}</>;
}
