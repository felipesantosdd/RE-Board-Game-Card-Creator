/**
 * IndexedDB compartilhado (cards, decks, overlays, tutorial-texts).
 * Versão 4: store "tutorial-texts" persiste layout completo (páginas com textos, posições e estilos).
 */

import type { TutorialPage } from "@/data/tutorialTypes";
import {
  createEmptyTutorialBlock,
  normalizeTutorialPage,
} from "@/data/tutorialTypes";

const APP_DB_NAME = "re-card-creator";
const APP_DB_VERSION = 4;

export const OVERLAY_STORE_NAME = "overlays";
export const CARDS_STORE_NAME = "cards";
export const DECKS_STORE_NAME = "decks";
export const TUTORIAL_TEXTS_STORE_NAME = "tutorial-texts";

export const openAppDb = (): Promise<IDBDatabase | null> => {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = window.indexedDB.open(APP_DB_NAME, APP_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OVERLAY_STORE_NAME)) {
        db.createObjectStore(OVERLAY_STORE_NAME);
      }
      if (!db.objectStoreNames.contains(CARDS_STORE_NAME)) {
        db.createObjectStore(CARDS_STORE_NAME);
      }
      if (!db.objectStoreNames.contains(DECKS_STORE_NAME)) {
        db.createObjectStore(DECKS_STORE_NAME);
      }
      if (!db.objectStoreNames.contains(TUTORIAL_TEXTS_STORE_NAME)) {
        db.createObjectStore(TUTORIAL_TEXTS_STORE_NAME);
      }
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      console.error("Erro ao abrir IndexedDB.", request.error);
      resolve(null);
    };
  });
};

/** Formato antigo: só textos (mantido para migração) */
export type TutorialPageTexts = {
  titulo1: string;
  titulo2: string;
  texto1: string;
  texto2: string;
};

export type TutorialTextsByGame = {
  RE3: TutorialPageTexts[];
  MH: TutorialPageTexts[];
};

/** Layout completo por jogo (textos + posições + estilos + pageNumber) */
export type TutorialPagesByGame = {
  RE3: TutorialPage[];
  MH: TutorialPage[];
};

const TUTORIAL_TEXTS_KEY = "tutorial-texts";
const TUTORIAL_PAGES_KEY = "tutorial-pages";

/** Detecta se o dado é formato antigo (só textos) */
function isLegacyTextsFormat(
  data: unknown
): data is TutorialTextsByGame {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.RE3) || !Array.isArray(d.MH)) return false;
  const first = d.RE3[0] ?? d.MH[0];
  if (!first || typeof first !== "object") return false;
  const p = first as Record<string, unknown>;
  return (
    typeof p.titulo1 === "string" &&
    typeof p.titulo2 === "string" &&
    p.top === undefined
  );
}

/** Carrega layout completo dos tutoriais. Se existir formato antigo, migra e salva o novo. */
export const getTutorialPagesFromDb = async (
  fallbackLayout: TutorialPagesByGame
): Promise<TutorialPagesByGame> => {
  const db = await openAppDb();
  if (!db) return fallbackLayout;
  return new Promise((resolve) => {
    const tx = db.transaction(TUTORIAL_TEXTS_STORE_NAME, "readwrite");
    const store = tx.objectStore(TUTORIAL_TEXTS_STORE_NAME);
    const requestPages = store.get(TUTORIAL_PAGES_KEY);
    const requestLegacy = store.get(TUTORIAL_TEXTS_KEY);
    let done = 0;
    let result: TutorialPagesByGame | null = null;
    let legacy: TutorialTextsByGame | null = null;

    const finish = () => {
      done++;
      if (done < 2) return;
      db.close();
      if (result && Array.isArray(result.RE3) && Array.isArray(result.MH)) {
        const normalized: TutorialPagesByGame = {
          RE3: result.RE3.map(normalizeTutorialPage),
          MH: result.MH.map(normalizeTutorialPage),
        };
        resolve(normalized);
        return;
      }
      if (legacy && isLegacyTextsFormat(legacy)) {
        const defaultBlock = createEmptyTutorialBlock();
        const migrated: TutorialPagesByGame = {
          RE3: fallbackLayout.RE3.map((page, i) => {
            const t = legacy!.RE3[i];
            if (!t) return page;
            return {
              ...page,
              titles: [
                { ...(page.titles[0] ?? defaultBlock), text: t.titulo1 ?? "" },
                ...(t.titulo2 ? [{ ...defaultBlock, text: t.titulo2 }] : []),
              ],
              descriptions: [
                { ...(page.descriptions[0] ?? defaultBlock), text: t.texto1 ?? "" },
                ...(t.texto2 ? [{ ...defaultBlock, text: t.texto2 }] : []),
              ],
            };
          }),
          MH: fallbackLayout.MH.map((page, i) => {
            const t = legacy!.MH[i];
            if (!t) return page;
            return {
              ...page,
              titles: [
                { ...(page.titles[0] ?? defaultBlock), text: t.titulo1 ?? "" },
                ...(t.titulo2 ? [{ ...defaultBlock, text: t.titulo2 }] : []),
              ],
              descriptions: [
                { ...(page.descriptions[0] ?? defaultBlock), text: t.texto1 ?? "" },
                ...(t.texto2 ? [{ ...defaultBlock, text: t.texto2 }] : []),
              ],
            };
          }),
        };
        saveTutorialPagesToDb(migrated);
        resolve(migrated);
        return;
      }
      resolve(fallbackLayout);
    };

    requestPages.onsuccess = () => {
      result = requestPages.result ?? null;
      finish();
    };
    requestPages.onerror = () => {
      finish();
    };
    requestLegacy.onsuccess = () => {
      legacy = requestLegacy.result ?? null;
      finish();
    };
    requestLegacy.onerror = () => {
      finish();
    };
  });
};

/** Salva layout completo (textos + posições + estilos). */
export const saveTutorialPagesToDb = async (
  data: TutorialPagesByGame
): Promise<void> => {
  const db = await openAppDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(TUTORIAL_TEXTS_STORE_NAME, "readwrite");
    const store = tx.objectStore(TUTORIAL_TEXTS_STORE_NAME);
    store.put(data, TUTORIAL_PAGES_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      console.error("Erro ao salvar tutorial pages no IndexedDB.", tx.error);
      db.close();
      resolve();
    };
  });
};

/** @deprecated Use getTutorialPagesFromDb. Mantido para compatibilidade. */
export const getTutorialTextsFromDb = async (): Promise<TutorialTextsByGame | null> => {
  const db = await openAppDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(TUTORIAL_TEXTS_STORE_NAME, "readonly");
    const store = tx.objectStore(TUTORIAL_TEXTS_STORE_NAME);
    const request = store.get(TUTORIAL_TEXTS_KEY);
    request.onsuccess = () => {
      db.close();
      resolve((request.result as TutorialTextsByGame | undefined) ?? null);
    };
    request.onerror = () => {
      db.close();
      resolve(null);
    };
  });
};

/** @deprecated Use saveTutorialPagesToDb. Mantido para compatibilidade. */
export const saveTutorialTextsToDb = async (
  data: TutorialTextsByGame
): Promise<void> => {
  const db = await openAppDb();
  if (!db) return;
  return new Promise((resolve) => {
    const tx = db.transaction(TUTORIAL_TEXTS_STORE_NAME, "readwrite");
    const store = tx.objectStore(TUTORIAL_TEXTS_STORE_NAME);
    store.put(data, TUTORIAL_TEXTS_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      resolve();
    };
  });
};
