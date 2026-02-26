import type { TutorialLayout } from "./tutorialTypes";
import {
  getDefaultTutorialPagesByGame,
  createEmptyTutorialPage,
  createEmptyTutorialBlock,
} from "./tutorialTypes";

export {
  getDefaultTutorialPagesByGame,
  createEmptyTutorialPage,
  createEmptyTutorialBlock,
};

/** Fallback para compatibilidade: uma página vazia por jogo (usado quando não há dados no DB). */
const defaults = getDefaultTutorialPagesByGame();

export const re3TutorialLayout: TutorialLayout = defaults.RE3;
export const mhTutorialLayout: TutorialLayout = defaults.MH;
