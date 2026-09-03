# Android Optimization Plan

Splidly should share product behavior across iOS and Android while using the
navigation, interaction, and visual conventions users expect on each platform.
Android should not be a visual copy of iOS, and platform-specific components
should remain narrow enough that business logic stays shared.

## Phase 1 - Navigation and feature parity

- Inventory every route and every header action on Android and iOS.
- Use Material XML image sources for Android toolbar buttons and SF Symbols for
  iOS toolbar buttons.
- Add regression coverage that detects toolbar buttons without an Android image
  source.
- Use a back arrow for pushed destinations and a close action for modal editing
  flows.
- Keep confirmation actions at the right side of modal app bars.
- Verify Android system Back and predictive Back behavior for screens, dialogs,
  and unsaved form state.

## Phase 2 - Sheets and editing flows

- Classify each presentation as a standard destination, bottom sheet, or
  full-screen dialog based on its content and purpose.
- Reserve bottom sheets for short, focused choices or actions.
- Use full-screen dialogs for searchable lists and multi-step editors such as
  currency selection and expense allocation.
- Give every modal flow an explicit close action and ensure system Back behaves
  consistently.
- Test keyboard resizing, focus movement, and safe-area handling on small and
  large Android devices.

## Phase 3 - Material 3 presentation

- Add Android-specific theme tokens for surface hierarchy, typography, corner
  radius, state layers, and elevation while preserving shared semantic colors.
- Standardize 48 dp minimum touch targets, Material ripples, list row density,
  and top app bar spacing.
- Review buttons, fields, switches, menus, dialogs, empty states, and loading
  states for Material 3 behavior.
- Keep platform-specific rendering in focused `.android.tsx` and `.ios.tsx`
  components instead of spreading platform checks through business logic.

## Phase 4 - List and animation performance

- Use `FlatList` or `SectionList` for long or searchable collections.
- Avoid constructing a large React-to-Compose element tree on every keystroke.
- Memoize expensive row data and callbacks only where profiling shows a useful
  reduction in work.
- Measure picker filtering, statistics scrolling, group activity scrolling,
  and expense editor responsiveness in release-like builds.
- Define practical performance targets for input response, dropped frames, and
  first useful render.

## Phase 5 - Android system integration

- Verify edge-to-edge drawing, status bar contrast, navigation bar contrast,
  keyboard insets, and display cutouts.
- Test light mode, dark mode, increased font size, display scaling, and TalkBack.
- Check Android share sheets, deep links, notifications, notification routing,
  and permission prompts.
- Validate app lifecycle behavior when Android recreates an activity or resumes
  the app from a notification.

## Phase 6 - Regression gates

- Add route-level tests for navigation actions and modal close or save actions.
- Add Android component tests for virtualized pickers and platform controls.
- Keep TypeScript, Jest, Android export, iOS export, and `git diff --check` in the
  verification set.
- Perform a short Android smoke-test checklist before each release on at least
  one small phone profile and one current Pixel profile.

## Proposed Codex skill

Create a project-specific `android-ui-audit` skill after the first full audit.
It should combine the Expo Router and Material 3 rules that matter to Splidly:

- flag SF Symbol-only `Stack.Toolbar` actions that disappear on Android;
- flag searchable or content-heavy routes presented as Android form sheets;
- check that pushed screens, modals, and editors expose correct Back or close
  behavior;
- flag non-virtualized long lists and large React-to-Compose child trees;
- check touch target size, ripple feedback, font scaling, TalkBack labels, dark
  mode, and system bar contrast;
- run the project's static verification commands without starting an iOS
  Simulator.

The existing Expo native UI and Jetpack Compose skills are useful references,
but this project-specific skill would encode Splidly's exact navigation,
scrolling, accessibility, and verification contracts.
