# Real Pokémon assets only

For any icon, sprite, prop, or UI flourish: use a real vendored Pokémon asset
first — a mon front (`drawMon`/`itemSprite`), an item icon
(`public/sprites/items/`), a badge (`public/sprites/badges/`), an NPC
(`drawNpc`), or a slice/blit of the gracidea atlases
(`public/sprites/gracidea/`). If it isn't vendored yet, pull it from
PokeAPI/sprites rather than inventing a glyph. Hand-drawn code is a last
resort and a cold-cache fallback only. See root AGENTS.md.
