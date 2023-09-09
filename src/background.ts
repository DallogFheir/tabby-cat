import type { Maybe } from "./models/Maybe";
import type { Options, OptionsChange } from "./models/Options";
import {
  colorsToDots,
  type Color,
  type TabAction,
  type TabGroup,
} from "./models/Tabs";
import { getTabGroups, getOptions, updateTabTitle } from "./common";

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
    this.#initOptionsListener();
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
    const tabGroups: TabGroup[] = tabs
      .filter(
        (tab) =>
          tab.id !== undefined &&
          tab.url !== undefined &&
          !this.#isSpecialTab(tab.url)
      )
      .map((tab) => {
        const color = this.#getColor(colors);
        colors.push(color);

        return {
          groupId: groupId++,
          groupName: tab?.title ?? "New group",
          color,
          hidden: false,
          tabs: [{ id: tab.id!, url: tab.url! }],
          updatesToGo: 0,
        };
      });
    await this.#saveTabGroups(tabGroups);

    await browser.storage.sync.set({
      options: JSON.stringify({
        colorIndicator: "begin",
        removeEmptyGroups: true,
        saveSessions: true,
      } satisfies Options),
    });

    await this.#updateAllTabsTitles();
  }

  async handleStartup(): Promise<void> {
    const options = await getOptions();

    if (options) {
      if (options.saveSessions) {
        const tabGroups = await getTabGroups();
        this.#creatingTabs = true;
        const createTabGroupsPromises =
          tabGroups?.map(async (tabGroup) => {
            const createTabsPromises = tabGroup.tabs.map(async (tab) => {
              const newTab = await browser.tabs.create({
                url: tab.url,
              });

              const newTabId = newTab.id;
              if (newTabId) {
                tab.id = newTabId;
              }
            });

            return Promise.all(createTabsPromises);
          }) ?? [];
        await Promise.all(createTabGroupsPromises);
        this.#creatingTabs = false;
      } else {
        await this.#saveTabGroups([]);
      }
    }
  }

  #isSpecialTab(url: Maybe<string>): boolean {
    return !url || url.startsWith("about:") || url.startsWith("moz-extension:");
  }

  async #saveTabGroups(tabGroups: TabGroup[]): Promise<void> {
    await browser.storage.sync.set({
      tabGroups: JSON.stringify(tabGroups),
    });
  }

  #getColor(currentColors: Color[]): Color {
    const colors = Object.keys(colorsToDots) as (keyof typeof colorsToDots)[];
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

    browser.menus.removeAll();

    if (!this.#isSpecialTab(tab.url)) {
      tabGroups.forEach((group) => {
        browser.menus.create({
          id: `group-${group.groupId}`,
          title: group.groupName,
          type: "radio",
          checked:
            group.tabs.find((tabInGroup) => tabInGroup.id === tab.id) !==
            undefined,
          contexts: ["tab"],
        });
      });

      browser.menus.create({
        id: "separator",
        type: "separator",
        contexts: ["tab"],
      });

      browser.menus.create({
        id: "new-group",
        title: "New group...",
        contexts: ["tab"],
      });
    }

    browser.menus.refresh();
  }

  async #handleMenuClick(
    info: browser.menus.OnClickData,
    tab: browser.tabs.Tab
  ): Promise<void> {
    const newGroupId = Number(
      String(info.menuItemId).match(/^group-(\d+)$/)?.[1] ?? NaN
    );
    const tabId = tab.id;
    const tabUrl = tab.url;
    const tabGroups = await getTabGroups();

    const oldGroup = tabGroups?.find((tabGroup) =>
      (tabGroup.tabs.map(({ id }) => id) as (number | undefined)[]).includes(
        tabId
      )
    );
    const newGroup = tabGroups?.find(
      (tabGroup) => tabGroup.groupId === newGroupId
    );

    if (
      newGroupId &&
      tabGroups &&
      tabId !== undefined &&
      tabUrl !== undefined &&
      oldGroup &&
      newGroup
    ) {
      oldGroup.tabs = oldGroup.tabs.filter(
        (tabInGroup) => tabInGroup.id !== tabId
      );

      newGroup.tabs.push({ id: tabId, url: tabUrl });

      await this.#saveTabGroups(tabGroups);
    }
  }

  #initContextMenuListener(): void {
    browser.menus.onShown.addListener(this.#updateMenu);
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
      let freeId = 1;
      tabGroups
        .sort((a, b) => a.groupId - b.groupId)
        .every((group) => {
          if (group.groupId === freeId) {
            freeId++;
            return true;
          }

          return false;
        });

      const res = tabGroups.concat([
        {
          groupId: freeId,
          groupName: tab?.title ?? "New group",
          color: this.#getColor(tabGroups.map((tabGroup) => tabGroup.color)),
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

          const removeEmptyGroups =
            (await getOptions())?.removeEmptyGroups ?? true;

          let res = tabGroups.map(
            (tabGroup) =>
              ({
                ...tabGroup,
                tabs: tabGroup.tabs.filter(
                  (tabInGroup) => tabInGroup.id !== tabId
                ),
              }) satisfies TabGroup
          );
          if (removeEmptyGroups) {
            res = res.filter((tabGroup) => tabGroup.tabs.length > 0);
          }

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

  async #initOptionsListener(): Promise<void> {
    /* eslint-disable-next-line */
    /* @ts-ignore */
    browser.storage.sync.onChanged.addListener((changes: OptionsChange) => {
      const options = changes.options;

      if (options !== undefined) {
        this.#updateAllTabsTitles();
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
