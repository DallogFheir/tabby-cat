import type { Maybe } from "./models/common";
import {
  CONTENT_SCRIPT_CHANGE_ACTIONS,
  type ContentScriptMessage,
} from "./models/Commands";
import {
  FAVICON_LINK_SELECTOR,
  FAVICON_REL_ATTRIBUTE,
  LINK_ELEMENT,
  TEXTS,
} from "./constants";

const changeTitle = (title: string): void => {
  document.title = title;
};

const changeFavicon = (faviconDataUrl: string): void => {
  let faviconLink = document.querySelector(
    FAVICON_LINK_SELECTOR
  ) as Maybe<HTMLLinkElement>;

  if (faviconLink == null) {
    faviconLink = document.createElement(LINK_ELEMENT);
    faviconLink.rel = FAVICON_REL_ATTRIBUTE;
    document.head.append(faviconLink);
  }

  faviconLink.href = faviconDataUrl;
};

const receiveMessage: browser.runtime.onMessageVoid = (
  message: unknown
): void => {
  const msg = message as ContentScriptMessage;

  switch (msg.changeAction) {
    case CONTENT_SCRIPT_CHANGE_ACTIONS.TITLE: {
      changeTitle(msg.msg);
      break;
    }
    case CONTENT_SCRIPT_CHANGE_ACTIONS.FAVICON: {
      changeFavicon(msg.msg);
      break;
    }
    default: {
      throw new Error(TEXTS.INVALID_ACTION_ERROR_MSG + msg.changeAction);
    }
  }
};

browser.runtime.onMessage.addListener(receiveMessage);
