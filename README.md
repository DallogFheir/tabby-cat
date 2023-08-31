# tabby-cat

![](./src/icons/icon-48.png) **TabbyCat**

A Firefox extension to easily organize your tabs.

## Tab colors

Unfortunately, WebExtensions API does not support changing the color of individual tabs. To circumvent this, you can use a custom browser stylesheet:

1. Enter `about:config` in Firefox's address bar, accept the risk, search for `toolkit.legacyUserProfileCustomizations.stylesheets` and change its value to `true`.

2. Enter `about:profiles` in the address bar. Locate the profile in use, click on the `Open Folder` button next to the `Root Directory` section.

3. In the opened directory, create a folder called `chrome` (if it does not exist).

4. Copy the `userChrome.css` file from this repo (from directory `extras`) into the `chrome` folder.

5. Restart Firefox.

## Acknowledgements

Cat icons created by AomAm - [Flaticon](https://www.flaticon.com).