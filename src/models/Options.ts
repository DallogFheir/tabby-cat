import type { Color } from "./Tabs";

export type ColorIndicatorOption = "off" | "begin" | "end";

export interface Options {
  colorIndicator: ColorIndicatorOption;
  removeEmptyGroups: boolean;
  saveSessions: boolean;
  colors: Color[];
}

export interface OptionsChange {
  [key: string]: browser.storage.StorageChange;
}
