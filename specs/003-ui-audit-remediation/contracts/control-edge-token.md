# Contract: control-edge token

The only cross-app interface this feature changes.

## Declaration

Each of the seven apps declares the token in its own `src/style.css`, `:root`
block. The value is identical; the file is not.

```css
/* :root, before */
--input: oklch(0.928 0.006 264.531);

/* :root, after */
--input: oklch(0.64 0.006 264.531);
```

`--border` stays `oklch(0.928 0.006 264.531)`. Changing it is out of contract:
it is applied globally and colors non-control surfaces.

## Exposure

`@theme inline` in the same file maps it for Tailwind. This line does not change.

```css
--color-input: var(--input);
```

## Consumers

After the change, every consumer below renders a boundary at or above 3:1 against
both `card` and `background`.

| Consumer | Class | Expected |
| --- | --- | --- |
| `ui/input/Input.vue` | `border-input ... border` | edge 3.37:1 vs card, 3.23:1 vs background |
| `ui/textarea/Textarea.vue` | `border-input ... border` | same |
| `ui/native-select/NativeSelect.vue` | `border-input ... border` | same |
| `ui/select/SelectTrigger.vue` | `border-input ... border` | same |
| `ui/checkbox/Checkbox.vue` | `border-input ... border` | same |
| `ui/switch/Switch.vue` | `data-[state=unchecked]:bg-input` | off-state fill visibly darker; accepted |

## Invariants a reviewer checks

1. The value in all seven apps reads `oklch(0.64 0.006 264.531)`.
2. `--border` in all seven apps still reads `oklch(0.928 0.006 264.531)`.
3. A non-control surface (card edge, table rule, divider) is visually unchanged,
   confirmed by reading the computed color, not by eye.
4. An unchecked switch is visibly darker than before, and that is recorded, not
   discovered.
5. An input edge measured in a running browser on a card and on the page
   background is at or above 3:1 in both places.

## Why not a new token

A dedicated `--control-border` would leave `--input` unused for four of its five
consumers and require editing every consumer class in every app (49 component
edits across seven apps) plus seven `style.css` edits, against seven edits for the
value change. The design system already names this token for exactly this role.
