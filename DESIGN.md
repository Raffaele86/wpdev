---
name: wpdev
description: Console for a local WordPress fleet — graphite grounds, a single copper accent inherited from raffaelenocera.com, hazard stripes only where risk is real.
colors:
  black: "#0e1013"
  ground: "#14171c"
  raise: "#1b1f26"
  accent: "#b8723c"
  accent-hi: "#d08f58"
  risk: "#e5484d"
  white: "#f2f4f7"
  dim: "#b9bfc8"
  off: "#8c939e"
  faint: "#6b7280"
  rule: "rgba(184,114,60,0.30)"
  rule-hi: "rgba(184,114,60,0.62)"
  wash: "rgba(184,114,60,0.12)"
  wash-risk: "rgba(229,72,77,0.14)"
typography:
  display:
    fontFamily: "Anton, sans-serif"
    fontSize: "clamp(30px, 4.6vw, 68px)"
    fontWeight: 400
    lineHeight: 0.9
    letterSpacing: "-0.005em"
    textTransform: "uppercase"
  headline:
    fontFamily: "Anton, sans-serif"
    fontSize: "clamp(26px, 3.4vw, 46px)"
    fontWeight: 400
    lineHeight: 0.94
    letterSpacing: "-0.005em"
    textTransform: "uppercase"
  title:
    fontFamily: "Anton, sans-serif"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.005em"
    textTransform: "uppercase"
  body:
    fontFamily: "JetBrains Mono, ui-monospace, DejaVu Sans Mono, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  data:
    fontFamily: "JetBrains Mono, ui-monospace, DejaVu Sans Mono, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.5
  prose:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.65
  control:
    fontFamily: "JetBrains Mono, ui-monospace, DejaVu Sans Mono, monospace"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.1em"
    textTransform: "uppercase"
  label:
    fontFamily: "JetBrains Mono, ui-monospace, DejaVu Sans Mono, monospace"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.16em"
    textTransform: "uppercase"
rounded:
  none: "0"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "26px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.black}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "8px 11px"
  button-primary-hover:
    backgroundColor: "{colors.white}"
    textColor: "{colors.black}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    typography: "{typography.control}"
    rounded: "{rounded.none}"
    padding: "8px 11px"
  button-ghost-hover:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.accent}"
  button-ghost-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.black}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.dim}"
    padding: "8px 11px"
  button-risk:
    backgroundColor: "transparent"
    textColor: "{colors.risk}"
    padding: "8px 11px"
  button-risk-hover:
    backgroundColor: "{colors.wash-risk}"
    textColor: "{colors.risk}"
  button-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.off}"
  button-sm:
    padding: "6px 8px"
    typography: "{typography.label}"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.dim}"
    padding: "5px"
  button-icon-hover:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.accent}"
  input-finder:
    backgroundColor: "{colors.raise}"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    height: "28px"
    padding: "0 74px 0 32px"
  input-finder-focus:
    backgroundColor: "{colors.black}"
    textColor: "{colors.white}"
  input-dialog:
    backgroundColor: "{colors.black}"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    padding: "9px 10px"
    typography: "{typography.data}"
  select-class:
    backgroundColor: "{colors.raise}"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    padding: "4px 24px 4px 7px"
    typography: "{typography.label}"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.dim}"
    typography: "{typography.control}"
    padding: "12px 12px 10px"
  tab-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.black}"
  index-row:
    backgroundColor: "transparent"
    textColor: "{colors.white}"
    padding: "7px 12px"
  index-row-hover:
    backgroundColor: "{colors.raise}"
  index-row-selected:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.accent}"
  badge-live:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.black}"
    rounded: "{rounded.none}"
    padding: "3px 4px"
  dialog-surface:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.white}"
    rounded: "{rounded.none}"
    padding: "18px 20px 20px"
    width: "452px"
  toast:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.black}"
    rounded: "{rounded.none}"
    padding: "9px 14px"
---

# Design System: wpdev

**Scope.** This document records the visual system of the **GUI surface only** — the Electron
renderer in `gui/index.html` (all tokens, CSS, markup and the SVG icon sprite) and
`gui/renderer.js` (render loop, state, components-as-functions). The repository also contains a CLI
(`bin/`) and a daemon (`engine/`); neither has a visual surface, and nothing here applies to them.

## Overview

**Creative North Star: "The Registration Sleeve"**

The console is printed, not lit. A record sleeve from The Designers Republic, pressed on graphite
paper in one metallic ink: copper, laid flat with no gradient, no glow, no bevel and no shadow.
Every division between planes is a hairline rule, every active block is marked at its four corners
the way a press sheet is marked for registration. The result reads as a printed technical document
that happens to be interactive, not as a piece of software chrome.

Its organising idea is identification before status. Sixteen local sites that report identical
values — all running, all PHP 8.3, all on `:8443` — are not sixteen equal rows to be badged sixteen
times. So the biggest object on screen is the **name** of the one asset in hand, set in condensed
display type at up to 68px, with its three genuinely variable facts (state, blueprint, creation
date) set small and right-aligned beside it. Everything that is constant across the fleet is
demoted, and everything that is normal is drawn as nothing at all: a healthy site has a
**transparent** status dot. The screen only spends ink on exceptions.

Density is high and deliberately unpadded — 46px topbar, 7px row padding, 1px rules — because the
operator is scanning identifiers, not reading. The two confirmed anti-references are the previous
amber/rack identity, which was replaced outright rather than refined, and the fleet-of-equal-cards
grid, whose repetition of constants is exactly what this layout refuses.

**Key Characteristics:**

- Graphite grounds with a single copper accent; red appears only as a functional risk signal.
- Flat print: zero shadows, zero gradients on interactive surfaces, zero rounded corners.
- Hairline copper rules and corner marks instead of boxes and fills.
- Condensed display type reserved for names; monospace for every identifier.
- State drawn only as exception — normal is invisible.
- Hazard stripes as a rationed material, never as decoration.

## Colors

**Provenance.** The palette is inherited from the operator's own site, raffaelenocera.com, and is
taken from its active theme's Tailwind config:
`~/wpdev-sites/raffaelenocera/app/public/wp-content/themes/raffaelenocera-v3/tailwind.config.js`.
The three ramps used here are `graphite` (grounds), `steel` (foregrounds) and `copper` (accent). If
that theme's ramps move, these tokens must move with them — this is the file to keep in sync.

**The one exception is `--risk` (`#e5484d`)**, which is *not* from that source. The brand theme
ships a single accent and declares no state colours; since copper is itself an orange, `apri` and
`elimina` would have shared a hue. The red is an added functional signal, documented as such in the
stylesheet, and it must never be treated as a brand colour.

All contrast figures below are measured against the ground `--black` (`#0e1013`).

### Primary

- **Copper** (`--accent`, copper-400 — 5.0:1): the only colour that means *do this / this one / this
  is the state*. It carries the primary button fill, the selected tab fill, the selected row's name
  and wash, all four corner-mark devices, every uppercase label, links, the drawn `<select>`
  chevron, the focus ring, `::selection`, the scrollbar thumb, the `live` chip and the toast.
- **Copper Bright** (`--accent-hi`, copper-300 — 7.1:1): declared in the token block as the brighter
  step of the accent. **It is currently referenced by nothing in the build.** Treat it as the
  reserved hover/emphasis step of the accent ramp, not as an established role.

### Secondary

- **Signal Red** (`--risk` — 4.9:1): risk, anomaly and destruction, and nothing else. It appears on
  the non-operational status dot, the anomaly reticle in the right rail, warning values in the spec
  block, the destructive button, the destructive dialog's border and band, the failure panel, the
  console's error line, and inside the `--hazard` stripe.

### Neutral

Grounds are the graphite ramp; foregrounds are the steel ramp, as **solid hex values** — nothing in
this palette relies on alpha over the background except the copper tints.

- **Graphite Ground** (`--black`, graphite-950): the body ground, the asset plane, the console and
  the focused finder input.
- **Graphite Surface** (`--ground`, graphite-900): the chrome plane — topbar, rails, index column,
  dialog surface, log blocks.
- **Graphite Raised** (`--raise`, graphite-800): the third plane — row hover, resting finder input,
  `<select>` fill, skeleton bars. It reads as touch, not as elevation.
- **Steel Bright** (`--white`, steel-100 — 17.4:1): the identifier colour. Site names, spec values,
  bold runs in prose, inline `code` inside prose. Note the system has **no pure white**; the
  brightest value on screen is a cooled off-white.
- **Steel Read** (`--dim`, steel-300 — 10.3:1): all secondary text. Slugs under names, spec keys,
  placeholder text, prose, console output, quiet button labels, group counts.
- **Steel Inert** (`--off`, steel-400 — 6.2:1): exactly one job — the label of a disabled button.
  Disabled means unavailable and still readable, not vanished.
- **Steel Mute** (`--faint`, steel-500 — 3.9:1): borders only. The keycap outlines in the finder, the
  quiet button's border, and (at 55%) the disabled button's border. It fails AA for normal text,
  which is the reason it is restricted to strokes.

### Tints

- **Rule** (`--rule`) and **Rule Bright** (`--rule-hi`): copper at 30% and 62%. `--rule` draws every
  structural hairline (panel borders, spec row separators, section bars, input borders); `--rule-hi`
  draws the load-bearing ones — the button outline, the console's top edge, the crop ticks of
  `.frame`, and the scrollbar thumb.
- **Wash** (`--wash`) and **Wash Risk** (`--wash-risk`): copper at 12% and red at 14%. Hover fills
  and the selected row's background. They are the only fills in the system that are neither a plane
  nor a solid ink.

### Named Rules

**The Two Voices Rule.** Copper is intent — primary action, current selection, state indication.
Red is consequence — risk, anomaly, destruction. Never borrow one for the other's job, including in
focus: `button.risk:focus-visible` overrides the global copper focus ring to red so a destructive
control is never haloed in the action colour. The `live` chip is the deliberate test case: a public
URL is a state to notice, not a fault, so it takes the accent.

**The State-As-Exception Rule.** A healthy site draws no status mark at all — `.dot.on` is
`background: transparent`, and the 7px column survives only to keep names aligned. Only failure is
drawn: a solid red square for a running site with a dead pool, and a hollow red ring
(`inset 0 0 0 1.5px`) for a stopped one. The same logic drives the right rail, whose reticle icon
swaps to a warning triangle and turns red only when the daemon is down or some site is not up.

**The Hairline-Only Rule.** `--faint` never colours text. `--off` colours disabled labels and
nothing else. `--dim` is the one grey allowed to carry running text.

**The Single Accent Rule.** The source theme ships one accent, and so does this console. There is no
green, no yellow, no blue anywhere in the build: success is copper (`#conBody .ok`), failure is red
(`#conBody .bad`). A new colour may only enter as a *functional signal that cannot be expressed by
the accent*, and must be declared as such where `--risk` is declared.

> Known leftover, not a token: `gui/main.js` still sets the Electron window's pre-paint
> `backgroundColor` to `#17140f`, a brown from the replaced amber identity. It is never visible once
> the document paints, but it should be `#0e1013` and it is not part of this palette.

## Typography

**Display Font:** Anton (self-hosted woff2, weight 400 only, `font-display: block`)
**Body / Data Font:** JetBrains Mono (self-hosted variable woff2, 100–800)
**Prose Font:** Archivo (self-hosted variable woff2, 100–900)

**Character:** Anton is a single-weight condensed grotesque that only knows how to shout, so it is
given exactly one job: names. JetBrains Mono is the working voice of the whole console — it is the
document's default face — and its fixed advance is what makes sixteen slugs scannable as a column.
Archivo appears only when the interface has to explain itself in sentences, and its proportional
rhythm is the signal that you are reading prose rather than data.

### Hierarchy

- **Display** (Anton 400, `clamp(30px, 4.6vw, 68px)`, line-height 0.9, uppercase): the selected
  asset's real name in the header. The single largest thing on screen, wrapping with
  `overflow-wrap: anywhere` rather than shrinking.
- **Headline** (Anton 400, `clamp(26px, 3.4vw, 46px)`, line-height 0.94, uppercase): the
  no-selection screen's headline — either the instruction *SCEGLI UN SITO* or, when a search has
  narrowed to one result, that site's name promoted into the empty panel.
- **Title** (Anton 400, 26px/1, uppercase): dialog titles. The failure panel's heading is the same
  face at a fixed 30px/1.
- **Wordmark** (Anton 400, 20px/1, uppercase, letter-spacing 0.012em): `wpdev` in the topbar,
  optically nudged 2px down against the roundel.
- **Body** (JetBrains Mono 400, 13px/1.5): the document default, inherited by everything unstated.
- **Data** (JetBrains Mono 400, 12.5px): spec values, dialog inputs, prose-embedded `code`.
  Long values use `overflow-wrap: anywhere` instead of truncation — an identifier you cannot read in
  full is useless.
- **Control** (JetBrains Mono 500, 11px/1, letter-spacing 0.1em, uppercase): all buttons; tabs use
  the same face at 0.12em.
- **Label** (JetBrains Mono 500, 10px/1, letter-spacing 0.16em, uppercase, copper): every field key,
  section header and rail caption. Its `.q` modifier drops it to `--dim` for keys whose value, not
  whose name, matters.
- **Micro** (JetBrains Mono 500, 9px/1): the `live` chip (0.08em) and the finder's keycap hints
  (0.06em).
- **Prose** (Archivo 400, 13.5px/1.65, `--dim`, max 64–68ch): explanatory paragraphs in the empty
  state, the failure panel, the live-link tab and dialog bodies. Bold runs go to `--white` at
  weight 600.

### Named Rules

**The Names-Only Rule.** Anton sets names and headlines: the asset name, the empty-state headline,
the failure heading, the dialog title, the wordmark. It never sets a label, a button, a tab, a spec
value, a row or a line of data. A condensed display face applied to data is how this world becomes a
poster instead of a console.

**The Monospace Identifier Rule.** Anything the operator might read character-by-character or copy —
slug, domain, path, URL, credential, count, log line, keycap — is JetBrains Mono. This is why mono is
the document default rather than a special case.

**The Prose Quarantine Rule.** Archivo appears only inside `.prose` and `.empty p`. It never labels,
never sits in a button, never carries a value. Its presence means: this is a sentence written for
you, not a field read from the engine.

## Layout

**The frame.** A fixed vertical stack — 46px topbar, a flexible body, an optional 172px console
drawer — over a four-column body: a 34px left rail (`--rail`), a 292px index column (`--index-w`),
the fluid asset panel, and a second 34px right rail. Only the asset panel flexes; the index and both
rails are `flex: none`. The topbar is the window drag region (`-webkit-app-region: drag`), with
inputs and buttons opted back out, because the window is frameless.

**The topbar** reads left to right as brand · finder · secondary action · window controls. The
finder occupies all the slack, which is the layout's statement about what the screen is for. Window
controls are 44px squares that only invert on hover; close inverts to copper.

**The index column** is a scrolling listbox with a sticky head (label + count) and a pinned primary
button at the bottom. Rows are grouped under a label / hairline / count header; groups are the
operator's hand-assigned classes, with everything else falling into a final unclassified group. When
a search is active the grouping collapses to a single `risultati` group.

**The asset panel** is the only surface with texture: `--dots`, a 1px copper radial dot on a 22px
grid at 18% opacity, which distinguishes the working plane from the flat chrome. Its header is
padded `16px 20px 0`, the tab strip and content share a 20px gutter, and content scrolls
independently.

**The spec grid** is a three-column grid — `116px / minmax(0,1fr) / auto` — of key, value and
per-row actions, each cell closed by a bottom hairline. It is the system's default way to present
any set of facts.

**Rhythm.** Gutters run 12px in the index and 20px in the asset panel. Button and action clusters
gap at 8px; icon-to-text inside a button is 7px; keycap groups gap 4px. Section headers stand off by
26px above and 12px below. Vertical row padding is 7px in the index, 10px in the spec grid.

**Responsive.** Two breakpoints, both subtractive:
- **≤1080px** — both rails disappear entirely (`display: none`). They carry redundant signals, so
  losing them costs nothing.
- **≤960px** — the index narrows to 230px, the version chip and the finder's keycap hint are
  dropped, the asset header collapses from two columns to one, and the spec block flips from
  right-aligned values on a stretched grid to `max-content max-content` left-aligned pairs so a key
  and its value stay visually joined.

### Named Rules

**The Finder-First Rule.** The search input owns the topbar's free space and is reachable from
anywhere with `Ctrl/Cmd+K` or `/`. Any future screen puts finding above browsing.

**The Subtractive Narrowing Rule.** Narrow viewports remove ornament and redundancy — rails, chips,
keycaps — and never reflow the asset panel into cards or an accordion. The name, the spec and the
primary action survive every width.

## Elevation & Depth

**There are no shadows.** Not one `box-shadow` in the build is used for depth; the only occurrence
is `inset 0 0 0 1.5px var(--risk)` on the stopped-site dot, which is a drawn ring, not a lift.
There are no gradients on any interactive surface — the two `repeating-linear-gradient`s are hazard
stripes and the one `radial-gradient` is the asset panel's dot field, both flat print devices. No
blur, no backdrop-filter, no glow.

Depth is done three ways, in this order of strength:

1. **Three graphite planes.** `--black` (ground and asset), `--ground` (chrome: topbar, rails,
   index, dialog, log blocks), `--raise` (touch: hover, resting inputs, skeletons). The steps are
   small and consecutive on the same ramp — barely perceptible, which is the point; they separate
   without stacking.
2. **Hairlines.** A 1px `--rule` border is what actually says *this is a different region*. The
   console announces itself more loudly with a `--rule-hi` top edge.
3. **Corner marks.** Registration brackets and crop ticks (see Shapes) do the work an outline or a
   shadow would do elsewhere, without enclosing the content.

The only backdrop in the system is the modal dialog's, at `rgba(0,0,0,.78)` — dimming, not blurring,
and the one place true black appears.

### Named Rules

**The Flat Print Rule.** Nothing in this world casts. If a surface needs to come forward, move it to
the next graphite plane, give it a hairline, or mark its corners. Never reach for a shadow, a glow
or a gradient fill.

## Shapes

**Everything is a rectangle with square corners.** `border-radius: 0` is asserted explicitly on
buttons, the finder input, `<select>`, dialogs and dialog inputs, overriding every user-agent
default. The one true curve in the interface is inside drawn SVG icons.

**Two corner-mark devices, with distinct meanings:**

- **`.brk` — registration brackets.** Four solid-copper L-brackets, 8px arms, 1px thick, inset 2px
  from the box, drawn as eight `linear-gradient` backgrounds on a `::before`. Meaning: *registered /
  active*. It marks the selected row, the keyboard-cursor row, and — replicated inline at
  `inset: 6px 9px` — the focused finder. It is the system's badge of "this is the one".
- **`.frame` — crop ticks.** Four 9px corner ticks in `--rule-hi` split across `::before` (top
  corners) and `::after` (bottom corners). Meaning: *this is a framed block*. It marks the asset
  header, and only the asset header.

**Hazard stripes** are a material, not a colour: a 45°-reversed repeating stripe, 6px ink / 6px
transparent. Two inks exist — `--hazard` (red) and `--hazard-m` (copper) — and they appear in
exactly three places (see the Hazard Rule under Components).

**Icons** are a single inline `<svg><defs>` sprite of 22 `<g>` symbols on a 24×24 grid, referenced
by `<use href="#i-…">`, drawn with `currentColor`, `fill: none`, 1.6–1.9px strokes and mostly
`stroke-linecap: square`. Rendered at 12–17px. They are drawn geometry — a crosshair roundel for the
brand, a reticle for the rails, a meridian globe for share — not a licensed icon set and never a
text glyph.

### Named Rules

**The Zero Radius Rule.** No rounded corners anywhere, on any element, at any size. Curves exist
only as drawn paths inside icons.

**The Two Marks Rule.** `.brk` means selected/active and is always solid copper. `.frame` means
framed block and is always `--rule-hi`. Do not mix them, do not apply both to one element, and do not
invent a third corner device.

## Components

### Buttons

Four variants, one silhouette: square, hairline-bordered, uppercase mono at 0.1em, icon left at 13px
with a 7px gap, padded `8px 11px` (`.sm`: `6px 8px` at 10px).

- **Primary** (`.primary`): solid copper on graphite text. Exactly one per context — `apri` in the
  asset header, `nuovo sito` pinned under the index, the confirm button in a non-destructive dialog,
  `avvia live link`. Hover inverts to **`--white`** fill, not a brighter copper: the flat-print world
  reads inversion faster than a tint shift.
- **Ghost** (default `button`): transparent with a `--rule-hi` border and copper label. Hover fills
  with `--wash` and brightens the border to solid copper; active inverts to solid copper with
  graphite text.
- **Quiet** (`.quiet`): `--dim` label on a `--faint` border, for the secondary tool shelf
  (`shell`, `wp-cli`, `adminer`, `esporta`, `clona`, `xdebug`) and `stop` / `riavvia`. Hover goes to
  `--white` text and `--white` border with no fill.
- **Risk** (`.risk`): red label on a 55%-red border, hover fills `--wash-risk`. Used only for
  `elimina sito` and `ferma live link`, and only under a section header reading *irreversibile*.
- **Disabled**: the border stays (at 55% `--faint`), the fill stays transparent, the label drops to
  `--off`. Inert, not absent — a disabled control still tells you it exists.
- **Icon button** (`.icon-btn`): 5px padding, transparent border, `--dim` glyph; hover goes copper
  on `--wash`. Used for per-row copy/reveal and the console close.

### Inputs and Selects

- **Finder** (`#q`): 28px tall, `--raise` fill, `--rule` border, 32px left inset for the search icon
  and 74px right inset for the `CTRL K` keycaps. On focus the fill drops to `--black`, the border
  goes solid copper, and the wrapper draws the same four registration brackets as a selected row.
- **Dialog inputs**: full width, `--black` fill, `--rule` border, 9–10px padding, mono at 12.5px.
- **Selects**: native appearance stripped and replaced with a drawn copper chevron as an inline
  `data:` SVG (`stroke='%23b8723c'`), positioned 8px from the right. Options are painted `--ground`.
  Dialog selects must set `background-color`, never the `background` shorthand — the shorthand erases
  the drawn arrow and leaves a menu disguised as a text field. **The chevron's colour is hard-coded
  in the data URI**: if the accent changes, that string must change with it.

### Index Row

- **Structure**: a 3-column grid — 7px status dot / name+slug / trailing chip — padded `7px 12px`.
- **Name** at mono 500 12px; **slug** beneath at mono 400 10px in `--dim`, and **only shown when it
  adds information**: a slug that is the same word as the name (compared with punctuation and case
  stripped) is suppressed unless a search is active and might have matched it.
- **States**: hover and keyboard-cursor take `--raise`; selected takes `--wash` and turns the name
  copper. Both selected and cursor rows carry `.brk`.
- **Search match** is a `<mark>` — solid copper with graphite text — injected through an
  escape-then-wrap helper so the highlight can never carry unfiltered markup.
- **Live chip**: `--black` on solid copper, mono 500 9px, `3px 4px`. It takes the accent, not the
  risk colour, because public exposure is a state worth noticing rather than a fault.

### Tabs

Uppercase mono 11px at 0.12em, `--dim`, transparent, sitting on a `--rule` bottom border with a -1px
margin so the selected tab meets it. The selected tab is a **solid copper block with graphite text**
— the same fill as a primary button, deliberately, because the tab is the current place.

### Asset Header (signature)

The system's centrepiece. A two-column grid inside a `.frame`: on the left the site's real name in
Anton at up to 68px, under it the slug in mono plus the class `<select>`, and under that the action
row led by the primary `apri`. On the right, a compact `auto auto` spec grid — state, blueprint,
created — with labels in dimmed 10px and values in mono 500 11px, right-aligned, where a
non-operational state turns the value red.

Deliberately **absent** from this block: the PHP version. It is identical across the fleet, and
constants belong in the overview tab, not in the identification block.

### Secret Row (signature)

Credentials render as a spec row whose value is a **redaction bar**: a 108×17px rectangle of copper
hazard stripes over `--black` with a `--rule` border. Two icon buttons follow — an eye to reveal, a
copy glyph that copies without revealing. Revealed state lives in a set keyed `slug:field`, and it is
cleared on every site switch and every tab change, so a secret exposed once never follows the
operator into the next screen. When Adminer is opened, the database password is copied to the
clipboard and the toast says so — a secret never moves silently.

### Dialogs

Square, 452px wide, `--ground` fill with a **solid copper** 1px border, backdrop `rgba(0,0,0,.78)`,
`margin: auto` re-asserted because the universal reset strips the user-agent's modal centring.
Title in Anton 26px, labels in the standard 10px label style with a `--dim` non-uppercase hint span,
actions right-aligned with cancel (`.quiet`) before confirm (`.primary`).

The **destructive** variant flips the border to red and adds a 7px red hazard band across the top
edge; its confirm button becomes `.risk`, and initial focus goes to **cancel**, so a reflexive Enter
cannot delete a site.

### Console Drawer

A 172px panel that slides in below the body for streaming NDJSON operations, bordered on top with
`--rule-hi`. Head is label / hairline bar / close icon. Body is pre-wrapped mono 11.5px in `--dim`,
auto-scrolled, with log lines prefixed `›`, success as `■ fatto` in copper and failure as
`■ errore:` in red.

### Empty, Failure and Loading States

- **Empty / no selection**: the content area gets `.void` and vertically centres a teaching panel —
  headline plus one Archivo sentence with inline copper keycaps — instead of certifying the void
  with marks. When a search has narrowed to a single site, the panel promotes that site's name into
  the headline and states what Enter will do. Beneath it, an **exceptions block** lists only the
  non-operational and the live-shared sites; when everything is healthy it renders nothing at all.
- **Failure**: a bordered red panel led by a 6px red hazard band bled to its edges, an Anton 30px
  heading and prose naming the recovery command.
- **Loading**: 11px `--raise` bars at 60/85/40% widths. No spinner exists in this build.

### Toast

Fixed bottom-centre, solid copper on graphite, uppercase mono 11px, `9px 14px`, no radius. It fades
and rises 6px over 160ms — **the only transition in the entire stylesheet** — and is fully suppressed
under `prefers-reduced-motion`.

### Rails

34px vertical strips carrying real data, not ornament: a reticle glyph plus vertical mono text
(`writing-mode: vertical-rl`, 0.24em tracking). The left rail is a static caption; the right rail
shows the open site's id — falling back to `:9700` — and swaps its reticle for a red warning
triangle when the daemon is down or any site is not up.

### Named Rules

**The Hazard Rule.** `--hazard` and `--hazard-m` appear in exactly three places: the redaction bar
over a secret, the failure panel's band, and the destructive dialog's band. They are absent from all
chrome, all headers and all decoration. A stripe on this screen means a real hazard; using it as
texture destroys the only warning device the system has.

**The One Primary Rule.** At most one solid-copper button per visible context. Everything else is
ghost or quiet. The copper fill is what makes `apri` findable without a label hierarchy.

**The Render Signature Rule.** *(architectural, and the design depends on it)* Every render function
computes a JSON signature of the exact state it draws (`sig.index`, `sig.head`, `sig.tabs`,
`sig.content`, `sig.rail`) and returns early when nothing has changed. The surface polls the daemon
every 4 seconds; without signatures every poll would rewrite `innerHTML` and destroy focus, typed
search text, scroll position and the open `<select>`. Any new panel must key itself the same way and
own its own signature slot — a component that redraws unconditionally is broken here regardless of
how it looks.

**The Drawn-Icon Rule.** Icons come from the local `<defs>` sprite, are stroked in `currentColor` on
a 24×24 grid, and are always paired with a text label except in the window controls and per-row
copy/reveal actions, which carry `title` and `aria-label`. No icon fonts, no emoji, no raster.

## Do's and Don'ts

### Do:

- **Do** lead every screen with the thing that identifies the object — set the name in Anton at
  display size and demote the constants.
- **Do** draw state only when it deviates. A healthy row shows a transparent dot; an all-healthy
  fleet shows no exceptions block at all.
- **Do** keep copper as the only accent, and keep red for anomaly, failure and destruction only.
- **Do** take any new palette value from the raffaelenocera-v3 theme's `graphite` / `steel` /
  `copper` ramps, and declare the exception in the stylesheet if a functional signal forces one.
- **Do** use hairlines (`--rule`), the three graphite planes, and corner marks to build structure —
  in that order, before considering any other device.
- **Do** reserve `.brk` for "this is the selected/active one" and `.frame` for "this is a framed
  block".
- **Do** set every identifier, path, credential, count and label in JetBrains Mono, and let long
  values wrap with `overflow-wrap: anywhere` rather than truncating them.
- **Do** put explanatory sentences in Archivo inside `.prose` or `.empty p`, capped at 64–68ch.
- **Do** give a destructive flow the red hazard band, the red border, a `.risk` confirm and initial
  focus on cancel.
- **Do** keep secrets behind a hazard-striped redaction bar with separate reveal and copy actions,
  and clear the revealed set on every navigation.
- **Do** give each new panel its own render signature and return early when its state is unchanged.
- **Do** strip native appearance from any OS control and redraw its affordance — and remember the
  `<select>` chevron's colour is hard-coded inside its `data:` URI.

### Don't:

- **Don't** add a shadow, glow, gradient fill, blur or backdrop-filter. This world is flat print;
  depth comes from planes, hairlines and corner marks.
- **Don't** round a corner. `border-radius: 0` is asserted everywhere on purpose.
- **Don't** use hazard stripes as texture, header ornament or brand pattern — only for a contained
  secret, a failure panel, or an irreversible action.
- **Don't** set Anton on a label, button, tab, spec value, table cell or any run of data.
- **Don't** colour text with `--faint`; it measures 3.9:1 and is for strokes only.
- **Don't** use `#ffffff` or `#000000` as a surface or text colour — the brightest value is
  `--white` (steel-100) and the darkest is `--black` (graphite-950). True black appears only in the
  modal backdrop.
- **Don't** put more than one solid-copper button in a context, and don't tint a risk control copper
  — including its focus ring.
- **Don't** treat `--risk` as a brand colour or extend it into a red ramp for anything decorative.
- **Don't** hide a disabled control or drop its border; keep it inert and readable at `--off`.
- **Don't** repeat a value that is identical across every item in a list (PHP version, port, base
  domain) in the identification block — push it into detail.
- **Don't** reintroduce the equal-card fleet grid, or the amber/rack palette this world replaced.
- **Don't** rebuild any surface with `confirm()`, `prompt()` or `alert()`; in-world dialogs exist so
  the language never breaks.
- **Don't** add motion beyond the toast's 160ms fade-and-rise, and never without honouring
  `prefers-reduced-motion`.
- **Don't** ship a component that rewrites its `innerHTML` on every poll tick.
