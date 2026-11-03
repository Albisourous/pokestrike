# Monster Strike RE store

Reverse-engineering artifacts for `Monster Strike (Japan).cia`
(CTR-P-BFLJ, `monst`, title `000400000017b300`). The CIA itself stays at
`~/Documents/MonsterStrike/Monster Strike (Japan).cia`.

**Everything under `re/` except this README is gitignored.** Extracted
commercial-game data (binary, tables, art) never leaves this machine —
the repo only commits derived numbers and design notes in
`docs/monster-strike-re.md`.

| What | Path |
|---|---|
| ExeFS `code.bin` (3.6 MB ARM11) | `exefs/` |
| RomFS (207 MB — battle CSVs, 2d/ui arcs, messages) | `romfs/` |
| CIA carve-out (NCCH + exheader) | `content.*`, `exheader.bin` |
| `ctrtool` binary used for extraction | `ctrtool` |
| Full Ghidra decompile + function index | `analysis/decomp/` |
| Analysed Ghidra 12.2 project | `analysis/ghidra/gproj/monst.gpr` |
| Headless scripts, string dump, unpack tools, decoded art | `analysis/` |

## Find a class's code

RTTI name in `analysis/code_strings.txt` → typeinfo → vtable → slot 5 is
the per-frame update. Address → `analysis/decomp/functions.tsv` → grep
`@<address>` in `analysis/decomp/monst_decomp_all.c`.

## Re-extract

`./ctrtool --contents=content "/path/to/Monster Strike (Japan).cia"`,
then `--exefsdir=exefs --romfsdir=romfs` on the content file. Ghidra
re-run command is in `analysis/README.md`.
