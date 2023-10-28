import Alpine from "alpinejs";
import type { Maybe } from "../models/common";
import {
  colorsToDots,
  type Color,
  type TabGroup,
  UpdateToGo,
} from "../models/Tabs";
import {
  type TabGroupAction,
  type ActionIcon,
  TAB_GROUP_ACTIONS,
} from "../models/Popup";
import type { AlpineTabGroupsData } from "../models/Alpine";
import { getTabGroups, getOptions, updateTabTitle, getFreeId } from "../common";
import CirclePlus from "../icons/fa-icons/circle-plus-solid.svg";
import FloppyDisk from "../icons/fa-icons/floppy-disk-solid.svg";
import { MESSAGE_TYPES, type UpdateMessage } from "../models/Commands";
import {
  ALPINE_DATA_NAMES,
  POPUP_UPDATE_EVENT_NAME,
  type PopupSaveIconTitle,
  TEXTS,
} from "../constants";

Alpine.data(
  ALPINE_DATA_NAMES.TAB_GROUPS,
  () =>
    ({
      currentTabId: null,
      tabGroups: [],
      colorsToDots,
      groupBeingEditedId: null,
      inputtedName: "",
      selectedColor: Object.keys(colorsToDots)[0] as Color,

      async init() {
        this.tabGroups = await getTabGroups();

        const activeTabs = await browser.tabs.query({ active: true });
        this.currentTabId = activeTabs[0].id ?? null;
      },

      async dispatchUpdateEvent(): Promise<void> {
        const tabGroups = await getTabGroups();

        const updateEvent = new CustomEvent(POPUP_UPDATE_EVENT_NAME, {
          detail: {
            tabGroups,
          },
        });
        document.body.dispatchEvent(updateEvent);
      },

      async sortTabs(): Promise<void> {
        const tabs = await browser.tabs.query({});
        const tabGroups = await getTabGroups();

        const tabsWithGroups = tabs
          .filter((tab) => tab.id !== undefined)
          .map((tab) => {
            const tabGroup = tabGroups.find((tabGroup) =>
              tabGroup.tabs.map((tabInGroup) => tabInGroup.id).includes(tab.id!)
            );

            return {
              id: tab.id!,
              groupId: tabGroup?.groupId,
            };
          });

        tabsWithGroups.sort((a, b) => {
          if (a.groupId === undefined) {
            return -1;
          }

          if (b.groupId === undefined) {
            return 1;
          }

          return a.groupId - b.groupId;
        });

        const tabUpdatesPromises = tabsWithGroups.map(
          async (tab, index) =>
            await browser.tabs.move(tab.id, {
              index,
            })
        );

        await Promise.all(tabUpdatesPromises);
      },

      async showHideGroup(
        groupId: number,
        action: TabGroupAction
      ): Promise<void> {
        let func: (tabIds: number | number[]) => Promise<void | number[]>;
        switch (action) {
          case TAB_GROUP_ACTIONS.HIDE: {
            func = browser.tabs.hide;
            break;
          }
          case TAB_GROUP_ACTIONS.SHOW: {
            func = browser.tabs.show;
            break;
          }
          default: {
            throw new Error(TEXTS.INVALID_ACTION_ERROR_MSG + action);
          }
        }

        const tabGroups = await getTabGroups();

        const tabGroup = tabGroups.find(
          (tabGroup) => tabGroup.groupId === groupId
        );

        if (tabGroup) {
          const tabsInGroup = await Promise.all(
            tabGroup.tabs.map(({ id }) => browser.tabs.get(id))
          );
          const activeTab = tabsInGroup.find((tab) => tab.active);
          if (action === TAB_GROUP_ACTIONS.HIDE && activeTab !== undefined) {
            const allTabs = await browser.tabs.query({});

            const activeTabIdx = activeTab.index;
            let finalIdx;
            let addend = 1;
            while (
              (allTabs[(finalIdx = activeTabIdx + addend)]?.hidden ?? true) &&
              (allTabs[(finalIdx = activeTabIdx - addend)]?.hidden ?? true)
            ) {
              addend++;
            }

            const nextOrPreviousTab = allTabs[finalIdx];
            await browser.tabs.update(activeTab.id, { active: false });
            await browser.tabs.update(nextOrPreviousTab.id, { active: true });
          }

          await func(tabGroup.tabs.map(({ id }) => id));
          tabGroup.hidden = action === TAB_GROUP_ACTIONS.HIDE;
          await browser.storage.sync.set({
            tabGroups: JSON.stringify(tabGroups),
          });

          const activeTabs = await browser.tabs.query({ active: true });
          this.currentTabId = activeTabs[0].id;

          await this.dispatchUpdateEvent();
        }
      },

      async closeGroup(groupId: number): Promise<void> {
        const tabGroups = await getTabGroups();
        const options = await getOptions();

        if (options.removeEmptyGroups) {
          await this.removeGroup(groupId);
        } else {
          const tabGroup = tabGroups.find(
            (tabGroup) => tabGroup.groupId === groupId
          );

          if (!tabGroup) {
            throw new Error(TEXTS.TAB_GROUP_FOR_TAB_NOT_FOUND_ERROR_MSG);
          }

          await browser.tabs.remove(tabGroup.tabs.map(({ id }) => id));

          tabGroup.tabs = [];

          await browser.storage.sync.set({
            tabGroups: JSON.stringify(tabGroups),
          });

          const activeTabs = await browser.tabs.query({ active: true });
          this.currentTabId = activeTabs[0].id;

          await this.dispatchUpdateEvent();
        }
      },

      async removeGroup(groupId: number): Promise<void> {
        const tabGroups = await getTabGroups();

        const tabGroup = tabGroups.find(
          (tabGroup) => tabGroup.groupId === groupId
        );

        if (!tabGroup) {
          throw new Error(TEXTS.TAB_GROUP_FOR_TAB_NOT_FOUND_ERROR_MSG);
        }

        const newTabGroups = tabGroups.filter(
          (oldTabGroup) => oldTabGroup !== tabGroup
        );
        await browser.storage.sync.set({
          tabGroups: JSON.stringify(newTabGroups),
        });

        await browser.tabs.remove(tabGroup.tabs.map(({ id }) => id));

        await this.dispatchUpdateEvent();
      },

      async removeAllGroups(): Promise<void> {
        const tabGroups = await getTabGroups();

        const tabIds = tabGroups.reduce((tabIdsAcc, tabGroup) => {
          tabIdsAcc.push(...tabGroup.tabs.map(({ id }) => id));
          return tabIdsAcc;
        }, [] as number[]);

        await browser.storage.sync.set({
          tabGroups: JSON.stringify([]),
        });
        await browser.tabs.remove(tabIds);

        await this.dispatchUpdateEvent();
      },

      async openTabInGroup(groupId: number): Promise<void> {
        const tab = await browser.tabs.create({});
        if (tab.id === undefined) {
          throw new Error(TEXTS.CREATED_NEW_TAB_ID_UNDEFINED_ERROR_MSG);
        }

        const tabGroups = await getTabGroups();

        const tabGroup = tabGroups.find(
          (tabGroup) => tabGroup.groupId === groupId
        );
        if (!tabGroup) {
          throw new Error(TEXTS.TAB_GROUP_FOR_TAB_NOT_FOUND_ERROR_MSG);
        }

        tabGroup.tabs.push({
          id: tab.id,
          url: tab.url ?? TEXTS.NEW_TAB_TITLE,
        });

        await browser.storage.sync.set({
          tabGroups: JSON.stringify(tabGroups),
        });
      },

      async peekTab(tabId: number): Promise<void> {
        await browser.tabs.update(tabId, { active: true });
        await this.dispatchUpdateEvent();
      },

      async stopPeek(): Promise<void> {
        if (this.currentTabId !== null) {
          await browser.tabs.update(this.currentTabId, { active: true });
        }
        await this.dispatchUpdateEvent();
      },

      async goToTab(tabId: number): Promise<void> {
        this.currentTabId = tabId;
        await this.peekTab(tabId);
      },

      async assignCurrentTabToGroup(groupId: number): Promise<void> {
        const currentTab = (await browser.tabs.query({ active: true }))[0];
        if (!currentTab) {
          throw new Error(TEXTS.NO_CURRENT_TAB_ERROR_MSG);
        }

        const currentTabId = currentTab.id;
        if (currentTabId === undefined) {
          throw new Error(TEXTS.TAB_WITH_NO_ID_ERROR_MSG);
        }

        const currentTabUrl = currentTab.url;
        if (currentTabUrl === undefined) {
          throw new Error(TEXTS.TAB_WITH_NO_URL_ERROR_MSG);
        }

        const tabGroups = await getTabGroups();
        const options = await getOptions();

        let newTabGroups = tabGroups.map((tabGroup) => {
          if (tabGroup.tabs.map((tab) => tab.id).includes(currentTabId)) {
            return {
              ...tabGroup,
              tabs: tabGroup.tabs.filter((tab) => tab.id !== currentTabId),
            } satisfies TabGroup;
          }

          if (tabGroup.groupId === groupId) {
            return {
              ...tabGroup,
              tabs: [
                ...tabGroup.tabs,
                { id: currentTabId, url: currentTabUrl },
              ],
            } satisfies TabGroup;
          }

          return tabGroup;
        });

        if (options.removeEmptyGroups) {
          newTabGroups = newTabGroups.filter(
            (tabGroup) => tabGroup.tabs.length > 0
          );
        }

        await browser.storage.sync.set({
          tabGroups: JSON.stringify(newTabGroups),
        });
        await this.dispatchUpdateEvent();
        await updateTabTitle(currentTabId);
      },

      async getTabTitle(tabId: number): Promise<string> {
        const tab = await browser.tabs.get(tabId);
        const title = tab.title;

        if (title === undefined) {
          return TEXTS.NEW_TAB_TITLE;
        }

        const dots = Object.values(colorsToDots);
        return dots.some((dot) => title.startsWith(dot))
          ? title.slice(2)
          : dots.some((dot) => title.endsWith(dot))
          ? title.slice(0, -2)
          : title;
      },

      async getTabFavicon(tabId: number): Promise<Maybe<string>> {
        const tab = await browser.tabs.get(tabId);
        return tab.favIconUrl;
      },

      async getGroup(groupId: number): Promise<TabGroup> {
        const tabGroups = await getTabGroups();
        const tabGroup = tabGroups.find(
          (tabGroup) => tabGroup.groupId === groupId
        );

        if (!tabGroup) {
          throw new Error(TEXTS.TAB_GROUP_WITH_ID_NOT_FOUND_ERROR_MSG);
        }

        return tabGroup;
      },

      async shouldIconBeDisabled(
        icon: ActionIcon,
        tabCount: number
      ): Promise<boolean> {
        if (tabCount === 0) {
          return true;
        }

        if (icon === TAB_GROUP_ACTIONS.HIDE) {
          const visibleTabsCount = (await browser.tabs.query({ hidden: false }))
            .length;

          if (visibleTabsCount === 1) {
            return true;
          }
        }

        return false;
      },

      shouldAssignIconBeDisabled(tabGroup: TabGroup): boolean {
        return (
          tabGroup.tabs.map((tab) => tab.id) as ReadonlyArray<Maybe<number>>
        ).includes(this.currentTabId);
      },

      async isTabVisible(tabId: number): Promise<boolean> {
        const tab = await browser.tabs.get(tabId);
        return tab.active;
      },

      async isTabCurrent(tabId: number): Promise<boolean> {
        return this.currentTabId === tabId;
      },

      async editGroup(groupId: number): Promise<void> {
        const tabGroup = await this.getGroup(groupId);

        this.groupBeingEditedId = groupId;
        this.inputtedName = tabGroup.groupName;
        this.selectedColor = tabGroup.color;
      },

      selectColor(color: Color): void {
        this.selectedColor = color;
      },

      getSaveIconSrc(): string {
        return this.groupBeingEditedId === null ? CirclePlus : FloppyDisk;
      },

      getSaveIconTitle(): PopupSaveIconTitle {
        return this.groupBeingEditedId === null
          ? TEXTS.POPUP_SAVE_ICON_TITLES.ADD
          : TEXTS.POPUP_SAVE_ICON_TITLES.SAVE;
      },

      async saveGroup(): Promise<void> {
        let tabGroups = await getTabGroups();

        let tabGroup: Maybe<TabGroup> = null;
        if (this.groupBeingEditedId !== null) {
          const tabGroup = tabGroups.find(
            (tabGroup) => tabGroup.groupId === this.groupBeingEditedId
          );

          if (!tabGroup) {
            throw new Error(TEXTS.TAB_GROUP_WITH_ID_NOT_FOUND_ERROR_MSG);
          }

          tabGroup.groupName = this.inputtedName;
          tabGroup.color = this.selectedColor;
        } else {
          const freeId = getFreeId(tabGroups);

          tabGroup = {
            groupId: freeId,
            groupName: this.inputtedName,
            color: this.selectedColor,
            hidden: false,
            tabs: [],
            updatesToGo: 0 as UpdateToGo,
          };
          tabGroups = [...tabGroups, tabGroup];
        }

        await browser.storage.sync.set({
          tabGroups: JSON.stringify(tabGroups),
        });
        await this.dispatchUpdateEvent();
        if (tabGroup !== null) {
          await browser.runtime.sendMessage({
            messageType: MESSAGE_TYPES.UPDATE,
            tabIds: tabGroup.tabs.map(({ id }) => id),
          } satisfies UpdateMessage);
        }
        this.dismiss();
      },

      dismiss(): void {
        this.groupBeingEditedId = null;
        this.inputtedName = "";
        this.selectedColor = Object.keys(colorsToDots)[0] as Color;
      },
    }) satisfies AlpineTabGroupsData
);

Alpine.start();
