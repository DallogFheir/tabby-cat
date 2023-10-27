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
import {
  getTabGroups,
  getOptions,
  updateTabTitle,
  updateTabFavicon,
  getFreeId,
} from "./common";
import { Lock } from "./lib/lock";

class TabbyCat {
  static #isInternallyConstructing = false;
  static #instance: Maybe<TabbyCat>;
  #lock = new Lock();

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
    const tabGroupsPromises = tabs
      .filter(
        (tab) =>
          tab.id !== undefined &&
          tab.url !== undefined &&
          !this.#isSpecialTab(tab.url)
      )
      .map(async (tab): Promise<TabGroup> => {
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
        colors: Object.keys(colorsToDots) as Color[],
      } satisfies Options),
    });

    await this.#updateAllTabsTitles();

    browser.runtime.openOptionsPage();
  }

  async handleStartup(): Promise<void> {
    await this.#lock.acquire();
    try {
      const tabs = await browser.tabs.query({});
      const tabGroups = await getTabGroups();

      if (!tabGroups) {
        return;
      }

      const emptiedTabGroups = tabGroups.map((tabGroup) => ({
        ...tabGroup,
        tabs: [] as Tab[],
      }));

      tabs.forEach((tab) => {
        const groupIdMatch = tab.favIconUrl?.match(
          /x-tabby-cat=(e81224|f7630c|fff100|16c60c|0078d7|886ce4|8e562e)\/(\d+)/
        );

        if (!groupIdMatch || !tab.id || !tab.url) {
          return;
        }

        const groupId = Number(groupIdMatch[2]);
        const tabGroup = emptiedTabGroups.find(
          (tabGroup) => tabGroup.groupId === groupId
        );

        if (!tabGroup) {
          return;
        }

        tabGroup.tabs.push({ id: tab.id, url: tab.url });
      });

      await this.#saveTabGroups(emptiedTabGroups);
    } finally {
      this.#lock.release();
    }
  }

  #isSpecialTab(url: Maybe<string>): boolean {
    return !url || (!url.startsWith("http:") && !url.startsWith("https:"));
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
    await this.#lock.acquire();

    try {
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

        await this.#saveTabGroups(tabGroups);
      } else {
        const tabId = tab.id;
        const tabUrl = tab.url;
        const oldGroup = tabGroups?.find((tabGroup) =>
          (
            tabGroup.tabs.map(({ id }) => id) as (number | undefined)[]
          ).includes(tabId)
        );

        if (tabId === undefined || tabUrl === undefined || !oldGroup) {
          return;
        }

        oldGroup.tabs = oldGroup.tabs.filter(
          (tabInGroup) => tabInGroup.id !== tabId
        );

        newGroup.tabs.push({ id: tabId, url: tabUrl });

        await this.#saveTabGroups(tabGroups);
        await updateTabFavicon(tabId);
      }

      await browser.menus.removeAll();
    } finally {
      this.#lock.release();
    }
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

      await this.#saveTabGroups(tabGroups);
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
    await this.#lock.acquire();

    try {
      const tabGroups = await getTabGroups();

      if (tabGroups) {
        switch (tabAction) {
          case "ADD": {
            const tab = tabOrTabId as browser.tabs.Tab;

            if (this.#isSpecialTab(tab.url)) {
              break;
            }

            const tabId = tab.id;
            if (tabId === undefined) {
              break;
            }

            if (tab.openerTabId === undefined) {
              await this.#createNewGroup(tabId);
            } else {
              await this.#addToGroup(tabId, tab.openerTabId);
            }

            await updateTabFavicon(tabId);

            break;
          }
          case "REMOVE": {
            const tabId = tabOrTabId as number;

            const res = tabGroups
              .map(
                (tabGroup) =>
                  ({
                    ...tabGroup,
                    tabs: tabGroup.tabs.filter(
                      (tabInGroup) => tabInGroup.id !== tabId
                    ),
                  }) satisfies TabGroup
              )
              .filter(({ tabs }) => tabs.length !== 0);

            await this.#saveTabGroups(res);

            break;
          }
          default: {
            throw new Error(`Invalid tab action: ${tabAction}.`);
          }
        }
      }
    } finally {
      this.#lock.release();
    }
  }

  async #tabUpdateHandler(tabId: number) {
    await this.#lock.acquire();

    try {
      const { status, title, url } = await browser.tabs.get(tabId);

      if (status === "complete" && url && !this.#isSpecialTab(url)) {
        const tab = await browser.tabs.get(tabId);
        const tabGroups = await getTabGroups();

        const tabsTabGroup = tabGroups?.find((tabGroup) =>
          tabGroup.tabs.map(({ id }) => id).includes(tabId)
        );
        if (tabsTabGroup === undefined) {
          if (tab.openerTabId === undefined) {
            await this.#createNewGroup(tabId);
          } else {
            await this.#addToGroup(tabId, tab.openerTabId);
          }
        } else {
          const tabInTabGroup = tabsTabGroup.tabs.find(
            ({ id }) => id === tabId
          );

          if (!tabInTabGroup || !tabGroups) {
            return;
          }

          tabInTabGroup.url = url;
          await this.#saveTabGroups(tabGroups);
        }
      }

      if (status === "complete" && title) {
        await this.#updateGroupName(tabId, title);
        await updateTabTitle(tabId);
      }

      if (status === "complete") {
        await updateTabFavicon(tabId);
      }
    } finally {
      this.#lock.release();
    }
  }

  async #initTabListener(): Promise<void> {
    browser.tabs.onCreated.addListener((tab) => this.#tabListener(tab, "ADD"));
    browser.tabs.onUpdated.addListener(
      (tabId) => this.#tabUpdateHandler(tabId),
      /* eslint-disable-next-line */
      /* @ts-ignore */
      {
        properties: ["status", "title", "url", "favIconUrl"],
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

          const newTab = await browser.tabs.create({
            active: true,
            openerTabId: activeTabId,
          });
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
  await tabbyCat.handleStartup();
});
