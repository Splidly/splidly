# Agent Instructions

## Never allow text selection

This requirement applies only to the React Native app in `apps/mobile`. Text
displayed by the mobile app must never be selectable on any mobile platform or
screen. It does not apply to websites or server-rendered pages, where normal
browser text selection must remain available.

- Keep `selectable={false}` on React Native `Text` components and shared text
  primitives. Never set `selectable` to `true`.
- Do not add selectable labels, values, headings, descriptions, list content,
  error messages, empty states, or other display text.
- Do not enable text-selection context menus as a way to provide copy actions.
  If copying is required, expose an explicit button or menu action instead.
- When adding or changing shared typography components, add or preserve tests
  that prevent text selection from being enabled accidentally.

## Mobile scrolling contract

Scrolling in `apps/mobile` is deliberately centralized. Treat the behavior in
`apps/mobile/src/components/ui.tsx` as the canonical implementation and use
`Screen` or `CollectionScreen` for every ordinary route. Do not create a
route-local `ScrollView` unless the screen has requirements these components
cannot support.

## Never use iOS simulators

Never use an iOS Simulator for this project. Simulator processes severely
degrade the developer machine's performance.

- Do not run `xcrun simctl` commands.
- Do not boot, open, inspect, or interact with an iOS Simulator.
- Do not launch an Expo or native iOS build against a simulator.
- Do not perform simulator-based visual checks, screenshots, or tests.
- Do not request permission to access simulator services.

Use static checks, unit tests, typechecking, and native platform exports
instead. Leave any visual verification that requires a running iOS app for the
user to perform on a physical device.

Every mobile screen must satisfy all of the following:

- Content longer than the viewport scrolls completely above the floating native
  tab bar. No row, button, footer, or scroll indicator may be cut off by it, and
  the final content has 16 points of breathing room above the bar.
- Content shorter than the viewport rubber-bands naturally on iOS and always
  returns to its resting position. It must not have a persistent scroll range or
  allow any portion of the content to remain scrolled off the top.
- Dragging anywhere in the visible screen, including empty space below short
  content, starts the ScrollView gesture and rubber-banding.
- A form sheet opens at its true top. It must never open with content already
  offset, make content above the initial position unreachable, or allow an
  excessive empty overscroll.
- Navigation headers, form-sheet chrome, the home indicator, and Native Tabs
  must use native inset handling rather than guessed padding values.

### Required implementation

`Screen` and `CollectionScreen` implement the contract as follows:

1. The `ScrollView` is the first native view in the route's rendered content so
   Expo Router Native Tabs and `react-native-screens` can discover it. A React
   fragment is fine; an intervening native `View` or safe-area wrapper is not.
2. The ScrollView uses
   `contentInsetAdjustmentBehavior="automatic"`. Native navigation owns the
   top and bottom content insets.
3. Native Tabs triggers retain automatic content insets. Do not add
   `disableAutomaticContentInsets`.
4. The ScrollView itself uses `flex: 1`.
5. Its content container must **not** use `flexGrow: 1`,
   `minHeight: "100%"`, fixed screen dimensions, or extra bottom padding to fill
   the viewport. Those values fill the raw ScrollView frame, after which iOS
   adds the native bottom inset and creates a false scroll range on short
   screens.
6. Instead, `useScrollViewportFill` measures the ScrollView viewport and sets
   the content container's minimum height to:

   `viewport height - current native bottom safe-area inset`

   This makes empty areas part of the gesture surface without increasing the
   total scrollable extent beyond the visible viewport.
7. `useScrollViewportFill` also compares the unpadded content height with that
   filled viewport height. It adds `spacing.md` (16 points) of bottom padding
   only when the content genuinely overflows. Short screens receive no bottom
   padding, because even 16 extra points would create a false resting scroll
   range.
8. Keep `alwaysBounceVertical` and `bounces` enabled for normal screens.
   `bounces={false}` is only for a screen that intentionally must not
   rubber-band.
9. Do not set `automaticallyAdjustKeyboardInsets` on the shared ScrollView. It
   caused form sheets to acquire incorrect initial offsets. Keep
   `keyboardDismissMode="interactive"` and
   `keyboardShouldPersistTaps="handled"`.

### Prohibited fixes

Do not attempt to fix scrolling by:

- wrapping a screen in `SafeAreaView`;
- adding guessed tab-bar or home-indicator padding;
- adding unconditional `paddingBottom` to the shared content container instead
  of using the overflow-aware spacing in `useScrollViewportFill`;
- restoring `flexGrow: 1` to `screenContent` or `collectionContent`;
- dynamically toggling `scrollEnabled` from content or viewport measurements;
- tracking keyboard visibility to enable or disable scrolling;
- forcing `contentOffset`, calling `scrollTo` on mount, or resetting offsets
  after layout;
- disabling Native Tabs automatic content insets;
- enabling `automaticallyAdjustKeyboardInsets`;
- auto-focusing a field in a form sheet when that focus can move its initial
  scroll position.

These approaches have already caused persistent top offsets, content hidden
behind the tab bar, unreachable content above a form sheet's initial position,
or entire sheets that could be dragged out of view.

### Adding a new screen

- Use `<Screen>` for forms, detail views, settings, profile-style pages, and
  form sheets.
- Use `<CollectionScreen>` for the top-level Friends and Groups collection
  pattern.
- Use `scroll={false}` only when non-scrolling behavior is intentional and the
  screen cannot require vertical adaptation on a smaller device.
- Put spacing in the shared content container or normal child layout. Do not add
  bottom spacing to compensate for navigation chrome.
- Avoid initial `autoFocus` in form sheets.
- If a route genuinely needs different behavior, add an explicit, narrowly
  named capability to the shared component and preserve the default contract
  for every existing screen.

### Verification

Any change to shared scrolling, Native Tabs, safe-area handling, a form sheet,
or the root layout must keep the regression test in
`apps/mobile/src/components/ui.test.tsx` passing. The test verifies that native
automatic insets remain enabled, keyboard inset mutation remains disabled,
rubber-banding remains enabled, `flexGrow` is absent, and viewport fill
subtracts the native bottom inset. It also verifies that short content gets no
bottom padding while overflowing content gets exactly `spacing.md`.

Run:

```sh
apps/mobile/node_modules/.bin/tsc -p apps/mobile/tsconfig.json --noEmit
apps/mobile/node_modules/.bin/jest --config apps/mobile/package.json --runInBand
git diff --check
```

For changes affecting layout or navigation, also export both native platforms.
Never use an iOS Simulator for manual verification. Tell the user that the
following visual checks remain for a physical device:

- a short group overview;
- a long Groups list;
- Profile and group settings;
- New Group and New Expense form sheets;
- dragging from both populated and empty areas;
- light and dark mode.
