import Alpine from "alpinejs";
import type { Maybe } from "../models/Maybe";
import type { TabGroup } from "../models/Tabs";
import type { TabGroupAction } from "../models/Popup";

const showHideGroup = async (groupId: number, action: TabGroupAction) => {
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

  const tabGroupsJson = (await browser.storage.local.get("tabGroups"))
    .tabGroups as Maybe<string>;

  if (tabGroupsJson) {
    const tabGroups = JSON.parse(tabGroupsJson) as TabGroup[];
    const tabGroup = tabGroups.find((tabGroup) => tabGroup.groupId === groupId);

    if (tabGroup) {
      await func(tabGroup.tabIds);
      tabGroup.hidden = action === "HIDE";
      browser.storage.local.set({
        tabGroups: JSON.stringify(tabGroups),
      });

      const updateEvent = new CustomEvent("x-tabbycat-update", {
        detail: {
          tabGroups,
        },
      });
      document.body.dispatchEvent(updateEvent);
    }
  }
};

Alpine.store("functions", {
  showHideGroup,
});
Alpine.start();
