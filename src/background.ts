import type { Maybe } from "./models/Maybe";
import type { Options, OptionsChange } from "./models/Options";
import {
  colorsToDots,
  type Color,
  type TabAction,
  type TabGroup,
  type UpdateToGo,
  type Tab,
} from "./models/Tabs";
import { getTabGroups, getOptions, updateTabTitle, getFreeId } from "./common";

class TabbyCat {
  static #isInternallyConstructing = false;
  static #instance: Maybe<TabbyCat>;
  #creatingTabs = false;

  constructor() {
    if (!TabbyCat.#isInternallyConstructing) {
      throw new TypeError("Use TabbyCat.initialize() instead.");
    }

    TabbyCat.#isInternallyConstructing = false;
    this.#initContextMenuListener();
    this.#initTabListener();
    this.#initStorageListener();
    this.#initCommandListener();
  }

  static getInstance(): TabbyCat {
    if (!TabbyCat.#instance) {
      TabbyCat.#isInternallyConstructing = true;
      TabbyCat.#instance = new TabbyCat();
    }

    return TabbyCat.#instance;
  }

  async install(): Promise<void> {
    const tabs = await browser.tabs.query({});
    let groupId = 1;
    const colors: Color[] = [];
    const tabGroupsPromises: Promise<TabGroup>[] = tabs
      .filter(
        (tab) =>
          tab.id !== undefined &&
          tab.url !== undefined &&
          !this.#isSpecialTab(tab.url)
      )
      .map(async (tab) => {
        const color = await this.#getColor(colors);
        colors.push(color);

        return {
          groupId: groupId++,
          groupName: tab?.title ?? "New group",
          color,
          hidden: false,
          tabs: [{ id: tab.id!, url: tab.url! }],
          updatesToGo: 0 as UpdateToGo,
        };
      });
    const tabGroups = await Promise.all(tabGroupsPromises);
    await this.#saveTabGroups(tabGroups);

    await browser.storage.sync.set({
      options: JSON.stringify({
        colorIndicator: "begin",
        removeEmptyGroups: true,
        saveSessions: true,
        colors: Object.keys(colorsToDots) as Color[],
      } satisfies Options),
    });

    await this.#updateAllTabsTitles();

    browser.runtime.openOptionsPage();
  }

  async handleStartup(): Promise<void> {
    const options = await getOptions();

    if (options) {
      if (options.saveSessions) {
        const defaultTabs = await browser.tabs.query({});
        const defaultTabIds = defaultTabs
          .map((tab) => tab.id)
          .filter((tabId) => tabId !== undefined);

        const tabGroups = await getTabGroups();

        if (!tabGroups) {
          return;
        }

        const savedTabs = tabGroups.reduce(
          (acc, tabGroup) => [...acc, ...tabGroup.tabs],
          [] as Tab[]
        );
        if (savedTabs.length > 0) {
          this.#creatingTabs = true;
          const createTabsPromises = savedTabs.map(async (tab) => {
            const newTab = await browser.tabs.create({
              url: tab.url,
            });

            const newTabId = newTab.id;
            if (newTabId) {
              tab.id = newTabId;
            }
          });

          await Promise.all(createTabsPromises);
          this.#creatingTabs = false;

          await browser.tabs.remove(defaultTabIds as number[]);
        }
      } else {
        await this.#saveTabGroups([]);
      }
    }
  }

  #isSpecialTab(url: Maybe<string>): boolean {
    return !url || url.startsWith("about:") || url.startsWith("moz-extension:");
  }

  async #saveTabGroups(tabGroups: TabGroup[]): Promise<void> {
    const removeEmptyGroups = (await getOptions())?.removeEmptyGroups;
    if (removeEmptyGroups) {
      tabGroups = tabGroups.filter((tabGroup) => tabGroup.tabs.length > 0);
    }

    await browser.storage.sync.set({
      tabGroups: JSON.stringify(tabGroups),
    });
  }

  async #getColor(currentColors: Color[]): Promise<Color> {
    const options = await getOptions();
    const colors = options
      ? options.colors
      : (Object.keys(colorsToDots) as (keyof typeof colorsToDots)[]);

    let colorsToPick: Readonly<Color[]> = colors.filter(
      (color) => !currentColors.includes(color)
    );
    if (colorsToPick.length === 0) {
      colorsToPick = colors;
    }

    return colorsToPick[Math.floor(Math.random() * colorsToPick.length)];
  }

  async #updateMenu(
    _: browser.menus.OnClickData,
    tab: browser.tabs.Tab
  ): Promise<void> {
    const tabGroups = JSON.parse(
      ((await browser.storage.sync.get("tabGroups"))
        ?.tabGroups as Maybe<string>) ?? "[]"
    ) as TabGroup[];

    await browser.menus.removeAll();

    if (!this.#isSpecialTab(tab.url) && tabGroups.length > 1) {
      tabGroups.forEach((group) => {
        const colorIndicator = colorsToDots[group.color];

        browser.menus.create({
          id: `group-${group.groupId}`,
          title: `${colorIndicator} ${group.groupName}`,
          type: "radio",
          checked:
            group.tabs.find((tabInGroup) => tabInGroup.id === tab.id) !==
            undefined,
          contexts: ["tab"],
        });
      });
    }

    tabGroups.forEach((group) => {
      const colorIndicator = colorsToDots[group.color];

      browser.menus.create({
        id: `open-group-${group.groupId}`,
        title: `Open in ${colorIndicator} ${group.groupName}`,
        type: "normal",
        contexts: ["link"],
      });
    });

    await browser.menus.refresh();
  }

  async #handleMenuClick(
    info: browser.menus.OnClickData,
    tab: browser.tabs.Tab
  ): Promise<void> {
    const newGroupId = Number(
      String(info.menuItemId).match(/^(?:open-)?group-(\d+)$/)?.[1] ?? NaN
    );
    const tabGroups = await getTabGroups();
    const newGroup = tabGroups?.find(
      (tabGroup) => tabGroup.groupId === newGroupId
    );

    if (!tabGroups || newGroup === undefined) {
      return;
    }

    if (String(info.menuItemId).startsWith("open-group-")) {
      const linkUrl = info.linkUrl;

      if (linkUrl === undefined) {
        return;
      }

      const newTab = await browser.tabs.create({
        url: info.linkUrl,
      });
      const newTabId = newTab.id;

      if (newTabId === undefined) {
        return;
      }

      newGroup.tabs.push({ id: newTabId, url: linkUrl });
    } else {
      const tabId = tab.id;
      const tabUrl = tab.url;
      const oldGroup = tabGroups?.find((tabGroup) =>
        (tabGroup.tabs.map(({ id }) => id) as (number | undefined)[]).includes(
          tabId
        )
      );

      if (tabId === undefined || tabUrl === undefined || !oldGroup) {
        return;
      }

      oldGroup.tabs = oldGroup.tabs.filter(
        (tabInGroup) => tabInGroup.id !== tabId
      );

      newGroup.tabs.push({ id: tabId, url: tabUrl });
    }

    await this.#saveTabGroups(tabGroups);
    await browser.menus.removeAll();
  }

  #initContextMenuListener(): void {
    browser.menus.onShown.addListener(this.#updateMenu.bind(this));
    browser.menus.onClicked.addListener(this.#handleMenuClick.bind(this));
  }

  async #updateGroupName(tabId: number, title: string): Promise<void> {
    const tabGroups = await getTabGroups();

    if (tabGroups) {
      outer: for (const tabGroup of tabGroups) {
        if (tabGroup.updatesToGo !== 0) {
          for (const tabInGroup of tabGroup.tabs) {
            if (tabInGroup.id === tabId) {
              tabGroup.updatesToGo--;

              if (tabGroup.updatesToGo === 0) {
                tabGroup.groupName = title;
              }

              break outer;
            }
          }
        }
      }
    }
  }

  async #updateAllTabsTitles(): Promise<void> {
    const tabs = await browser.tabs.query({});
    const updateTitlesPromises = tabs
      .filter((tab) => tab.id !== undefined)
      .map(({ id }) => updateTabTitle(id as number));
    await Promise.all(updateTitlesPromises);
  }

  async #createNewGroup(tabId: number): Promise<void> {
    const tabGroups = await getTabGroups();
    const tab = await browser.tabs.get(tabId);
    const tabUrl = tab.url;

    if (
      tabGroups &&
      tabGroups.every(
        (tabGroup) => !tabGroup.tabs.map(({ id }) => id).includes(tabId)
      ) &&
      tabUrl !== undefined
    ) {
      const freeId = getFreeId(tabGroups);

      const res = tabGroups.concat([
        {
          groupId: freeId,
          groupName: tab?.title ?? "New group",
          color: await this.#getColor(
            tabGroups.map((tabGroup) => tabGroup.color)
          ),
          hidden: false,
          tabs: [{ id: tabId, url: tabUrl }],
          updatesToGo: tab.url === "about:newtab" ? 2 : 1,
        },
      ]);

      await this.#saveTabGroups(res);

      await updateTabTitle(tabId);
    }
  }

  async #addToGroup(tabId: number, openerTabId: number): Promise<void> {
    const tabGroups = await getTabGroups();
    const openerTabGroup = tabGroups?.find((tabGroup) =>
      tabGroup.tabs.map(({ id }) => id).includes(openerTabId)
    );
    const tab = await browser.tabs.get(tabId);
    const tabUrl = tab.url;

    if (
      tabGroups &&
      tabGroups.every(
        (tabGroup) => !tabGroup.tabs.map(({ id }) => id).includes(tabId)
      ) &&
      openerTabGroup &&
      tabUrl
    ) {
      openerTabGroup.tabs.push({ id: tabId, url: tabUrl });
      await this.#saveTabGroups(tabGroups);
    }
  }

  async #tabListener(
    tabOrTabId: browser.tabs.Tab | number,
    tabAction: TabAction
  ): Promise<void> {
    const tabGroups = await getTabGroups();

    if (tabGroups) {
      switch (tabAction) {
        case "ADD": {
          if (!this.#creatingTabs) {
            const tab = tabOrTabId as browser.tabs.Tab;

            if (this.#isSpecialTab(tab.url)) {
              return;
            }

            const tabId = tab.id;
            if (tabId) {
              if (tab.openerTabId === undefined) {
                await this.#createNewGroup(tabId);
              } else {
                await this.#addToGroup(tabId, tab.openerTabId);
              }
            }
          }

          break;
        }
        case "REMOVE": {
          const tabId = tabOrTabId as number;

          const res = tabGroups.map(
            (tabGroup) =>
              ({
                ...tabGroup,
                tabs: tabGroup.tabs.filter(
                  (tabInGroup) => tabInGroup.id !== tabId
                ),
              }) satisfies TabGroup
          );

          await this.#saveTabGroups(res);

          break;
        }
        default: {
          throw new Error(`Invalid tab action: ${tabAction}.`);
        }
      }
    }
  }

  async #initTabListener(): Promise<void> {
    browser.tabs.onCreated.addListener((tab) => this.#tabListener(tab, "ADD"));
    browser.tabs.onUpdated.addListener(
      async (tabId) => {
        const { status, title, url } = await browser.tabs.get(tabId);

        if (status === "complete" && !this.#isSpecialTab(url)) {
          const tab = await browser.tabs.get(tabId);
          const tabGroups = await getTabGroups();

          if (
            tabGroups?.every(
              (tabGroup) => !tabGroup.tabs.map(({ id }) => id).includes(tabId)
            )
          ) {
            if (tab.openerTabId === undefined) {
              await this.#createNewGroup(tabId);
            } else {
              await this.#addToGroup(tabId, tab.openerTabId);
            }
          }
        }
        if (
          status === "complete" &&
          title &&
          Object.values(colorsToDots).every((dot) => !title.startsWith(dot))
        ) {
          await this.#updateGroupName(tabId, title);
          await updateTabTitle(tabId);
        }
      },
      /* eslint-disable-next-line */
      /* @ts-ignore */
      {
        properties: ["status", "title", "url"],
      }
    );
    browser.tabs.onRemoved.addListener((tabId) =>
      this.#tabListener(tabId, "REMOVE")
    );
  }

  async #initStorageListener(): Promise<void> {
    /* eslint-disable-next-line */
    /* @ts-ignore */
    browser.storage.sync.onChanged.addListener((changes: OptionsChange) => {
      const options = changes.options;
      const tabGroups = changes.tabGroups;

      if (options !== undefined || tabGroups !== undefined) {
        this.#updateAllTabsTitles();
      }
    });
  }

  #initCommandListener(): void {
    browser.commands.onCommand.addListener(async (command) => {
      switch (command) {
        case "open-new-tab-in-group": {
          const activeTab = (await browser.tabs.query({ active: true }))[0];
          const activeTabId = activeTab.id;

          if (activeTabId === undefined) {
            return;
          }

          const newTab = await browser.tabs.create({ active: true });
          const newTabId = newTab.id;

          if (newTabId === undefined) {
            return;
          }

          await this.#addToGroup(newTabId, activeTabId);

          break;
        }
        default: {
          throw new Error(`Invalid command: ${command}.`);
        }
      }
    });
  }
}

browser.runtime.onInstalled.addListener(({ reason }) => {
  const tabbyCat = TabbyCat.getInstance();

  if (reason === "install") {
    tabbyCat.install();
  }
});
browser.runtime.onStartup.addListener(async () => {
  const tabbyCat = TabbyCat.getInstance();
  tabbyCat.handleStartup();
});
