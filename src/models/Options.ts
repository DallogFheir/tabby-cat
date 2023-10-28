import type { Color } from "./Tabs";
import { ValuesOf } from "./common";

export const COLOR_INDICATOR_OPTIONS = {
  OFF: "off",
  BEGIN: "begin",
  END: "end",
} as const;

export const OPTIONS = {
  COLOR_INDICATOR: "colorIndicator",
  REMOVE_EMPTY_GROUPS: "removeEmptyGroups",
  COLORS: "colors",
} as const;
export interface Options {
  colorIndicator: ValuesOf<typeof COLOR_INDICATOR_OPTIONS>;
  removeEmptyGroups: boolean;
  colors: Color[];
}

export interface OptionsChange {
  [key: string]: browser.storage.StorageChange;
}
