export interface Options {
  colorIndicator: "off" | "begin" | "end";
}

export interface OptionsChange {
  [key: string]: browser.storage.StorageChange;
}
