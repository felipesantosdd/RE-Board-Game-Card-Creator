"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Bebas_Neue, EB_Garamond } from "next/font/google";
import JSZip from "jszip";

type IconOption = {
  id: string;
  label: string;
  description: string;
  src: string;
};

/** Ícone 1: apenas pasta A */
const ICON_A_IDS = ["01", "02", "03", "04", "05"] as const;
const iconOptionsA: IconOption[] = ICON_A_IDS.map((id) => ({
  id,
  label: `Ícone ${id}`,
  description: "",
  src: `/models/icons/A/${id}.png`,
}));

/** Ícone 2: apenas pasta B */
const ICON_B_IDS = ["01", "02", "03", "04", "05"] as const;
const iconOptionsB: IconOption[] = ICON_B_IDS.map((id) => ({
  id,
  label: `Ícone ${id}`,
  description: "",
  src: `/models/icons/B/${id}.png`,
}));

/** Skills: apenas pasta C */
const SKILL_IDS = ["01"] as const;
const skillIconOptions: IconOption[] = SKILL_IDS.map((id) => ({
  id,
  label: `Skill ${id}`,
  description: "",
  src: `/models/icons/C/${id}.png`,
}));

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
};

type LayoutOption = {
  id: string;
  label: string;
  image: string;
  positions: LayoutPositions;
};

const layoutOptions: LayoutOption[] = [
  {
    id: "equip1",
    label: "Equipamento 1",
    image: "/models/cards/01.png",
    positions: {
      icon: { top: "232px", left: "72px" },
      title: {
        top: "70px",
        left: "215px",
        width: "410px",
        height: "120px",
        fontSize: "clamp(3rem, 4vw, 4rem)",
      },
      description: { top: "550px", left: "60px" },
      overlay: {
        top: "215px",
        left: "215px",
        width: "410px",
        height: "285px",
      },
      skills: {
        top: "850px",
        left: "70px",
        width: "560px",
        height: "120px",
      },
    },
  },
  {
    id: "equip2",
    label: "Equipamento 2",
    image: "/models/cards/02.png",
    positions: {
      icon: { top: "232px", left: "72px" },
      icon2: { top: "-152px", left: "482px" },
      title: {
        top: "70px",
        left: "215px",
        width: "280px",
        height: "120px",
        fontSize: "clamp(2.1rem, 3vw, 3rem)",
      },
      description: { top: "550px", left: "60px" },
      overlay: {
        top: "215px",
        left: "215px",
        width: "410px",
        height: "285px",
      },
      skills: {
        top: "850px",
        left: "70px",
        width: "560px",
        height: "120px",
      },
    },
  },
  {
    id: "equip3",
    label: "Arma",
    image: "/models/cards/03.png",
    positions: {
      icon: { top: "292px", left: "72px" },
      icon2: { top: "125px", left: "545px" },
      title: {
        top: "70px",
        left: "215px",
        width: "280px",
        height: "120px",
        fontSize: "clamp(2.1rem, 3vw, 3rem)",
      },
      description: { top: "550px", left: "60px" },
      overlay: {
        top: "215px",
        left: "215px",
        width: "410px",
        height: "285px",
      },
      skills: {
        top: "850px",
        left: "70px",
        width: "560px",
        height: "120px",
      },
    },
  },
];

const mergeLayoutPositions = (
  candidate: Partial<LayoutPositions>,
  fallback: LayoutPositions
): LayoutPositions => ({
  icon: candidate.icon ?? fallback.icon,
  icon2: candidate.icon2 ?? fallback.icon2,
  title: candidate.title ?? fallback.title,
  description: candidate.description ?? fallback.description,
  overlay: candidate.overlay ?? fallback.overlay,
  skills: candidate.skills ?? fallback.skills,
});

const DEFAULT_LAYOUT = layoutOptions[0];
const CARD_TEMPLATE_IMAGE = DEFAULT_LAYOUT.image;
const CARD_DIMENSIONS = {
  width: 699,
  height: 1038,
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
    /\b([A-Za-z])([A-Za-z]{3,})/g,
    (_, first, rest) => `${first.toUpperCase()}${rest}`
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
  equip3Number: string;
};

const createInitialFormState = (): FormState => ({
  title: "",
  description: "",
  layout: DEFAULT_LAYOUT.id,
  image: DEFAULT_LAYOUT.image,
  icon: iconOptionsA[0].src,
  icon2: "",
  icon2Id: "",
  accent: DEFAULT_ACCENT,
  selectedSkills: [],
  equip3Number: "",
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
  equip3Number: string;
};

type CardPreviewProps = {
  card: Omit<CardDesign, "id">;
  overlayImage?: string | null;
  htmlId: string;
};

const CardPreview = ({ card, overlayImage, htmlId }: CardPreviewProps) => {
  const heroImage = card.image || CARD_TEMPLATE_IMAGE;
  const layoutPositions = card.layoutPositions || DEFAULT_LAYOUT.positions;
  const cardStyle = {
    ...CARD_DIMENSIONS,
    width: CARD_DIMENSIONS.width,
    height: CARD_DIMENSIONS.height,
    borderColor: CARD_BORDER_COLOR,
    backgroundImage: `url("${heroImage}")`,
    backgroundSize: "100% 100%",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    fontFamily: bebasNeue.style.fontFamily,
  };

  return (
    <div
      id={htmlId}
      className="relative overflow-hidden rounded-3xl border-2 border-white/30 transition"
      style={cardStyle}
    >
      {overlayImage && (
        <img
          src={overlayImage}
          alt="Arte personalizada do card"
          className="absolute object-cover"
          style={{
            top: layoutPositions.overlay.top,
            left: layoutPositions.overlay.left,
            width: layoutPositions.overlay.width,
            height: layoutPositions.overlay.height,
          }}
        />
      )}
      {card.selectedSkills?.length > 0 && (
        <div
          className="pointer-events-none flex flex-wrap items-center justify-center gap-2"
          style={{
            position: "absolute",
            top: layoutPositions.skills.top,
            left: layoutPositions.skills.left,
            width: layoutPositions.skills.width,
            height: layoutPositions.skills.height,
          }}
        >
          {card.selectedSkills.map((skillId) => {
            const skill = skillIconOptions.find(
              (option) => option.id === skillId
            );
            if (!skill) return null;
            return (
              <img
                key={skillId}
                src={skill.src}
                alt={skill.label}
                className="h-30 w-30 object-contain"
              />
            );
          })}
        </div>
      )}
      <div className="flex h-full flex-col gap-0 text-white">
        <div className="flex items-center gap-4">
          <div
            className="relative flex h-24 w-24 flex-col items-center justify-center"
            style={{
              position: "absolute",
              top: layoutPositions.icon.top,
              left: layoutPositions.icon.left,
              boxShadow: ICON_DROP_SHADOW,
            }}
          >
            {card.layoutId === "equip3" ? null : (
              <>
                <img
                  src={card.icon || iconOptionsA[0].src}
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
          {card.layoutId === "equip3" &&
            card.equip3Number &&
            layoutPositions.icon2 && (
              <div
                className="flex items-center justify-center"
                style={{
                  position: "absolute",
                  width: "70px",
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
                    fontSize: layoutPositions.title.fontSize,
                    fontFamily: bebasNeue.style.fontFamily,
                  }}
                >
                  {card.equip3Number}
                </span>
              </div>
            )}
        </div>
        <h3
          className="leading-tight text-black text-center drop-shadow-lg"
          style={{
            position: "absolute",
            top: layoutPositions.title.top,
            left: layoutPositions.title.left,
            width: layoutPositions.title.width,
            height: layoutPositions.title.height,
            fontSize: layoutPositions.title.fontSize,
            lineHeight: 0.9,
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
          {card.title || ""}
        </h3>
        <p
          className="absolute text-4xl text-black drop-shadow-lg text-center"
          style={{
            top: layoutPositions.description.top,
            left: layoutPositions.description.left,
            fontFamily: ebGaramond.style.fontFamily,
            fontWeight: 590,
            lineHeight: 1,
            width: "570px",
            height: "420px",
          }}
        >
          {card.description || ""}
        </p>
      </div>
    </div>
  );
};

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<FormState>(createInitialFormState());
  const [cards, setCards] = useState<CardDesign[]>([]);
  const [overlayImage, setOverlayImage] = useState<string | null>(null);
  const [overlayCache, setOverlayCache] = useState<
    Record<string, string | null>
  >({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  const handleArtUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setOverlayImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

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
      equip3Number: card.equip3Number ?? "",
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
          layout.positions
        );
        return {
          ...card,
          layoutPositions: positions,
          selectedSkills: card.selectedSkills ?? [],
          equip3Number: card.equip3Number ?? "",
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
        error
      );
      setStorageWarning(
        "O navegador bloqueou o armazenamento local. Tente limpar o cache ou usar outro navegador."
      );
    }
  }, [cards]);

  useEffect(() => {
    let active = true;

    const syncOverlayCache = async () => {
      const entries = await Promise.all(
        cards.map(
          async (card) => [card.id, await getOverlayImage(card.id)] as const
        )
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
    currentLayoutConfig.id !== "equip3" &&
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
    equip3Number: form.equip3Number,
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
          card.id === cardToSave.id ? cardToSave : card
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

    setEditingId(null);
    setOverlayImage(null);
    setForm(createInitialFormState());
    setStatusMessage("Card salvo! Você pode baixá-lo no painel abaixo.");
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
        equip3Number,
      }: CardDesign) => ({
        title,
        description,
        layoutId,
        icon,
        icon2Id,
        selectedSkills,
        skillId: selectedSkills[0] ?? null,
        equip3Number,
      })
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

  const handleExportZip = async () => {
    if (cards.length === 0) return;
    const zip = new JSZip();
    const cardsFolder = zip.folder("cards");
    for (const card of cards) {
      const node = document.getElementById(`zip-card-${card.id}`);
      if (!node) continue;
      try {
        const dataUrl = await toPng(node, { cacheBust: true });
        const base64 = dataUrl.split(",")[1];
        cardsFolder?.file(`card-${card.id}.png`, base64, { base64: true });
      } catch (error) {
        console.error("Falha ao gerar imagem para exportar:", error);
      }
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "re-card-creator-cards.zip";
    link.click();
    URL.revokeObjectURL(url);
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
          equip3Number?: string | null;
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
            equip3Number: item.equip3Number ?? "",
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

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.5em] text-slate-400">
            RE Card Creator
          </p>
          <h1 className="text-4xl font-semibold leading-tight">
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
                className="rounded-2xl border border-white/20 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white transition hover:border-white"
                onClick={handleExportZip}
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
                className="rounded-2xl border border-red-500/40 bg-red-600/10 px-3 py-1 text-xs uppercase tracking-[0.3em] text-red-100 transition hover:border-red-300"
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
          <div className="flex flex-wrap gap-3">
            {cards.length === 0 ? (
              <div className="flex h-52 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs uppercase tracking-[0.3em] text-slate-400">
                Nenhum card salvo
              </div>
            ) : (
              cards.map((savedCard) => {
                const overlayPreview = overlayCache[savedCard.id];
                return (
                  <div key={savedCard.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => void handleLoadCard(savedCard)}
                      className="group relative z-0 flex w-[150px] flex-col items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-2 text-center text-sm text-white transition hover:border-white hover:scale-105 hover:z-10"
                      style={{ height: "250px" }}
                    >
                      <div className="relative h-32 w-full overflow-hidden rounded-2xl bg-slate-900/50">
                        {overlayPreview ? (
                          <img
                            src={overlayPreview}
                            alt="Overlay"
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{ zIndex: 0 }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-[0.3em] text-slate-400">
                            Sem arte
                          </div>
                        )}
                      </div>
                      <p
                        className="mt-2 font-semibold text-white"
                        style={{
                          height: "40px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {savedCard.title || "Sem título"}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRemoveCard(savedCard.id);
                      }}
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-red-600/90 text-xs font-bold text-white opacity-0 transition hover:opacity-100 group-hover:opacity-100"
                      style={{ zIndex: 30 }}
                    >
                      ×
                    </button>
                  </div>
                );
              })
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
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6 rounded-3xl  border-white/10 bg-black/40 p-6 shadow-xl">
            <div className="flex flex-col gap-3">
              <h2 className="text-2xl font-semibold">Conteúdo do card</h2>
              <p className="text-sm text-slate-400">
                Preencha os campos abaixo e veja o card atualizar ao vivo à
                direita.
              </p>
            </div>

            <div className="space-y-4">
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Título
                <input
                  type="text"
                  placeholder="Lançamento imperdível"
                  value={form.title}
                  className="rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-base text-white outline-none transition focus:border-slate-300 uppercase"
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      title: event.target.value.toUpperCase(),
                    }))
                  }
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Descrição
                <textarea
                  rows={3}
                  placeholder="Conte um pouco mais sobre a campanha..."
                  value={form.description}
                  className="rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-sm leading-relaxed text-white outline-none transition focus:border-slate-300"
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      description: capitalizeLongWords(event.target.value),
                    }))
                  }
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Layout
                <select
                  value={form.layout}
                  className="rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-base text-white outline-none transition focus:border-slate-300"
                  onChange={(event) => {
                    const selected = getLayoutConfig(event.target.value);
                    const isEquip3 = selected.id === "equip3";
                    setForm((prev) => ({
                      ...prev,
                      layout: selected.id,
                      image: selected.image,
                      icon: isEquip3 ? "" : prev.icon || iconOptionsA[0].src,
                      icon2: selected.positions.icon2 ? prev.icon2 : "",
                      icon2Id: selected.positions.icon2 ? prev.icon2Id : "",
                    }));
                  }}
                >
                  {layoutOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col gap-2 text-sm text-slate-300">
                <span>Arte própria?</span>
                <button
                  type="button"
                  className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-700 to-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/60"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Enviar arte do card
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

            {form.layout !== "equip3" && (
              <>
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold">Ícone 1 (pasta A)</h3>
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
                    <h3 className="text-xl font-semibold">Ícone 2 (pasta B)</h3>
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

            {form.layout !== "equip3" && (
              <div className="space-y-3">
                <h3 className="text-xl font-semibold">Skills (pasta C)</h3>
                <div className="flex gap-3">
                  {skillIconOptions.map((skill) => {
                    const selected = form.selectedSkills.includes(skill.id);
                    return (
                      <button
                        key={skill.id}
                        type="button"
                        onClick={() =>
                          setForm((prev) => {
                            const exists = prev.selectedSkills.includes(
                              skill.id
                            );
                            const next = exists
                              ? prev.selectedSkills.filter(
                                  (id) => id !== skill.id
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
                      >
                        <img
                          src={skill.src}
                          alt={skill.label}
                          className="h-6 w-6 object-contain"
                        />
                      </button>
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
                        (option) => option.id === skillId
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
              <label className="flex flex-col gap-2 text-sm text-slate-300">
                Número adicional
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.equip3Number}
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
                    `card-${form.title || "sem-titulo"}.png`
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
          <div className="flex flex-col items-center gap-5 rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl">
            <div className="overflow-x-auto" style={{ width: "100%" }}>
              <CardPreview
                card={previewCard}
                overlayImage={overlayImage}
                htmlId="preview-card"
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
            />
          ))}
        </div>
      </main>
    </div>
  );
}
