# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
delegated: plain HTML/CSS/JavaScript served by a Node.js backend, PostgreSQL persistence, and Socket.IO for shared live draw state.

## Users
- Administrators prepare participant data, run the draw, and start new rounds.
- Participants search for lottery numbers registered under part of a name.

## Product Purpose
Run a six-digit lottery-number draw and let participants check the numbers registered to their names. Success means a draw is visible live to everyone and the closest entries are clear after all six digits are drawn.

## Positioning
The draw reveals one digit at a time, immediately highlighting entries that match the digit in its corresponding place.

## Operating Context
- Administrators upload an Excel workbook containing names and six-digit lottery numbers.
- A draw reveals one digit per spin from ones to hundred-thousands place; each drawn digit is 1 through 9.
- Administrators choose whether each import appends to or replaces the current participant set.
- Participants search by part of a name; the interface returns matching valid and invalid entries.

## Capabilities and Constraints
- Valid lottery numbers are text matching `[1-9]{6}`. Invalid rows and their reasons remain stored and searchable, but are excluded from winner calculation. Integer values in Excel are zero-padded to six digits before validation.
- The winner is the valid entry with the smallest absolute numeric difference from the result; ties go to the lowest entry ID.
- Each completed round is saved, and administrators can start another round.
- Draw updates are shared live over Socket.IO; new and reconnecting clients receive a current snapshot.
- The `/admin` import and draw controls require a password session.
- The public view never shows a combined participant list; names and entries appear only in a search response.
- Public URL hosting is intended; the repository does not establish a hosting provider.

## Evidence on Hand
- No participant workbook, brand assets, or existing application code was supplied. Never fabricate real participants or draw results.

## Product Principles
- Make each drawn digit and its place immediately legible.
- Keep participant lookup direct and useful on small screens.
- Treat every six-digit number as text, including leading zeroes on invalid legacy data.
- Select one winner consistently when multiple entries have the same numeric difference.
- Make round results and shared live state consistent for all viewers.
