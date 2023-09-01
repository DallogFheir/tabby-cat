export type ColorIndicatorOption = "off" | "begin" | "end";

export interface Options {
  colorIndicator: ColorIndicatorOption;
  removeEmptyGroups: boolean;
  saveSessions: boolean;
}

export interface OptionsChange {
  [key: string]: browser.storage.StorageChange;
}
