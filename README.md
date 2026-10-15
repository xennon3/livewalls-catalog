# LiveWalls catalog

This is the online gallery for the LiveWalls Android app. Every folder in `wallpapers/` is one
live wallpaper. When a new folder lands on `main`, the app shows it to everyone the next time
it opens. You don't need an app update.

## Add a wallpaper

```bash
python tools/lw.py new ocean-waves              # creates wallpapers/ocean-waves/
python tools/lw.py test ocean-waves --watch     # live-reloads on your phone over USB as you edit
python tools/lw.py publish                      # checks, builds catalog.json, commits and pushes
```

You can also upload a folder through github.com (Add file → Upload files). A GitHub Action
compile-checks the shader and updates `catalog.json` for you.

## Wallpaper folder

```
wallpapers/ocean-waves/
  scene.frag     the shader (required)
  meta.json      name, author, description and options
  waves.png      optional images, see "channels"
```

`scene.frag` uses the same `mainImage` function as [Shadertoy](https://www.shadertoy.com), which
gives you these inputs:

| Input | Type | Meaning |
|---|---|---|
| `iResolution` | vec3 | screen size in pixels |
| `iTime` | float | seconds since start |
| `iTimeDelta` | float | seconds since the last frame |
| `iFrame` | int | frame counter |
| `iDate` | vec4 | year, month (0-11), day, seconds of day |
| `iOffset` | vec2 | home-screen swipe position, 0..1 (use it for parallax) |
| `iChannel0`-`3` | sampler2D | the images listed in `channels` |
| `iChannelResolution[4]` | vec3 | those images' sizes |

`meta.json` (every field is optional):

```json
{
  "name": "Ocean Waves",
  "author": "Prux Tech",
  "description": "Shown on the wallpaper's page in the app.",
  "channels": ["waves.png"],
  "fps": 30,
  "scale": 0.75,
  "loop": 20,
  "thumbTime": 4
}
```

- `fps`: frame-rate cap. Use 30 for slow scenes to save battery.
- `scale`: renders at this fraction of the screen resolution. Use it for heavy shaders.
- `loop`: `iTime` wraps every N seconds. Set it if your animation is designed to loop.
- `thumbTime`: the moment, in seconds, the app captures for the thumbnail. You never make
  thumbnails yourself.
- `added`: filled in automatically on first publish. It drives the "NEW" badge, which shows
  for 14 days.

## Licensing

Only publish shaders you wrote yourself or have permission to use. Shaders on shadertoy.com are
CC BY-NC-SA by default unless the author says otherwise, so they can't go into a commercial app.
