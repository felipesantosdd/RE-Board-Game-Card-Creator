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

/** Listas de ícones vêm da API /api/icons?path= (A, B, C, Effects/01, etc.) */
const DEFAULT_ICON_FALLBACK = "/models/icons/A/01.png";

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
  /** Layout 3: 4 ícones de effects (posição ajustável) */
  effect1?: { top: string; left: string };
  effect2?: { top: string; left: string };
  effect3?: { top: string; left: string };
  effect4?: { top: string; left: string };
  /** Posição do número sobre cada ícone (relativo ao bloco do ícone). Ajuste top/left aqui. */
  effect2NumberPosition?: { top: string; left: string };
  effect3NumberPosition?: { top: string; left: string };
  effect4NumberPosition?: { top: string; left: string };
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
    id: "equip3",
    label: "Arma",
    image: "/models/cards/03.png",
    positions: {
      icon: { top: "292px", left: "72px" },
      icon2: { top: "120px", left: "545px" },
      title: {
        top: "70px",
        left: "215px",
        width: "280px",
        height: "120px",
        fontSize: "clamp(2.8rem, 3vw, 3.8rem)",
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
      effect1: { top: "675px", left: "59px" },
      effect2: { top: "670px", left: "208px" },
      effect3: { top: "670px", left: "357px" },
      effect4: { top: "670px", left: "506px" },
      /* Posição do número sobre cada ícone (ajuste top/left conforme necessário) */
      effect2NumberPosition: { top: "0", left: "50%" },
      effect3NumberPosition: { top: "0", left: "50%" },
      effect4NumberPosition: { top: "0", left: "50%" },
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
  linhaDeTiro: string;
  effect2Icon: string;
  effect2Number: string;
  effect3Icon: string;
  effect3Number: string;
  effect4Icon: string;
  effect4Number: string;
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
  equip3Number: "",
  linhaDeTiro: "",
  effect2Icon: "",
  effect2Number: "1",
  effect3Icon: "",
  effect3Number: "",
  effect4Icon: "",
  effect4Number: "1",
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
  linhaDeTiro: string;
  effect2Icon: string;
  effect2Number: string;
  effect3Icon: string;
  effect3Number: string;
  effect4Icon: string;
  effect4Number: string;
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
};

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
}: CardPreviewProps) => {
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
            justifyContent: "center",
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            flexWrap: "wrap",
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: "auto",
            flex: 1,
          }}
        />
      )}
      {card.selectedSkills?.length > 0 && (
        <div
          className="pointer-events-none flex flex-wrap items-center justify-center gap-2"
          style={{
            position: "absolute",
            top: "815px",
            left: layoutPositions.skills.left,
            width: layoutPositions.skills.width,
            height: "150px",
          }}
        >
          {card.selectedSkills.map((skillId) => {
            const skill =
              card.layoutId === "equip3"
                ? effectIconOptions04.find((o) => o.id === skillId)
                : skillIconOptions.find((o) => o.id === skillId);
            if (!skill) return null;
            return (
              <img
                key={skillId}
                src={skill.src}
                alt={skill.label}
                className="h-26 w-30 object-contain"
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
                  src={
                    card.icon || iconOptionsA[0]?.src || DEFAULT_ICON_FALLBACK
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
          {card.layoutId === "equip3" &&
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
                  ? { icon: card.effect2Icon, number: card.effect2Number }
                  : index === 2
                  ? { icon: card.effect3Icon, number: card.effect3Number }
                  : { icon: card.effect4Icon, number: card.effect4Number };
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
                          const pos = numberPos ?? { top: "0", left: "50%" };
                          const isCenterX = pos.left === "50%";
                          return (
                            <div
                              className="absolute z-10 flex items-center justify-center text-center font-semibold drop-shadow-lg"
                              style={{
                                top: pos.top,
                                left: pos.left,
                                transform: isCenterX
                                  ? "translateX(-50%)"
                                  : undefined,
                                width: "120px",
                                height: "120px",
                                color: "#E3DBD2",
                                fontSize: layoutPositions.title.fontSize,
                                fontFamily: bebasNeue.style.fontFamily,
                              }}
                            >
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
  const [iconOptionsA, setIconOptionsA] = useState<IconOption[]>([]);
  const [iconOptionsB, setIconOptionsB] = useState<IconOption[]>([]);
  const [skillIconOptions, setSkillIconOptions] = useState<IconOption[]>([]);
  const [effect2IconOptions, setEffect2IconOptions] = useState<IconOption[]>(
    []
  );
  const [effect3IconOptions, setEffect3IconOptions] = useState<IconOption[]>(
    []
  );
  const [effect4IconOptions, setEffect4IconOptions] = useState<IconOption[]>(
    []
  );
  const [effectIconOptions04, setEffectIconOptions04] = useState<IconOption[]>(
    []
  );
  const importFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const paths = [
      "A",
      "B",
      "C",
      "Effects/01",
      "Effects/02",
      "Effects/03",
      "Effects/04",
    ] as const;
    const setters = [
      setIconOptionsA,
      setIconOptionsB,
      setSkillIconOptions,
      setEffect2IconOptions,
      setEffect3IconOptions,
      setEffect4IconOptions,
      setEffectIconOptions04,
    ];
    Promise.all(
      paths.map((p) =>
        fetch(`/api/icons?path=${encodeURIComponent(p)}`).then((r) => r.json())
      )
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
      linhaDeTiro: card.linhaDeTiro ?? "",
      effect2Icon: card.effect2Icon ?? "",
      effect2Number: card.effect2Number ?? "",
      effect3Icon: card.effect3Icon ?? "",
      effect3Number: card.effect3Number ?? "",
      effect4Icon: card.effect4Icon ?? "",
      effect4Number: card.effect4Number ?? "",
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
          linhaDeTiro: card.linhaDeTiro ?? "",
          effect2Icon: card.effect2Icon ?? "",
          effect2Number: card.effect2Number ?? "",
          effect3Icon: card.effect3Icon ?? "",
          effect3Number: card.effect3Number ?? "",
          effect4Icon: card.effect4Icon ?? "",
          effect4Number: card.effect4Number ?? "",
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
    linhaDeTiro: form.linhaDeTiro,
    effect2Icon: form.effect2Icon,
    effect2Number: form.effect2Number,
    effect3Icon: form.effect3Icon,
    effect3Number: form.effect3Number,
    effect4Icon: form.effect4Icon,
    effect4Number: form.effect4Number,
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
        linhaDeTiro,
        effect2Icon,
        effect2Number,
        effect3Icon,
        effect3Number,
        effect4Icon,
        effect4Number,
      }: CardDesign) => ({
        title,
        description,
        layoutId,
        icon,
        icon2Id,
        selectedSkills,
        skillId: selectedSkills[0] ?? null,
        equip3Number,
        linhaDeTiro,
        effect2Icon,
        effect2Number,
        effect3Icon,
        effect3Number,
        effect4Icon,
        effect4Number,
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
          linhaDeTiro?: string | null;
          effect2Icon?: string | null;
          effect2Number?: string | null;
          effect3Icon?: string | null;
          effect3Number?: string | null;
          effect4Icon?: string | null;
          effect4Number?: string | null;
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
            linhaDeTiro: item.linhaDeTiro ?? "",
            effect2Icon: item.effect2Icon ?? "",
            effect2Number: item.effect2Number ?? "",
            effect3Icon: item.effect3Icon ?? "",
            effect3Number: item.effect3Number ?? "",
            effect4Icon: item.effect4Icon ?? "",
            effect4Number: item.effect4Number ?? "",
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
          <div className="overflow-x-auto overflow-y-hidden pb-2">
            {cards.length === 0 ? (
              <div className="flex h-52 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs uppercase tracking-[0.3em] text-slate-400">
                Nenhum card salvo
              </div>
            ) : (
              <div className="flex flex-nowrap gap-3">
                {cards.map((savedCard) => {
                  const overlayPreview = overlayCache[savedCard.id];
                  return (
                    <div key={savedCard.id} className="relative group shrink-0">
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
                  value={form.title ?? ""}
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
                  value={form.description ?? ""}
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
                  value={form.layout ?? ""}
                  className="rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-base text-white outline-none transition focus:border-slate-300"
                  onChange={(event) => {
                    const selected = getLayoutConfig(event.target.value);
                    const isEquip3 = selected.id === "equip3";
                    setForm((prev) => ({
                      ...prev,
                      layout: selected.id,
                      image: selected.image,
                      icon: isEquip3
                        ? ""
                        : prev.icon || (iconOptionsA[0]?.src ?? ""),
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

            {form.layout !== "equip3" && (
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

            {form.layout !== "equip3" && (
              <div className="space-y-3">
                <h3 className="text-xl font-semibold">Skills</h3>
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
              <>
                <label className="flex flex-col gap-2 text-sm text-slate-300">
                  Número de Munição
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.equip3Number ?? ""}
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
                      value={form.linhaDeTiro ?? ""}
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
                      2. Bloco 2 (Effects/01)
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.effect2Number ?? ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            effect2Number: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                        className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-center text-sm text-white"
                        placeholder="Nº"
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
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition ${
                            form.effect2Icon === item.id
                              ? "border-amber-400 bg-[#EDE4D7]"
                              : "border-white/20 bg-[#D9CCBE]"
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

                  <div className="space-y-2">
                    <span className="text-sm font-medium text-slate-300">
                      3. Bloco 3 (Effects/02)
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.effect3Number ?? ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            effect3Number: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                        className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-center text-sm text-white"
                        placeholder="Nº"
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
                      4. Bloco 4 (Effects/03)
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.effect4Number ?? ""}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            effect4Number: e.target.value.replace(/\D/g, ""),
                          }))
                        }
                        className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-center text-sm text-white"
                        placeholder="Nº"
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

                  <div className="flex flex-wrap gap-2 justify-center items-center">
                    {effectIconOptions04.map((item) => {
                      const selected = form.selectedSkills.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setForm((prev) => {
                              const exists = prev.selectedSkills.includes(
                                item.id
                              );
                              const next = exists
                                ? prev.selectedSkills.filter(
                                    (id) => id !== item.id
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
                          title={item.label}
                        >
                          <img
                            src={item.src}
                            alt={item.label}
                            className="h-8 w-8 object-contain"
                          />
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 text-xs uppercase tracking-[0.3em] text-slate-300">
                    {form.selectedSkills.length === 0
                      ? ""
                      : form.selectedSkills.map((skillId) => {
                          const skill = effectIconOptions04.find(
                            (o) => o.id === skillId
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
                iconOptionsA={iconOptionsA}
                skillIconOptions={skillIconOptions}
                effect2IconOptions={effect2IconOptions}
                effect3IconOptions={effect3IconOptions}
                effect4IconOptions={effect4IconOptions}
                effectIconOptions04={effectIconOptions04}
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
              skillIconOptions={skillIconOptions}
              effect2IconOptions={effect2IconOptions}
              effect3IconOptions={effect3IconOptions}
              effect4IconOptions={effect4IconOptions}
              effectIconOptions04={effectIconOptions04}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
