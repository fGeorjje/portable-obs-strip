# portable-obs-strip

Opinionated nodejs script to remove unneeded files from a portable [OBS Studio](https://github.com/obsproject/obs-studio) package. Developed for [
OBS-Studio-30.1.2.zip](https://github.com/obsproject/obs-studio/releases/tag/30.1.2).

Launch with no arguments for a file or provide a folder as the single argument. Run this right before zipping your package.

Reduces from 1700-2000 files to ~300, significantly reducing uncompression times of the final zipped package (~45s to ~10s on my machine). Currently does the following:

- Removes aja, decklink, frontend-tools, text-freetype2 and vlc-video plugin files.
- Removes all themes except Yami
- Removes logs, profiler data, crash dumps, and browser source caches
- Removes all .pdb debugging files
- Removes all locale-specific .pak and .ini files except en-US.