import type { ValuesOf } from "./models/common";

export const TEXTS = {
  CONSTRUCTOR_USED_ERROR_MSG: "Use TabbyCat.getInstance() instead.",
  NEW_GROUP_TITLE: "New group",
  NEW_TAB_TITLE: "New tab",
  MENU_OPEN_IN_TITLE: "Open in ",
  INVALID_TAB_ACTION_ERROR_MSG: "Invalid tab action: ",
  INVALID_EXTENSION_COMMAND_ERROR_MSG: "Invalid command: ",
  INVALID_ACTION_ERROR_MSG: "Invalid action: ",
  POPUP_SAVE_ICON_TITLES: {
    ADD: "add",
    SAVE: "save",
  },
  LOCK_NOT_ACQUIRED_ERROR_MSG: "Lock had not been acquired.",
} as const;
export type PopupSaveIconTitle = ValuesOf<typeof TEXTS.POPUP_SAVE_ICON_TITLES>;
export const MENU_IDS = {
  GROUP: "group-",
  OPEN_GROUP_IN: "open-group-",
} as const;
export const MENU_TYPES = {
  RADIO: "radio",
  NORMAL: "normal",
} as const;
export const STORAGE_KEYS = {
  TAB_GROUPS: "tabGroups",
  OPTIONS: "options",
} as const;
export const ALPINE_DATA_NAMES = {
  TAB_GROUPS: "tabGroups",
  OPTIONS: "options",
} as const;
export const MENU_CONTEXTS = { TAB: "tab", LINK: "link" } as const;
export const ALLOWED_PROTOCOLS = ["http", "https"] as const;
export const WATCHED_TAB_PROPERTIES = [
  "status",
  "title",
  "url",
  "favIconUrl",
] as const;
export const INSTALL__REASON = "install";
export const NEW_TAB_URL = "about:newtab";
export const STATUS_COMPLETE = "complete";
export const FAVICON_LINK_SELECTOR = "link[rel~='icon']";
export const LINK_ELEMENT = "link";
export const FAVICON_REL_ATTRIBUTE = "icon";
export const POPUP_UPDATE_EVENT_NAME = "x-tabbycat-update";
export const DEFAULT_SHORTCUT = ["Ctrl", "+", "Shift", "+", "L"];
export const TABBYCAT_DATA_URL_REGEXP =
  /x-tabby-cat=(e81224|f7630c|fff100|16c60c|0078d7|886ce4|8e562e)\/(\d+)/;
export const MENU_ID_REGEXP = /^(?:open-)?group-(\d+)$/;
export const SHORTCUT_KEY_SEPARATOR_REGEXP = /(\+)/g;
