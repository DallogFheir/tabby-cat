import Alpine from "alpinejs";
import type { Maybe } from "../models/Maybe";
import type { TabGroup } from "../models/Tabs";
import type { TabGroupAction, ActionIcon } from "../models/Popup";
import type { AlpineTabGroupsData } from "../models/Alpine";
import { getTabGroups, getOptions, updateTabTitle } from "../common";

Alpine.data(
  "tabGroups",
  () =>
    ({
      currentTabId: null,
      tabGroups: [],

      async init() {
        this.tabGroups = (await getTabGroups()) ?? [];

        const activeTabs = await browser.tabs.query({ active: true });
        this.currentTabId = activeTabs[0].id ?? null;
      },

      async dispatchUpdateEvent(detail: unknown = null): Promise<void> {
        if (detail === null) {
          const tabGroups = await getTabGroups();

          if (!tabGroups) {
            return;
          }

          detail = { tabGroups };
        }

        const updateEvent = new CustomEvent("x-tabbycat-update", {
          detail,
        });
        document.body.dispatchEvent(updateEvent);
      },

      async showHideGroup(
        groupId: number,
        action: TabGroupAction
      ): Promise<void> {
        let func: (tabIds: number | number[]) => Promise<void | number[]>;
        switch (action) {
          case "HIDE": {
            func = browser.tabs.hide;
            break;
          }
          case "SHOW": {
            func = browser.tabs.show;
            break;
          }
          default: {
            throw new Error(`Unknown action: ${action}.`);
          }
        }

        const tabGroups = await getTabGroups();

        if (tabGroups) {
          const tabGroup = tabGroups.find(
            (tabGroup) => tabGroup.groupId === groupId
          );

          if (tabGroup) {
            const tabsInGroup = await Promise.all(
              tabGroup.tabs.map(async ({ id }) => await browser.tabs.get(id))
            );
            const activeTab = tabsInGroup.find((tab) => tab.active);
            if (action === "HIDE" && activeTab !== undefined) {
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
            tabGroup.hidden = action === "HIDE";
            browser.storage.sync.set({
              tabGroups: JSON.stringify(tabGroups),
            });

            const activeTabs = await browser.tabs.query({ active: true });
            this.currentTabId = activeTabs[0].id;

            await this.dispatchUpdateEvent({ tabGroups });
          }
        }
      },

      async closeGroup(groupId: number): Promise<void> {
        const tabGroups = await getTabGroups();
        const options = await getOptions();

        if (tabGroups && options) {
          if (options.removeEmptyGroups) {
            await this.removeGroup(groupId);
          } else {
            const tabGroup = tabGroups.find(
              (tabGroup) => tabGroup.groupId === groupId
            );

            if (tabGroup) {
              await browser.tabs.remove(tabGroup.tabs.map(({ id }) => id));

              tabGroup.tabs = [];

              await browser.storage.sync.set({
                tabGroups: JSON.stringify(tabGroups),
              });

              const activeTabs = await browser.tabs.query({ active: true });
              this.currentTabId = activeTabs[0].id;

              await this.dispatchUpdateEvent({ tabGroups });
            }
          }
        }
      },

      async removeGroup(groupId: number): Promise<void> {
        const tabGroups = await getTabGroups();

        if (tabGroups) {
          const tabGroup = tabGroups.find(
            (tabGroup) => tabGroup.groupId === groupId
          );

          if (tabGroup) {
            await browser.tabs.remove(tabGroup.tabs.map(({ id }) => id));

            const newTabGroups = tabGroups.filter(
              (oldTabGroup) => oldTabGroup !== tabGroup
            );
            await browser.storage.sync.set({
              tabGroups: JSON.stringify(newTabGroups),
            });

            await this.dispatchUpdateEvent({ tabGroups: newTabGroups });
          }
        }
      },

      async removeAllGroups(): Promise<void> {
        const tabGroups = await getTabGroups();

        if (tabGroups) {
          const tabIds = tabGroups.reduce((tabIdsAcc, tabGroup) => {
            tabIdsAcc.push(...tabGroup.tabs.map(({ id }) => id));
            return tabIdsAcc;
          }, [] as number[]);

          await browser.tabs.remove(tabIds);

          await browser.storage.sync.set({
            tabGroups: JSON.stringify([]),
          });

          await this.dispatchUpdateEvent({ tabGroups: [] });
        }
      },

      async openTabInGroup(groupId: number): Promise<void> {
        const tab = await browser.tabs.create({});
        const tabGroups = await getTabGroups();

        if (tabGroups && tab.id !== undefined) {
          const tabGroup = tabGroups.find(
            (tabGroup) => tabGroup.groupId === groupId
          );

          if (tabGroup) {
            tabGroup.tabs.push({ id: tab.id, url: tab.url ?? "New Tab" });

            await browser.storage.sync.set({
              tabGroups: JSON.stringify(tabGroups),
            });
          }
        }
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
        const currentTabId = currentTab?.id;
        const currentTabUrl = currentTab?.url;
        const tabGroups = await getTabGroups();
        const options = await getOptions();

        if (currentTabId && currentTabUrl && tabGroups && options) {
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
          await this.dispatchUpdateEvent({ tabGroups: newTabGroups });
          await updateTabTitle(currentTabId);
        }
      },

      async getTabTitle(tabId: number): Promise<string> {
        const tab = await browser.tabs.get(tabId);
        const title = tab.title;

        if (title === undefined) {
          return "New tab";
        }

        const dots = ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚫", "⚪"];
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

      async shouldIconBeDisabled(
        icon: ActionIcon,
        tabCount: number
      ): Promise<boolean> {
        if (tabCount === 0) {
          return true;
        }

        if (icon === "HIDE") {
          const visibleTabsCount = (await browser.tabs.query({ hidden: false }))
            .length;

          if (visibleTabsCount === 1) {
            return true;
          }
        }

        return false;
      },

      async shouldAssignIconBeDisabled(tabGroup: TabGroup): Promise<boolean> {
        const currentTab = (await browser.tabs.query({ active: true }))[0];
        const currentTabId = currentTab?.id;

        if (currentTabId) {
          return tabGroup.tabs.map((tab) => tab.id).includes(currentTabId);
        }

        return false;
      },

      async isTabCurrent(tabId: number): Promise<boolean> {
        const tab = await browser.tabs.get(tabId);
        return tab.active;
      },
    }) satisfies AlpineTabGroupsData
);

Alpine.start();
