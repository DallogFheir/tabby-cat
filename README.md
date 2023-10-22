# tabby-cat

![](./src/icons/icon-48.png) **TabbyCat**

A Firefox extension to easily organize your tabs.

## Usage

Each new empty tab is opened in a new group by default. If you want to open a new tab in the same group as the currently active tab, you can use the keyboard shortcut (which is `Ctrl` + `Shift` + `L` by default; you can change it in the extension settings). Opening a new tab from a link opens the new tab in the same group as the tab which contains the link.

### Popup

To open the TabbyCat popup, click on the cat icon on your browser toolbar.

In the popup, there are 3 icons next to the title:

- ![sort](./src/icons/fa-icons/arrow-down-wide-short-solid.svg) - sorts tabs by their group

- ![trash](./src/icons/fa-icons/trash-solid.svg) - deletes all groups

- ![gear](./src/icons/fa-icons/gear-solid.svg) - opens the settings page

Below the title, there is a list of all tab groups. You can click on the title of a tab group to expand or collapse it. Next to each tab group title, there are 6 icons:

- ![eye](./src/icons/fa-icons/eye-solid.svg) / ![eye slashed](./src/icons/fa-icons/eye-slash-solid.svg) - hides/shows the tabs belonging to the tab group

- ![crossmark](./src/icons/fa-icons/circle-xmark-solid.svg) - closes all tabs in the group (but does not delete the group if `Automatically remove empty groups` option is not enabled)

- ![trash](./src/icons/fa-icons/trash-solid.svg) - deletes the group and closes all its tabs

- ![folder](./src/icons/fa-icons/folder-open-solid.svg) - opens a new tab in the group

- ![bookmark](./src/icons/fa-icons/bookmark-solid.svg) - assigns the currently active tab to the group

- ![pencil](./src/icons/fa-icons/pencil-solid.svg) - allows you to edit the group

You can hover over the titles of individual tabs to peek them, and click them to permanently switch to them.

Below the tab groups, there is a form where you can add a new group or edit an existing group. You can edit the title of the group and choose its color. Press the plus icon to add a group, crossmark icon to dismiss editing a group and floppy disk icon to save the changes.

### Options page

On the options page, you can edit the following settings:

- **color indicators**

  - click on the colorful dots to enable/disable their colors to be automatically picked at random for new groups; this will not affect already existing groups and will still allow you to choose all the colors manually

  - to better visualize which tab belongs to which group, you can enable color indicators to be added to tabs' titles, either at the beginning of the title or at the end; this will not affect "privileged" pages, such as _about:newtab_, *https://accounts.firefox.com* or _moz-extension://_ pages; for the possibility of coloring the entire tab, [see below](#tab-colors)

- **automatically remove empty groups** - speaks for itself

- **keyboard shortcut** - shortcut to open a new tab in the group of the currently active tab; to change this, go to _about:addons_, click the gear icon in the top right and go to _Manage Extension Shortcuts_

### Context menus

There are 2 context menus provided by TabbyCat:

- **tab context menu** - when you right-click on a tab and there is more than 1 tab group, you will be shown a menu where you can change the group of the tab you clicked on

- **link context menu** - when you right-click on a link on any webpage, you will be shown a menu where you can open that link in an existing group

## Tab colors

Unfortunately, WebExtensions API does not support changing the color of individual tabs. To circumvent this, TabbyCat adds a special attribute to tabs' favicons, which can then be targeted with a custom browser stylesheet. To enable it, do the following:

1. Enter `about:config` in Firefox's address bar, accept the risk, search for `toolkit.legacyUserProfileCustomizations.stylesheets` and change its value to `true`.

2. Enter `about:profiles` in the address bar. Locate the profile in use, click on the `Open Folder` button next to the `Root Directory` section.

3. In the opened directory, create a folder called `chrome` (if it does not exist).

4. Copy the `userChrome.css` file from this repo (from directory `extras`) into the `chrome` folder.

5. Restart Firefox.

It will look like this:

![colored tabs](./docs/color-indicators.png)

## Permissions

The extension needs the following permissions:

- **menus** - to access the context menu on tabs
- **storage** - to store tab groups and settings
- **tabHide** - to hide tabs
- **tabs** - to access tab data

Moreover, Content Security Policy allows `'unsafe-eval'` for Alpine.js to work in the extension popup and settings page.

## Acknowledgements

Cat icons created by AomAm - [Flaticon](https://www.flaticon.com).

Other icons created by [Font Awesome](https://fontawesome.com).
