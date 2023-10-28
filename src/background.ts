import type { Maybe } from "./models/common";
import {
  COLOR_INDICATOR_OPTIONS,
  type Options,
  type OptionsChange,
} from "./models/Options";
import {
  colorsToDots,
  type Color,
  type TabAction,
  type TabGroup,
  type UpdateToGo,
  type Tab,
  TAB_ACTIONS,
} from "./models/Tabs";
import {
  EXTENSION_COMMANDS,
  ExtensionCommand,
  MESSAGE_TYPES,
  type UpdateMessage,
} from "./models/Commands";
import {
  getTabGroups,
  getOptions,
  updateTabTitle,
  updateTabFavicon,
  getFreeId,
} from "./common";
import { Lock } from "./lib/lock";
import {
  ALLOWED_PROTOCOLS,
  INSTALL__REASON,
  MENU_CONTEXTS,
  MENU_IDS,
  MENU_ID_REGEXP,
  MENU_TYPES,
  NEW_TAB_URL,
  STATUS_COMPLETE,
  TABBYCAT_DATA_URL_REGEXP,
  TEXTS,
  WATCHED_TAB_PROPERTIES,
} from "./constants";

class TabbyCat {
  static #isInternallyConstructing = false;
  static #instance: Maybe<TabbyCat>;
  #lock = new Lock();

  constructor() {
    if (!TabbyCat.#isInternallyConstructing) {
      throw new TypeError(TEXTS.CONSTRUCTOR_USED_ERROR_MSG);
    }
    TabbyCat.#isInternallyConstructing = false;
  }

  static getInstance(): TabbyCat {
    if (!TabbyCat.#instance) {
      TabbyCat.#isInternallyConstructing = true;
      TabbyCat.#instance = new TabbyCat();
    }

    return TabbyCat.#instance;
  }

  #initialize(): void {
    this.#initContextMenuListener();
    this.#initTabListener();
    this.#initStorageListener();
    this.#initCommandListener();
    this.#initMessageListener();
  }

  async install(): Promise<void> {
    this.#initialize();

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
          groupName: tab?.title ?? TEXTS.NEW_GROUP_TITLE,
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
        colorIndicator: COLOR_INDICATOR_OPTIONS.BEGIN,
        removeEmptyGroups: true,
        colors: Object.keys(colorsToDots) as Color[],
      } satisfies Options),
    });

    await this.#updateAllTabsTitles();

    browser.runtime.openOptionsPage();
  }

  async handleStartup(): Promise<void> {
    this.#initialize();

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
        const groupIdMatch = tab.favIconUrl?.match(TABBYCAT_DATA_URL_REGEXP);

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
    return (
      !url || ALLOWED_PROTOCOLS.every((protocol) => !url.startsWith(protocol))
    );
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
    const tabGroups = (await getTabGroups()) ?? [];

    await browser.menus.removeAll();

    if (!this.#isSpecialTab(tab.url) && tabGroups.length > 1) {
      tabGroups.forEach((group) => {
        const colorIndicator = colorsToDots[group.color];

        browser.menus.create({
          id: MENU_IDS.GROUP + String(group.groupId),
          title: `${colorIndicator} ${group.groupName}`,
          type: MENU_TYPES.RADIO,
          checked:
            group.tabs.find((tabInGroup) => tabInGroup.id === tab.id) !==
            undefined,
          contexts: [MENU_CONTEXTS.TAB],
        });
      });
    }

    tabGroups.forEach((group) => {
      const colorIndicator = colorsToDots[group.color];

      browser.menus.create({
        id: MENU_IDS.OPEN_GROUP_IN + String(group.groupId),
        title:
          TEXTS.MENU_OPEN_IN_TITLE + `${colorIndicator} ${group.groupName}`,
        type: MENU_TYPES.NORMAL,
        contexts: [MENU_CONTEXTS.LINK],
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
        String(info.menuItemId).match(MENU_ID_REGEXP)?.[1] ?? NaN
      );
      const tabGroups = await getTabGroups();
      const newGroup = tabGroups?.find(
        (tabGroup) => tabGroup.groupId === newGroupId
      );

      if (!tabGroups || newGroup === undefined) {
        return;
      }

      if (String(info.menuItemId).startsWith(MENU_IDS.OPEN_GROUP_IN)) {
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
          groupName: tab?.title ?? TEXTS.NEW_GROUP_TITLE,
          color: await this.#getColor(
            tabGroups.map((tabGroup) => tabGroup.color)
          ),
          hidden: false,
          tabs: [{ id: tabId, url: tabUrl }],
          updatesToGo: tab.url === NEW_TAB_URL ? 2 : 1,
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
          case TAB_ACTIONS.ADD: {
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
          case TAB_ACTIONS.REMOVE: {
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
            throw new Error(TEXTS.INVALID_TAB_ACTION_ERROR_MSG + tabAction);
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

      if (status === STATUS_COMPLETE && url && !this.#isSpecialTab(url)) {
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

      if (status === STATUS_COMPLETE && title) {
        await this.#updateGroupName(tabId, title);
        await updateTabTitle(tabId);
      }

      if (status === STATUS_COMPLETE) {
        await updateTabFavicon(tabId);
      }
    } finally {
      this.#lock.release();
    }
  }

  async #initTabListener(): Promise<void> {
    browser.tabs.onCreated.addListener((tab) =>
      this.#tabListener(tab, TAB_ACTIONS.ADD)
    );
    browser.tabs.onUpdated.addListener(
      (tabId) => this.#tabUpdateHandler(tabId),
      /* eslint-disable-next-line */
      /* @ts-ignore */
      {
        properties: WATCHED_TAB_PROPERTIES,
      }
    );
    browser.tabs.onRemoved.addListener((tabId) =>
      this.#tabListener(tabId, TAB_ACTIONS.REMOVE)
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
      const extensionCommand = command as ExtensionCommand;

      switch (extensionCommand) {
        case EXTENSION_COMMANDS.OPEN_NEW_TAB_IN_GROUP: {
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
          throw new Error(
            TEXTS.INVALID_EXTENSION_COMMAND_ERROR_MSG + extensionCommand
          );
        }
      }
    });
  }

  #initMessageListener(): void {
    browser.runtime.onMessage.addListener(async (msg: unknown) => {
      const message = msg as UpdateMessage;

      if (message.messageType === MESSAGE_TYPES.UPDATE) {
        await this.#lock.acquire();
        const updateFaviconsPromises = message.tabIds.map(
          async (tabId) => await updateTabFavicon(tabId)
        );
        await Promise.all(updateFaviconsPromises);
        this.#lock.release();
      }
    });
  }
}

browser.runtime.onInstalled.addListener(({ reason }) => {
  const tabbyCat = TabbyCat.getInstance();

  if (reason === INSTALL__REASON) {
    tabbyCat.install();
  }
});
browser.runtime.onStartup.addListener(async () => {
  const tabbyCat = TabbyCat.getInstance();
  await tabbyCat.handleStartup();
});
