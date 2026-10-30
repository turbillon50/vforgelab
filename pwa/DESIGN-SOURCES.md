# Design sources

The adaptation was explicitly requested by Luis: reuse the visual quality of his existing applications for the three MIA/VForgeLab screens.

## Védika

- Repository: `turbillon50/vedika77`, default branch `main` at review time.
- `src/app/vedika-visual-system.css`: original dark tokens, surface materials, diagonal specular reflection, active navigation treatment, restrained material-light background.
- Selected original rules are adapted in `vedika-materials.css`. Route contracts, data and authentication are not copied from Védika.
- `src/components/ProductShell.tsx` and `src/app/product-system.css`: persistent navigation, responsive chrome, glass confined to navigation and controls.

## Aprueba el EXCI — teacher area

- Repository: `turbillon50/apruebaelexci`, reviewed commit `69510fe`.
- `src/app/profesor/layout.tsx`, `src/components/app-shell.tsx`: a small number of actual navigation areas, fixed shell, contextual headings.
- `src/app/profesor/page.tsx`, `src/app/globals.css`: strong title/action hierarchy, readable body text, dominant primary action, secondary rows rather than a grid of equally prominent cards.
- The selected screenshot `qa/premium/despues/profesor/inicio-390.png` was reviewed for its mobile composition. The cream teacher theme was not transferred to this explicitly dark product.

## V&Living

- Repository: `turbillon50/vliving-plataforma`.
- `src/App.jsx`: editorial hierarchy, separate display/body/numeric roles. Its orange/white palette was not transferred.

## Scope

Exactly three areas: ALIX, Energía, BranchKiller. The blue/silver adaptation follows the supplied VForgeLab cover. No claims of sleep monitoring, emergency dispatch, autonomous worktree deletion, or physical GPU control were added to the interface.

Source materials retain their ownership. This document is provenance, not a declaration that unrelated private application code has been relicensed.
