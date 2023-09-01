import type { Options } from "./Options";
import type { ActionIcon, TabGroupAction } from "./Popup";
import type { TabGroup } from "./Tabs";

export interface AlpineData {
  init(): void;
}

export interface AlpineOptionsData extends AlpineData {
  options: Options;
  setOptions(
    optionName: keyof Options,
    value: Options[keyof Options]
  ): Promise<void>;
}

export interface AlpineTabGroupsData extends AlpineData {
  tabGroups: TabGroup[];
  showHideGroup(groupId: number, action: TabGroupAction): Promise<void>;
  closeGroup(groupId: number): Promise<void>;
  removeGroup(groupId: number): Promise<void>;
  getTabTitle(tabId: number): Promise<string>;
  shouldIconBeDisabled(icon: ActionIcon, tabCount: number): Promise<boolean>;
}
