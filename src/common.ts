import type { Maybe } from "./models/common";
import { COLOR_INDICATOR_OPTIONS, type Options } from "./models/Options";
import { colorsToDots, type TabGroup } from "./models/Tabs";
import {
  CONTENT_SCRIPT_CHANGE_ACTIONS,
  type ContentScriptMessage,
} from "./models/Commands";
import {
  CANVAS_ELEMENT,
  DATA_URL_SEPARATOR,
  DATA_URL_START,
  DEFAULT_FAVICON_DATA_URL,
  STORAGE_KEYS,
  TABBYCAT_DATA_URL_KEY,
  TABBYCAT_DATA_URL_SEPARATOR,
  TEXTS,
} from "./constants";

export const getTabGroups = async (): Promise<TabGroup[]> => {
  const tabGroups = (await browser.storage.sync.get(STORAGE_KEYS.TAB_GROUPS))
    .tabGroups;

  if (tabGroups === undefined) {
    throw new Error(TEXTS.TAB_GROUPS_UNDEFINED_ERROR_MSG);
  }

  return JSON.parse(tabGroups as string) as TabGroup[];
};

export const getOptions = async (): Promise<Options> => {
  const options = (await browser.storage.sync.get(STORAGE_KEYS.OPTIONS))
    .options;

  if (options === undefined) {
    throw new Error(TEXTS.OPTIONS_UNDEFINED_ERROR_MSG);
  }

  return JSON.parse(options as string) as Options;
};

export const updateTabTitle = async (tabId: number): Promise<void> => {
  const options = await getOptions();
  const tabGroups = await getTabGroups();

  const tabGroup = tabGroups.find((group) =>
    group.tabs.map(({ id }) => id).includes(tabId)
  );

  if (tabGroup === undefined) {
    throw new Error(TEXTS.TAB_GROUP_FOR_TAB_NOT_FOUND_ERROR_MSG);
  }

  const tab = await browser.tabs.get(tabId);
  const title = tab.title;

  if (title === undefined) {
    throw new Error(TEXTS.TAB_WITH_NO_TITLE_ERROR_MSG);
  }

  const dot = colorsToDots[tabGroup.color];
  const startsWithDot = Object.values(colorsToDots).some((dot) =>
    title.startsWith(dot)
  );
  const endsWithDot = Object.values(colorsToDots).some((dot) =>
    title.endsWith(dot)
  );

  const titleWithoutDot = startsWithDot
    ? title.slice(2)
    : endsWithDot
    ? title.slice(0, -2)
    : title;

  let newTitle: string;
  switch (options.colorIndicator) {
    case COLOR_INDICATOR_OPTIONS.OFF: {
      newTitle = titleWithoutDot;
      break;
    }
    case COLOR_INDICATOR_OPTIONS.BEGIN: {
      newTitle = `${dot} ${titleWithoutDot}`;
      break;
    }
    case COLOR_INDICATOR_OPTIONS.END: {
      newTitle = `${titleWithoutDot} ${dot}`;
      break;
    }
  }

  browser.tabs.sendMessage(tabId, {
    changeAction: CONTENT_SCRIPT_CHANGE_ACTIONS.TITLE,
    msg: newTitle,
  } satisfies ContentScriptMessage);
};

export const updateTabFavicon = async (tabId: number): Promise<void> => {
  const tabGroups = await getTabGroups();
  const tabGroup = tabGroups.find((group) =>
    group.tabs.map(({ id }) => id).includes(tabId)
  );
  if (tabGroup === undefined) {
    throw new Error(TEXTS.TAB_GROUP_FOR_TAB_NOT_FOUND_ERROR_MSG);
  }

  const tab = await browser.tabs.get(tabId);
  const faviconUrl = tab.favIconUrl;

  let dataUrl: Maybe<string>;
  if (faviconUrl === undefined) {
    dataUrl = DEFAULT_FAVICON_DATA_URL;
  } else if (faviconUrl.startsWith(DATA_URL_START)) {
    dataUrl = faviconUrl;
  } else {
    const faviconResp = await fetch(faviconUrl);
    const faviconBlob = await faviconResp.blob();
    const faviconBitmap = await createImageBitmap(faviconBlob);

    const canvas = document.createElement(CANVAS_ELEMENT);
    canvas.height = faviconBitmap.height;
    canvas.width = faviconBitmap.width;
    const ctx = canvas.getContext("2d");

    if (ctx === null) {
      throw new Error(TEXTS.CANVAS_CONTEXT_NULL_ERROR_MSG);
    }

    ctx.drawImage(faviconBitmap, 0, 0);
    dataUrl = canvas.toDataURL();
  }

  const [firstPart, ...rest] = dataUrl
    .split(DATA_URL_SEPARATOR)
    .filter((part) => !part.startsWith(TABBYCAT_DATA_URL_KEY));
  const newDataUrl =
    firstPart +
    DATA_URL_SEPARATOR +
    TABBYCAT_DATA_URL_KEY +
    tabGroup.color.slice(1) +
    TABBYCAT_DATA_URL_SEPARATOR +
    String(tabGroup.groupId) +
    DATA_URL_SEPARATOR +
    rest.join(DATA_URL_SEPARATOR);

  browser.tabs.sendMessage(tabId, {
    changeAction: CONTENT_SCRIPT_CHANGE_ACTIONS.FAVICON,
    msg: newDataUrl,
  } satisfies ContentScriptMessage);
};

export const getFreeId = (tabGroups: TabGroup[]): number => {
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

  return freeId;
};
