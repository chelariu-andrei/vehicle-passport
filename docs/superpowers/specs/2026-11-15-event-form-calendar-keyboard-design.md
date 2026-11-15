# Add/Edit event form: calendar and keyboard fixes

Date: 2026-11-15 · Scope: `mobile/` only (no contract or backend change)

## Problems

1. **Calendar looks bad when open.** On iOS `DateField` renders an inline `DateTimePicker` inside the scrolling form. It pushes the fields down, can sit partly below the fold, and stays open after a day is picked.
2. **Keyboard does not close.** `number-pad` / `decimal-pad` keyboards on iOS have no return key, and the multiline notes field turns Enter into a newline. The keyboard covers the Save button, and the user can't tap it.

## Fixes

### 1. Calendar (`EventFormScreen.tsx` → `DateField`)
- On iOS the inline calendar opens in a centred `Modal` card with a dimmed backdrop, so it is always fully on screen and does not reflow the form.
- Picking a day calls `onChange` and closes the modal. Tapping the backdrop also closes it.
- Android is unchanged (native dialog already closes on select).
- `testID="event-date-picker"` stays on the picker so existing tests keep working.

### 2. Keyboard (`Field.tsx`, `Screen.tsx`)
- `Field` single-line inputs: `returnKeyType="done"` (Enter dismisses the keyboard).
- `Field` multiline inputs: `submitBehavior="blurAndSubmit"`, so Enter closes the keyboard (notes is capped at 2000 chars and a newline isn't needed).
- iOS numeric keyboards: a `Done` bar (`InputAccessoryView`) above the keyboard that dismisses it.
- `Screen` scroll view: `keyboardDismissMode="on-drag"`, so scrolling the form also closes the keyboard.
- Applies to every `Field` in the app, which is the intent.

## Out of scope
Attachments (separate spec), restyling the picker, web.

## Verification
- Existing `event.date` tests still pass; add a test that picking a date closes the picker.
- `npm test`, `tsc --noEmit`, lint.
