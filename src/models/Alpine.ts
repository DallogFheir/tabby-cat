import type { Maybe } from "./Maybe";
import type { Options } from "./Options";
import type { ActionIcon, TabGroupAction } from "./Popup";
import { colorsToDots, type Color, type TabGroup } from "./Tabs";

export interface AlpineData {
  init(): void;
  colorsToDots: typeof colorsToDots;
}

export interface AlpineOptionsData extends AlpineData {
  options: Options;
  isColorDisabled(color: Color): boolean;
  setOptions(
    optionName: keyof Options,
    value: Options[keyof Options]
  ): Promise<void>;
  toggleColor(color: Color): Promise<void>;
}

export interface AlpineTabGroupsData extends AlpineData {
  currentTabId: Maybe<number>;
  tabGroups: TabGroup[];
  groupBeingEditedId: Maybe<number>;
  inputtedName: string;
  selectedColor: Color;
  dispatchUpdateEvent(): Promise<void>;
  showHideGroup(groupId: number, action: TabGroupAction): Promise<void>;
  closeGroup(groupId: number): Promise<void>;
  removeGroup(groupId: number): Promise<void>;
  removeAllGroups(): Promise<void>;
  openTabInGroup(groupId: number): Promise<void>;
  peekTab(tabId: number): Promise<void>;
  stopPeek(): Promise<void>;
  goToTab(tabId: number): Promise<void>;
  assignCurrentTabToGroup(groupId: number): Promise<void>;
  getTabTitle(tabId: number): Promise<string>;
  getTabFavicon(tabId: number): Promise<Maybe<string>>;
  getGroup(groupId: number): Promise<Maybe<TabGroup>>;
  shouldIconBeDisabled(icon: ActionIcon, tabCount: number): Promise<boolean>;
  shouldAssignIconBeDisabled(tabGroup: TabGroup): boolean;
  isTabVisible(tabId: number): Promise<boolean>;
  isTabCurrent(tabId: number): Promise<boolean>;
  editGroup(groupId: number): Promise<void>;
  selectColor(color: Color): void;
  getSaveIconClass(): string;
  saveGroup(): void;
  dismiss(): void;
}
