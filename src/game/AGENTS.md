# Real Pokémon assets only

Reach for a real vendored asset before drawing anything yourself — mon front
(`drawMon`), item/badge icon (`itemSprite`), NPC (`drawNpc`), or a gracidea
atlas slice. If it isn't vendored, pull it from PokeAPI/sprites rather than
inventing a glyph. Hand-drawn shapes are a last resort / cold-cache fallback.
See the root AGENTS.md "Single art source" rules.
