# Real Pokémon assets only

Everything under `public/` is the art canon: FRLG mon fronts in `sprites/`,
item icons in `sprites/items/`, badges in `sprites/badges/`, scenery/NPCs in
`sprites/gracidea/` — all vendored from PokeAPI/sprites (Gen 3 era). New art
means vendor the real asset here; never author replacement shapes in code.
See the root AGENTS.md "Single art source" rules.

`sprites/anims/` vendors Gen 3 battle-animation sheets from pret/pokeemerald `graphics/battle_anims/sprites` (RGBA, palette index 0 transparent).
