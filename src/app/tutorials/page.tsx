"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  createEmptyTutorialPage,
  mhTutorialLayout,
  re3TutorialLayout,
} from "@/data/tutorialLayouts";
import type {
  TutorialBlock,
  TutorialPage,
  TutorialPageNumber,
} from "@/data/tutorialTypes";
import {
  createEmptyTutorialBlock,
  TUTORIAL_BASE_PATHS,
} from "@/data/tutorialTypes";
import { getTutorialPagesFromDb, saveTutorialPagesToDb } from "@/lib/appDb";
import { convertImageFileToWebPDataUrl } from "@/lib/tutorialImage";
import {
  renderTutorialTextWithIcons,
  renderTutorialTextWithBoldAndIcons,
  TUTORIAL_ICON_MAP,
} from "@/lib/tutorialIcons";

const TUTORIAL_MH_FONT = "'IM Fell English', serif";
const TUTORIAL_MH_COLOR = "#555543";
const TUTORIAL_RE3_FONT = "var(--font-roboto), 'Roboto', sans-serif";
const TUTORIAL_RE3_COLOR = "#4B4B4B";

type GameKey = "RE3" | "MH";

const GAME_OPTIONS: { key: GameKey; label: string }[] = [
  { key: "RE3", label: "Resident Evil 3" },
  { key: "MH", label: "Monster Hunter" },
];

/** Valor para input: só o número (top/left/width em %, fontSize em rem) */
function toPercentInput(value: string | undefined): string {
  if (value == null || value === "") return "";
  return String(value).replace(/%$/, "").trim();
}
function toRemInput(value: string | undefined): string {
  if (value == null || value === "") return "";
  return String(value).replace(/rem$/i, "").trim();
}

function blockStyle(
  block: TutorialBlock,
  gameKey: GameKey,
  role: "title" | "description" = "description",
): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    top: block.top,
    left: block.left,
    width: block.width ?? "auto",
    fontSize: block.fontSize,
    lineHeight: block.lineHeight ?? undefined,
    transform: block.alignment === "center" ? "translateX(-50%)" : undefined,
    textAlign: block.alignment,
    margin: 0,
    padding: block.boxShadow ? "4px 8px" : undefined,
    boxShadow: block.boxShadow ? "0 0 12px rgba(0,0,0,0.8)" : undefined,
  };
  if (gameKey === "MH") {
    base.color = TUTORIAL_MH_COLOR;
    base.fontFamily = TUTORIAL_MH_FONT;
  } else {
    base.fontFamily = TUTORIAL_RE3_FONT;
    base.color = block.color ?? TUTORIAL_RE3_COLOR;
    if (role === "title") base.fontWeight = "bold";
  }
  if (role === "title") {
    base.textTransform = "uppercase";
    base.WebkitTextStroke = "0.1px #000";
    base.textShadow =
      "1px 1px 0 rgba(0,0,0,0.5), -1px -1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.35)";
  }
  return base;
}

const defaultPageNumber: TutorialPageNumber = {
  show: true,
  top: "95%",
  left: "50%",
  fontSize: "1rem",
  alignment: "center",
};

function pageNumberStyle(
  pn: TutorialPageNumber,
  gameKey: GameKey,
): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    top: pn.top,
    left: pn.left,
    fontSize: pn.fontSize ?? "1rem",
    fontWeight: "bold",
    transform:
      (pn.alignment ?? "center") === "center" ? "translateX(-50%)" : undefined,
    textAlign: pn.alignment ?? "center",
    margin: 0,
  };
  if (gameKey === "MH") {
    base.color = TUTORIAL_MH_COLOR;
    base.fontFamily = TUTORIAL_MH_FONT;
  } else {
    base.color = TUTORIAL_RE3_COLOR;
    base.fontFamily = TUTORIAL_RE3_FONT;
  }
  return base;
}

export default function TutorialsPage() {
  const [gameKey, setGameKey] = useState<GameKey>("MH");
  const [pageIndex, setPageIndex] = useState(0);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({
    titles: true,
    descriptions: true,
    pageNumber: true,
  });
  const [pages, setPages] = useState<TutorialPage[]>(() =>
    JSON.parse(JSON.stringify(mhTutorialLayout)),
  );

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const saveCurrentGamePages = useCallback(
    async (pagesToSave: TutorialPage[]) => {
      const fallback = {
        RE3: re3TutorialLayout as TutorialPage[],
        MH: mhTutorialLayout as TutorialPage[],
      };
      const saved = await getTutorialPagesFromDb(fallback);
      saved[gameKey] = JSON.parse(JSON.stringify(pagesToSave));
      await saveTutorialPagesToDb(saved);
    },
    [gameKey],
  );

  const basePath = TUTORIAL_BASE_PATHS[gameKey];
  const currentPage = pages[pageIndex];
  const totalPages = pages.length;

  const addPage = useCallback(() => {
    setPages((prev) => {
      const next = [...prev, createEmptyTutorialPage()];
      setTimeout(() => void saveCurrentGamePages(next), 0);
      return next;
    });
    setPageIndex(pages.length);
  }, [pages.length, saveCurrentGamePages]);

  const removePage = useCallback(() => {
    if (totalPages <= 1) return;
    const newIndex = Math.min(pageIndex, totalPages - 2);
    setPages((prev) => {
      const next = prev.filter((_, i) => i !== pageIndex);
      setTimeout(() => void saveCurrentGamePages(next), 0);
      return next;
    });
    setPageIndex(newIndex);
  }, [pageIndex, totalPages, saveCurrentGamePages]);

  const setPageBackground = useCallback(
    (index: number, dataUrl: string | undefined) => {
      setPages((prev) => {
        const next = prev.slice();
        next[index] = { ...next[index], backgroundImageDataUrl: dataUrl };
        setTimeout(() => void saveCurrentGamePages(next), 0);
        return next;
      });
    },
    [saveCurrentGamePages],
  );

  useEffect(() => {
    let cancelled = false;
    const fallback: { RE3: TutorialPage[]; MH: TutorialPage[] } = {
      RE3: (
        JSON.parse(JSON.stringify(re3TutorialLayout)) as TutorialPage[]
      ).map((p, i, arr) => ({
        ...p,
        pageNumber: p.pageNumber ?? {
          ...defaultPageNumber,
          show: i > 0 && i < arr.length - 1,
        },
      })),
      MH: (JSON.parse(JSON.stringify(mhTutorialLayout)) as TutorialPage[]).map(
        (p, i, arr) => ({
          ...p,
          pageNumber: p.pageNumber ?? {
            ...defaultPageNumber,
            show: i > 0 && i < arr.length - 1,
          },
        }),
      ),
    };
    (async () => {
      const saved = await getTutorialPagesFromDb(fallback);
      if (cancelled) return;
      const pagesForGame = saved[gameKey];
      if (pagesForGame && pagesForGame.length > 0) {
        setPages(JSON.parse(JSON.stringify(pagesForGame)));
      } else {
        setPages(JSON.parse(JSON.stringify(fallback[gameKey])));
      }
      setPageIndex(0);
    })();
    return () => {
      cancelled = true;
    };
  }, [gameKey]);

  const updateTitle = useCallback(
    (titleIndex: number, updates: Partial<TutorialBlock>) => {
      setPages((prev) => {
        const next = prev.slice();
        const page = next[pageIndex];
        const titles = page.titles.slice();
        titles[titleIndex] = { ...titles[titleIndex], ...updates };
        next[pageIndex] = { ...page, titles };
        setTimeout(() => void saveCurrentGamePages(next), 0);
        return next;
      });
    },
    [pageIndex, saveCurrentGamePages],
  );

  const updateDescription = useCallback(
    (descIndex: number, updates: Partial<TutorialBlock>) => {
      setPages((prev) => {
        const next = prev.slice();
        const page = next[pageIndex];
        const descriptions = page.descriptions.slice();
        descriptions[descIndex] = { ...descriptions[descIndex], ...updates };
        next[pageIndex] = { ...page, descriptions };
        setTimeout(() => void saveCurrentGamePages(next), 0);
        return next;
      });
    },
    [pageIndex, saveCurrentGamePages],
  );

  const addTitle = useCallback(() => {
    setPages((prev) => {
      const next = prev.slice();
      const page = next[pageIndex];
      const last = page.titles[page.titles.length - 1];
      const newBlock = last
        ? { ...last, text: "" }
        : createEmptyTutorialBlock();
      next[pageIndex] = { ...page, titles: [...page.titles, newBlock] };
      setTimeout(() => void saveCurrentGamePages(next), 0);
      return next;
    });
  }, [pageIndex, saveCurrentGamePages]);

  const addDescription = useCallback(() => {
    setPages((prev) => {
      const next = prev.slice();
      const page = next[pageIndex];
      const last = page.descriptions[page.descriptions.length - 1];
      const newBlock = last
        ? { ...last, text: "" }
        : createEmptyTutorialBlock();
      next[pageIndex] = {
        ...page,
        descriptions: [...page.descriptions, newBlock],
      };
      setTimeout(() => void saveCurrentGamePages(next), 0);
      return next;
    });
  }, [pageIndex, saveCurrentGamePages]);

  const removeTitle = useCallback(
    (titleIndex: number) => {
      const page = currentPage;
      if (!page || page.titles.length <= 1) return;
      setPages((prev) => {
        const next = prev.slice();
        const p = next[pageIndex];
        next[pageIndex] = {
          ...p,
          titles: p.titles.filter((_, i) => i !== titleIndex),
        };
        setTimeout(() => void saveCurrentGamePages(next), 0);
        return next;
      });
    },
    [pageIndex, currentPage, saveCurrentGamePages],
  );

  const removeDescription = useCallback(
    (descIndex: number) => {
      const page = currentPage;
      if (!page || page.descriptions.length <= 1) return;
      setPages((prev) => {
        const next = prev.slice();
        const p = next[pageIndex];
        next[pageIndex] = {
          ...p,
          descriptions: p.descriptions.filter((_, i) => i !== descIndex),
        };
        setTimeout(() => void saveCurrentGamePages(next), 0);
        return next;
      });
    },
    [pageIndex, currentPage, saveCurrentGamePages],
  );

  const updatePageNumber = useCallback(
    (updates: Partial<TutorialPageNumber>) => {
      setPages((prev) => {
        const next = prev.slice();
        const first = next[0];
        const pn = first?.pageNumber ?? { ...defaultPageNumber };
        const newPn = { ...pn, ...updates };
        for (let i = 0; i < next.length; i++) {
          next[i] = { ...next[i], pageNumber: { ...newPn } };
        }
        return next;
      });
    },
    [],
  );

  const renderBlockContent = (
    block: TutorialBlock,
    role: "title" | "description",
  ) => {
    if (!block.text.trim()) return null;
    const iconMap = gameKey === "MH" ? TUTORIAL_ICON_MAP : {};
    if (role === "description") {
      return renderTutorialTextWithBoldAndIcons(block.text, 24, iconMap);
    }
    return renderTutorialTextWithIcons(block.text, 24, iconMap);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="sticky top-0 z-10 border-b border-white/20 bg-slate-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-sm transition hover:border-white"
            >
              ← Voltar
            </Link>
            <h1 className="text-xl font-semibold">Editor de Tutoriais</h1>
          </div>
          <div className="flex rounded-xl border border-white/20 bg-white/5 p-1">
            {GAME_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setGameKey(key)}
                className={`rounded-lg px-4 py-2 text-sm transition ${
                  gameKey === key
                    ? "bg-white/20 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          {/* Form - à esquerda, seções colapsáveis */}
          <div className="w-full shrink-0 rounded-xl border border-white/20 bg-slate-800/80 p-4 md:order-1 md:w-[380px]">
            {currentPage ? (
              <>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-slate-300">
                    Página {pageIndex + 1} – Editar blocos
                  </h2>
                  <button
                    type="button"
                    onClick={async () => {
                      await saveCurrentGamePages(pages);
                      setSaveFeedback(true);
                      setTimeout(() => setSaveFeedback(false), 2000);
                    }}
                    className="shrink-0 rounded-xl border border-amber-500/50 bg-amber-500/20 px-3 py-1.5 text-sm font-medium text-amber-200 transition hover:bg-amber-500/30"
                  >
                    {saveFeedback ? "Salvo!" : "Salvar página"}
                  </button>
                </div>
                {/* Imagem de fundo (WebP) */}
                <fieldset className="mb-3 rounded-lg border border-white/10 overflow-hidden">
                  <div className="border-b border-white/10 px-3 py-2 text-xs font-medium text-slate-400">
                    Imagem de fundo
                  </div>
                  <div className="flex flex-col gap-2 p-3">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id={`tutorial-bg-upload-${gameKey}-${pageIndex}`}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const dataUrl =
                            await convertImageFileToWebPDataUrl(file);
                          setPageBackground(pageIndex, dataUrl);
                        } catch (err) {
                          console.error("Erro ao converter imagem:", err);
                        }
                        e.target.value = "";
                      }}
                    />
                    <label
                      htmlFor={`tutorial-bg-upload-${gameKey}-${pageIndex}`}
                      className="cursor-pointer rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-center text-xs text-slate-300 transition hover:bg-white/10"
                    >
                      {currentPage.backgroundImageDataUrl
                        ? "Trocar imagem"
                        : "Enviar imagem (converte para WebP)"}
                    </label>
                    {currentPage.backgroundImageDataUrl && (
                      <button
                        type="button"
                        onClick={() => setPageBackground(pageIndex, undefined)}
                        className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/20"
                      >
                        Remover imagem
                      </button>
                    )}
                  </div>
                </fieldset>
                <div className="flex flex-col gap-2">
                  {/* Título — por padrão 1; botão adiciona mais */}
                  <fieldset className="rounded-lg border border-white/10 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection("titles")}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-slate-400 hover:bg-white/5"
                    >
                      <span>Título</span>
                      <span className="text-[10px] text-slate-500">
                        {collapsedSections["titles"] ? "▶" : "▼"}
                      </span>
                    </button>
                    {!collapsedSections["titles"] && (
                      <div className="space-y-2 border-t border-white/10 p-3">
                        {currentPage.titles.map((block, i) => {
                          const titleKey = `title-${i}`;
                          const isCollapsed = collapsedSections[titleKey];
                          return (
                            <div
                              key={i}
                              className="rounded border border-white/10 overflow-hidden"
                            >
                              <div className="flex w-full items-center justify-between gap-1 px-2 py-1.5 text-xs font-medium text-slate-400">
                                <button
                                  type="button"
                                  onClick={() => toggleSection(titleKey)}
                                  className="flex flex-1 items-center justify-between text-left hover:bg-white/5 rounded"
                                >
                                  <span>Título {i + 1}</span>
                                  <span className="text-[10px] text-slate-500">
                                    {isCollapsed ? "▶" : "▼"}
                                  </span>
                                </button>
                                {currentPage.titles.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeTitle(i)}
                                    className="shrink-0 text-red-400 hover:text-red-300 py-0.5 px-1"
                                  >
                                    Remover
                                  </button>
                                )}
                              </div>
                              {!isCollapsed && (
                                <div className="space-y-2 border-t border-white/10 p-2">
                            <textarea
                              value={block.text ?? ""}
                              onChange={(e) =>
                                updateTitle(i, { text: e.target.value })
                              }
                              rows={2}
                              className="w-full rounded border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                              placeholder="Título…"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-slate-500">
                                  top (%)
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={toPercentInput(block.top)}
                                  onChange={(e) =>
                                    updateTitle(i, {
                                      top: e.target.value.trim()
                                        ? `${e.target.value.trim()}%`
                                        : "",
                                    })
                                  }
                                  className="w-full rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
                                  placeholder="50"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500">
                                  left (%)
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={toPercentInput(block.left)}
                                  onChange={(e) =>
                                    updateTitle(i, {
                                      left: e.target.value.trim()
                                        ? `${e.target.value.trim()}%`
                                        : "",
                                    })
                                  }
                                  className="w-full rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
                                  placeholder="50"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-slate-500">
                                  fontSize (rem)
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={toRemInput(block.fontSize)}
                                  onChange={(e) =>
                                    updateTitle(i, {
                                      fontSize: e.target.value.trim()
                                        ? `${e.target.value.trim()}rem`
                                        : "",
                                    })
                                  }
                                  className="w-full rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
                                  placeholder="1"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500">
                                  width (%)
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={toPercentInput(block.width)}
                                  onChange={(e) =>
                                    updateTitle(i, {
                                      width: e.target.value.trim()
                                        ? `${e.target.value.trim()}%`
                                        : undefined,
                                    })
                                  }
                                  className="w-full rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
                                  placeholder="80"
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              <label className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={Boolean(block.boxShadow)}
                                  onChange={(e) =>
                                    updateTitle(i, {
                                      boxShadow: e.target.checked,
                                    })
                                  }
                                  className="rounded border-white/20"
                                />
                                Sombra
                              </label>
                              <select
                                value={block.alignment ?? "left"}
                                onChange={(e) =>
                                  updateTitle(i, {
                                    alignment: e.target.value as
                                      | "center"
                                      | "left",
                                  })
                                }
                                className="rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
                              >
                                <option value="left">Esquerda</option>
                                <option value="center">Centro</option>
                              </select>
                            </div>
                            {gameKey === "RE3" && (
                              <div>
                                <label className="block text-xs text-slate-500">
                                  Cor (#hex)
                                </label>
                                <input
                                  type="text"
                                  value={block.color ?? ""}
                                  onChange={(e) =>
                                    updateTitle(i, {
                                      color: e.target.value.trim() || undefined,
                                    })
                                  }
                                  className="w-full rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white font-mono"
                                  placeholder="#D9E2DF"
                                />
                              </div>
                            )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={addTitle}
                          className="w-full rounded-lg border border-dashed border-white/20 py-2 text-xs text-slate-400 hover:border-white/40 hover:text-slate-300"
                        >
                          + Adicionar título
                        </button>
                      </div>
                    )}
                  </fieldset>
                  {/* Descrição — por padrão 1; botão adiciona mais */}
                  <fieldset className="rounded-lg border border-white/10 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection("descriptions")}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-slate-400 hover:bg-white/5"
                    >
                      <span>Descrição</span>
                      <span className="text-[10px] text-slate-500">
                        {collapsedSections["descriptions"] ? "▶" : "▼"}
                      </span>
                    </button>
                    {!collapsedSections["descriptions"] && (
                      <div className="space-y-2 border-t border-white/10 p-3">
                        {currentPage.descriptions.map((block, i) => {
                          const descKey = `desc-${i}`;
                          const isCollapsed = collapsedSections[descKey];
                          return (
                            <div
                              key={i}
                              className="rounded border border-white/10 overflow-hidden"
                            >
                              <div className="flex w-full items-center justify-between gap-1 px-2 py-1.5 text-xs font-medium text-slate-400">
                                <button
                                  type="button"
                                  onClick={() => toggleSection(descKey)}
                                  className="flex flex-1 items-center justify-between text-left hover:bg-white/5 rounded"
                                >
                                  <span>Descrição {i + 1}</span>
                                  <span className="text-[10px] text-slate-500">
                                    {isCollapsed ? "▶" : "▼"}
                                  </span>
                                </button>
                                {currentPage.descriptions.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeDescription(i)}
                                    className="shrink-0 text-red-400 hover:text-red-300 py-0.5 px-1"
                                  >
                                    Remover
                                  </button>
                                )}
                              </div>
                              {!isCollapsed && (
                                <div className="space-y-2 border-t border-white/10 p-2">
                            <textarea
                              value={block.text ?? ""}
                              onChange={(e) =>
                                updateDescription(i, { text: e.target.value })
                              }
                              rows={4}
                              className="w-full rounded border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                              placeholder="Use **texto** para negrito"
                            />
                            <p className="text-[10px] text-slate-500">
                              Use **texto** para exibir em negrito.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-slate-500">
                                  top (%)
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={toPercentInput(block.top)}
                                  onChange={(e) =>
                                    updateDescription(i, {
                                      top: e.target.value.trim()
                                        ? `${e.target.value.trim()}%`
                                        : "",
                                    })
                                  }
                                  className="w-full rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
                                  placeholder="50"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500">
                                  left (%)
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={toPercentInput(block.left)}
                                  onChange={(e) =>
                                    updateDescription(i, {
                                      left: e.target.value.trim()
                                        ? `${e.target.value.trim()}%`
                                        : "",
                                    })
                                  }
                                  className="w-full rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
                                  placeholder="50"
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-xs text-slate-500">
                                  fontSize (rem)
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={toRemInput(block.fontSize)}
                                  onChange={(e) =>
                                    updateDescription(i, {
                                      fontSize: e.target.value.trim()
                                        ? `${e.target.value.trim()}rem`
                                        : "",
                                    })
                                  }
                                  className="w-full rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
                                  placeholder="1"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500">
                                  width (%)
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={toPercentInput(block.width)}
                                  onChange={(e) =>
                                    updateDescription(i, {
                                      width: e.target.value.trim()
                                        ? `${e.target.value.trim()}%`
                                        : undefined,
                                    })
                                  }
                                  className="w-full rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
                                  placeholder="80"
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              <label className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  checked={Boolean(block.boxShadow)}
                                  onChange={(e) =>
                                    updateDescription(i, {
                                      boxShadow: e.target.checked,
                                    })
                                  }
                                  className="rounded border-white/20"
                                />
                                Sombra
                              </label>
                              <select
                                value={block.alignment ?? "left"}
                                onChange={(e) =>
                                  updateDescription(i, {
                                    alignment: e.target.value as
                                      | "center"
                                      | "left",
                                  })
                                }
                                className="rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
                              >
                                <option value="left">Esquerda</option>
                                <option value="center">Centro</option>
                              </select>
                            </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={addDescription}
                          className="w-full rounded-lg border border-dashed border-white/20 py-2 text-xs text-slate-400 hover:border-white/40 hover:text-slate-300"
                        >
                          + Adicionar descrição
                        </button>
                      </div>
                    )}
                  </fieldset>
                  {/* Número da página (padrão para todas as páginas) */}
                  <fieldset className="rounded-lg border border-white/10 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleSection("pageNumber")}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-slate-400 hover:bg-white/5"
                    >
                      <span>Número da página (todas)</span>
                      <span className="text-[10px] text-slate-500">
                        {collapsedSections["pageNumber"] ? "▶" : "▼"}
                      </span>
                    </button>
                    {!collapsedSections["pageNumber"] && (
                      <div className="space-y-2 border-t border-white/10 p-3">
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={Boolean(
                              (pages[0]?.pageNumber ?? defaultPageNumber).show,
                            )}
                            onChange={(e) =>
                              updatePageNumber({ show: e.target.checked })
                            }
                            className="rounded border-white/20"
                          />
                          Exibir número (valor = índice + 1)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-slate-500">
                              top (%)
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={toPercentInput(
                                (pages[0]?.pageNumber ?? defaultPageNumber).top,
                              )}
                              onChange={(e) => {
                                const v = e.target.value.trim();
                                updatePageNumber({
                                  top: v === "" ? "95%" : `${v}%`,
                                });
                              }}
                              className="w-full rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
                              placeholder="95"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500">
                              left (%)
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={toPercentInput(
                                (pages[0]?.pageNumber ?? defaultPageNumber)
                                  .left,
                              )}
                              onChange={(e) => {
                                const v = e.target.value.trim();
                                updatePageNumber({
                                  left: v === "" ? "50%" : `${v}%`,
                                });
                              }}
                              className="w-full rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
                              placeholder="50"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500">
                            fontSize (rem)
                          </label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={toRemInput(
                              (pages[0]?.pageNumber ?? defaultPageNumber)
                                .fontSize,
                            )}
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              updatePageNumber({
                                fontSize: v === "" ? undefined : `${v}rem`,
                              });
                            }}
                            className="w-full rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
                            placeholder="1"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">
                            Alinhamento
                          </span>
                          <select
                            value={
                              (pages[0]?.pageNumber ?? defaultPageNumber)
                                .alignment ?? "center"
                            }
                            onChange={(e) =>
                              updatePageNumber({
                                alignment: e.target.value as "center" | "left",
                              })
                            }
                            className="rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white"
                          >
                            <option value="left">Esquerda</option>
                            <option value="center">Centro</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </fieldset>
                </div>
              </>
            ) : (
              <p className="text-slate-400">Nenhuma página.</p>
            )}
          </div>

          {/* Canvas - à direita */}
          <div className="flex flex-1 flex-col items-center md:min-w-0 md:order-2">
            <div className="mb-3 flex w-full max-w-2xl flex-wrap items-center justify-between gap-2 md:max-w-full">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
                  disabled={pageIndex === 0}
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-sm text-slate-400">
                  {pageIndex + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPageIndex((i) => Math.min(totalPages - 1, i + 1))
                  }
                  disabled={pageIndex >= totalPages - 1}
                  className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addPage}
                  className="rounded-xl border border-emerald-500/50 bg-emerald-500/20 px-3 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/30"
                >
                  + Adicionar página
                </button>
                <button
                  type="button"
                  onClick={removePage}
                  disabled={totalPages <= 1}
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200 disabled:opacity-50 hover:bg-red-500/20"
                >
                  Remover página
                </button>
              </div>
            </div>
            <div
              id="tutorial-canvas"
              className="relative w-full max-w-2xl overflow-hidden rounded-xl bg-slate-800 shadow-xl md:max-w-full"
              style={{ aspectRatio: "3/4" }}
            >
              {currentPage && (
                <>
                  {currentPage.backgroundImageDataUrl ? (
                    <img
                      src={currentPage.backgroundImageDataUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-contain object-top"
                    />
                  ) : currentPage.imagePath ? (
                    <img
                      src={`${basePath}/${currentPage.imagePath}`}
                      alt=""
                      className="absolute inset-0 h-full w-full object-contain object-top"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-700/80 text-slate-500">
                      <span className="text-sm">Sem imagem de fundo</span>
                    </div>
                  )}
                  {currentPage.titles.map((block, i) => {
                    const content = renderBlockContent(block, "title");
                    if (!content) return null;
                    return (
                      <div
                        key={`t-${i}`}
                        className="absolute whitespace-pre-wrap break-words"
                        style={blockStyle(block, gameKey, "title")}
                      >
                        {content}
                      </div>
                    );
                  })}
                  {currentPage.descriptions.map((block, i) => {
                    const content = renderBlockContent(block, "description");
                    if (!content) return null;
                    return (
                      <div
                        key={`d-${i}`}
                        className="absolute whitespace-pre-wrap break-words"
                        style={blockStyle(block, gameKey, "description")}
                      >
                        {content}
                      </div>
                    );
                  })}
                  {currentPage.pageNumber?.show && (
                    <div
                      className="absolute"
                      style={pageNumberStyle(
                        currentPage.pageNumber ?? defaultPageNumber,
                        gameKey,
                      )}
                    >
                      {pageIndex + 1}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
