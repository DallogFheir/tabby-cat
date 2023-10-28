import type { ValuesOf } from "./common";

export const EXTENSION_COMMANDS = {
  OPEN_NEW_TAB_IN_GROUP: "open-new-tab-in-group",
} as const;
export type ExtensionCommand = ValuesOf<typeof EXTENSION_COMMANDS>;

export const MESSAGE_TYPES = { UPDATE: "UPDATE" } as const;
export type MessageType = ValuesOf<typeof MESSAGE_TYPES>;
export interface UpdateMessage {
  messageType: typeof MESSAGE_TYPES.UPDATE;
  tabIds: number[];
}

export const CONTENT_SCRIPT_CHANGE_ACTIONS = {
  TITLE: "TITLE",
  FAVICON: "FAVICON",
} as const;
export type ContentScriptChangeAction = ValuesOf<
  typeof CONTENT_SCRIPT_CHANGE_ACTIONS
>;
export interface ContentScriptMessage {
  changeAction: ContentScriptChangeAction;
  msg: string;
}
