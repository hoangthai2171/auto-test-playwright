# LG webOS TV CLI operator guide

Use this guide only when **Settings → SDK configuration** says the legacy LG
webOS TV CLI is missing. This is a local host setup action; it does not contact,
pair with, register, validate, or operate a TV.

1. In MyTV Auto Test, open **Settings → SDK configuration** and choose
   **Download from LG**. It opens LG's official [webOS TV CLI download
   step](https://webostv.developer.lge.com/develop/tools/webos-tv-cli-installation#step1).
2. On LG's official page, download the legacy webOS TV CLI archive for your
   computer:
   - macOS: `webOS_TV_CLI_mac_1.12.4-j27.tgz`
   - Windows: `webOS_TV_CLI_win_1.12.4-j27.zip`
3. Complete any LG sign-in or terms acceptance directly on LG's site. Do not
   obtain the archive from a mirror.
4. Return to MyTV Auto Test and choose **Choose downloaded CLI archive**. Pick
   the archive from your browser's Downloads folder. Do not unzip it yourself.
5. The app verifies the archive and installs it into its own local managed
   toolchain folder. It does not modify your system PATH, shell profile, NVM,
   or global SDK installation.
6. Wait for **webOS CLI** to show `Ready`, then configure or repair the
   remaining local components. Registering a target and validating a TV are
   separate actions and require their own approval.

For an existing developer-managed CLI, use **Advanced paths** instead. Select
the SDK home directory that directly contains `CLI/bin/ares`,
`CLI/bin/ares-setup-device`, `CLI/bin/ares-device-info`, and
`CLI/bin/ares-install`.
