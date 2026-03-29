# GitHub Mapping — canaux-ameliorations

| File | Issue | Title |
|------|-------|-------|
| epic.md | [#79](https://github.com/rohanfosse/cursus/issues/79) | Epic: canaux-ameliorations — Membres, archivage, UX |
| 80.md | [#80](https://github.com/rohanfosse/cursus/issues/80) | Backend archivage canaux |
| 81.md | [#81](https://github.com/rohanfosse/cursus/issues/81) | Gestion membres ChannelMembersPanel |
| 82.md | [#82](https://github.com/rohanfosse/cursus/issues/82) | Header canal enrichi + toasts + badges mentions |
| 83.md | [#83](https://github.com/rohanfosse/cursus/issues/83) | Frontend archivage sidebar |
| 84.md | [#84](https://github.com/rohanfosse/cursus/issues/84) | Tests canaux ameliorations |

## Dependencies

```
Phase parallele:
  #81 Gestion membres ──────────┐
  #82 Header + toasts + badges ─┤
                                 │
Phase sequentielle:              │
  #80 Backend archivage ──→ #83 Frontend archivage
                                 │
                                 ├──→ #84 Tests
```

## Labels

- `epic` + `feature` on #79
- `task` + `epic:canaux-ameliorations` on #80-#84
