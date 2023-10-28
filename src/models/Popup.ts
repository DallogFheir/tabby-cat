import { ValuesOf } from "./common";

export const TAB_GROUP_ACTIONS = {
  SHOW: "SHOW",
  HIDE: "HIDE",
} as const;
export type TabGroupAction = ValuesOf<typeof TAB_GROUP_ACTIONS>;
export const CLOSE_ACTION = "CLOSE";
export type ActionIcon = TabGroupAction | typeof CLOSE_ACTION;
