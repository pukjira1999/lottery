---
name: วงล้อลุ้นเลข
description: A shared six-digit draw and ticket lookup presented on a warm-paper live board.
colors:
  ticket-green: "#177b4c"
  forest-green: "#0d5936"
  match-wash: "#ddf1e3"
  paper: "#f5f3ed"
  white-paper: "#fffefa"
  deep-ink: "#1d2d25"
  soft-ink: "#56645b"
  muted-ink: "#79837a"
  rule: "#d8d8cf"
  strong-rule: "#9ba59b"
  warning: "#704a16"
  warning-border: "#d7bd91"
  warning-wash: "#fbf5ea"
  danger: "#9b3c32"
  alternate-row: "#f8f7f2"
typography:
  display:
    fontFamily: '"Noto Sans Thai", Tahoma, sans-serif'
    fontSize: "clamp(28px, 3.3vw, 42px)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-.045em"
  headline:
    fontFamily: '"Noto Sans Thai", Tahoma, sans-serif'
    fontSize: "18px"
    fontWeight: 600
    letterSpacing: "-.025em"
  body:
    fontFamily: '"Noto Sans Thai", Tahoma, sans-serif'
    fontSize: "13px"
    fontWeight: 400
  label:
    fontFamily: '"Noto Sans Thai", Tahoma, sans-serif'
    fontSize: "10px"
    fontWeight: 600
  control:
    fontFamily: '"Noto Sans Thai", Tahoma, sans-serif'
    fontSize: "12px"
    fontWeight: 600
  search:
    fontFamily: '"Noto Sans Thai", Tahoma, sans-serif'
    fontSize: "14px"
    fontWeight: 400
  navigation:
    fontFamily: '"Noto Sans Thai", Tahoma, sans-serif'
    fontSize: "13px"
    fontWeight: 700
  numeric:
    fontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace'
    fontSize: "12px"
    fontWeight: 500
rounded:
  square: "0px"
  circle: "50%"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.forest-green}"
    textColor: "{colors.white-paper}"
    typography: "{typography.control}"
    rounded: "{rounded.square}"
    padding: "0 16px"
    height: "42px"
  button-primary-hover:
    backgroundColor: "#07452a"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.deep-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.square}"
    padding: "0 16px"
    height: "42px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.forest-green}"
    typography: "{typography.control}"
    rounded: "{rounded.square}"
    padding: "0 16px"
    height: "38px"
  input-search:
    backgroundColor: "{colors.white-paper}"
    textColor: "{colors.deep-ink}"
    typography: "{typography.search}"
    rounded: "{rounded.square}"
    padding: "0 14px"
    height: "49px"
  chip-count:
    textColor: "{colors.soft-ink}"
    typography: "{typography.numeric}"
    rounded: "{rounded.square}"
    padding: "0 5px"
    height: "22px"
  nav-active:
    backgroundColor: "transparent"
    textColor: "{colors.deep-ink}"
    typography: "{typography.navigation}"
    rounded: "{rounded.square}"
  ticket-card:
    backgroundColor: "{colors.white-paper}"
    textColor: "{colors.deep-ink}"
    rounded: "{rounded.square}"
    padding: "26px 28px 14px"
---

# Design System: วงล้อลุ้นเลข

## Overview

**Creative North Star: "ตั๋วและกระดานสด"**

The six-digit draw uses a segmented result ticket beside a fixed-order participant board. Warm paper tones, dark green print, perforation-like rules, and tabular numerals carry the ticket-and-live-board direction into a practical Thai-language interface.

The visual language keeps each digit place visible as the draw advances. Green marks drawn and matching positions, while quiet rules and paper surfaces keep names, entries, and controls legible. The same system supports the draw, exact-name lookup, and saved results without making the interface copy read like a travel document.

**Key Characteristics:**
- Warm paper surfaces and forest-green actions or match states.
- Six equal, fixed-order digit positions with tabular numerals.
- Square panels, fine rules, and restrained ticket perforation details.
- Thai interface labels with a Thai sans-serif and a distinct numeric mono face.

## Colors

The palette pairs warm paper and dark olive-green ink with a restrained forest-green accent family; green is reserved for actions, active navigation, and draw-match feedback.

### Primary
- **Ticket Green**: Main accent for active navigation, digit progress, icons, and match cues.
- **Forest Green**: High-contrast action and result color for primary controls and completed digits.
- **Match Wash**: Pale green fill behind matching digit positions.

### Neutral
- **Warm Paper**: Main page background.
- **White Paper**: Navigation, result ticket, and form-control surface.
- **Deep Ink**: Main text and strong structural rules.
- **Soft Ink**: Supporting copy and secondary text.
- **Muted Ink**: Quiet labels, hints, and table headings.
- **Paper Rule**: Standard divider and border.
- **Strong Rule**: Emphasized table and section separators.

**The Green Match Rule.** Use the green family for active progress and matching digits so the state reads consistently across the ticket and participant board.

## Typography

**Display Font:** Noto Sans Thai (with Tahoma and sans-serif fallbacks)  
**Body Font:** Noto Sans Thai (with Tahoma and sans-serif fallbacks)  
**Label/Mono Font:** IBM Plex Mono (with SFMono-Regular, Consolas, and monospace fallbacks)

**Character:** The interface uses a compact, direct Thai sans-serif for labels and explanations. IBM Plex Mono makes each lottery digit distinct and evenly aligned; Georgia is limited to the small italic information mark.

### Hierarchy
- **Display** (600, responsive 28–42px, 1.2 line-height): Page titles, with tight tracking.
- **Headline** (600, 18px): Section headings such as the ticket and participant list.
- **Body** (400, usually 12–13px): Short explanatory copy and table content.
- **Label** (usually 9–11px, often 600): Navigation-adjacent metadata, field labels, and table headings.
- **Numeric** (IBM Plex Mono, 400–600, 10px and up): Six-digit values, round markers, counts, and match scores; use tabular numerals where numbers form a sequence.

**The Place-Value Rule.** Keep lottery digits in the mono face with tabular alignment so a position stays easy to compare as the draw progresses.

## Layout

The desktop page is centered within a maximum 1440px shell. The draw view pairs a flexible main column with a 296px administration rail, widening the gap responsively; at 960px the rail narrows to 260px, and at 720px the layout stacks into one column. Navigation moves below the brand at 960px and becomes horizontally scrollable on smaller screens. Gutters reduce to 18px on mobile and 13px below 390px.

The result ticket always uses six equal columns in draw order. Participant rows remain in a fixed data table, with matching digits highlighted in place. Use the observed 8px, 16px, and 24px spacing steps for compact controls, grouped content, and larger section gaps.

**The Fixed-Place Rule.** A match changes color and emphasis inside its existing digit cell; it does not move the number or reorder the participant row.

## Elevation & Depth

Depth comes mainly from paper-toned surface changes and thin borders. The result ticket has one shallow structural shadow; the connected indicator adds a small status halo. Other panels and controls stay flat.

### Shadow Vocabulary
- **Ticket lift** (`0 7px 18px rgb(35 58 43 / 7%)`): Separates the white result ticket from its tinted draw panel.
- **Connected status halo** (`0 0 0 3px #dff1e4`): Shows the connected state around its small green indicator.

The draw view enters with a brief upward fade; the digit roll and controls honor the reduced-motion preference.

## Shapes

The form language is square and document-like: result panels, buttons, inputs, chips, and drop zones use straight corners. Thin solid and dashed rules provide structure. Circular cutouts along the draw panel echo perforation, and status dots remain circular; these small circles do not change the square geometry of the main surfaces.

## Components

### Buttons
- **Character:** Compact, square controls with clear green emphasis for the next draw action.
- **Shape:** Square corners (0px); minimum 42px height for main draw actions.
- **Primary:** Forest-green fill, white text, 0 16px horizontal padding, and a small lift on hover; hover darkens the fill.
- **Quiet:** Transparent fill with a muted border; hover adds a faint paper-green surface.
- **Outline:** Full-width transparent control with forest-green border and text in the import form.
- **Focus / Active / Disabled:** Keyboard focus uses the shared 3px green outline; pressed buttons settle to their base position; disabled controls fade to 45% opacity.

### Chips
- **Style:** The entry count is a small square outlined chip with soft ink and mono numerals.
- **State:** Matching ticket digits use pale green fill and forest-green text; matched positions gain stronger weight.

### Cards / Containers
- **Corner Style:** Square edges (0px).
- **Background:** A tinted green draw panel holds a white-paper result ticket.
- **Shadow Strategy:** Keep the ticket’s shallow shadow unique; rely on border and tonal contrast for surrounding sections.
- **Border:** Fine solid rules around the panel and ticket; dashed separators divide the six digit cells.
- **Internal Padding:** Ticket padding is 26px 28px 14px on desktop, tightened on mobile.

### Inputs / Fields
- **Style:** Search input and select controls use white-paper fill, a one-pixel muted-green border, square corners, and comfortable horizontal padding.
- **Focus:** Keyboard focus receives the shared 3px green outline with a 3px offset.
- **File drop:** A centered dashed outline holds a green upload icon, a short filename prompt, and a compact format hint; hover and drag-over strengthen the green border.

### Navigation
- **Style:** Text-only Thai labels in a horizontal row on a white-paper header.
- **Active:** Deep ink and bold weight with a 3px green underline.
- **Hover:** Deep ink text; inactive items remain muted.
- **Mobile:** Navigation moves below the brand and scrolls horizontally when needed.

### Six-Place Result Ticket
Six equal digit cells align place labels above large tabular numerals. The current place receives a pale green tint and green underline; spinning and completed states use green emphasis. Keep its small perforation marks and two circular side cutouts as secondary cues.

## Do's and Don'ts

### Do:
- **Do** keep all six digit places visible in their fixed order.
- **Do** highlight matching digits in place with the green match treatment.
- **Do** keep number strings in the tabular mono face, including leading zeroes.
- **Do** let paper surfaces and fine rules carry most of the layout structure.

### Don't:
- **Don't** move or reorder participant rows as matches arrive.
- **Don't** round the main ticket, buttons, inputs, or data panels.
- **Don't** add literal travel terminology to product copy; the ticket geometry carries the chosen metaphor.
