# App Store Connect checklist

This checklist reflects the data and features currently present in Splidly.
Recheck it whenever authentication, analytics, advertising, payments, uploads,
support tooling, or server-side retention changes.

## Release scope: iPhone and iPad

Version 1.0.0 is an iOS-only release that supports both iPhone and iPad. Expo's
`ios.supportsTablet` setting is enabled, so iPhone and iPad use the same build;
do not create a separate iPad platform or app record. Android remains a future
target and must not be submitted with this release.

Because the app runs on iPad, App Store Connect requires iPad screenshots.
Upload at least one current 13-inch iPad screenshot (up to ten are allowed),
without transparency, alongside the required iPhone screenshots. Use the
current sizes listed in Apple's screenshot specifications rather than resizing
an iPhone capture.

Before submission, install the signed TestFlight build on a physical iPad and
check:

- sign-in with Apple and Google, notification permission, and invite links;
- short and long Friends and Groups lists, including dragging empty space;
- group overview, Profile, group settings, and statistics;
- New Group and New Expense sheets, keyboard behavior, photo picking, and
  account deletion;
- portrait layout in light and dark mode, including the tab bar, navigation
  headers, home indicator, and all final buttons; and
- that the App Store build page lists both iPhone and iPad in its device family.

The app is intentionally portrait-only. If landscape support is desired later,
that is a separate product/layout change and should be tested before enabling
it.

## App Privacy

Splidly does not use data for advertising or cross-app tracking. Unless the
implementation changes, select **No** for tracking.

The following data is collected and linked to the user's identity for app
functionality:

| App Store data type   | Splidly source                                                                   |
| --------------------- | -------------------------------------------------------------------------------- |
| Name                  | Apple/Google account and editable display name                                   |
| Email Address         | Apple/Google account authentication                                              |
| Photos or Videos      | Provider profile image and user-selected profile or group pictures               |
| Other Financial Info  | Expenses, balances, splits, settlements, currencies, and exchange-rate snapshots |
| Other User Content    | Group names, expense descriptions, and notes                                     |
| User ID               | Splidly, Apple, and Google account identifiers                                   |
| Device ID             | Random installation identifier and APNs device token for push notifications      |
| Other Diagnostic Data | IP address and user agent retained with authenticated sessions for security      |

The Google Sign-In iOS SDK's privacy manifest additionally declares the
following partner collection. Include these answers unless the SDK or enabled
Google configuration is changed and a new privacy report shows they no longer
apply:

| App Store data type | Linked | Purpose                      |
| ------------------- | ------ | ---------------------------- |
| Name                | Yes    | App Functionality            |
| Email Address       | Yes    | App Functionality            |
| Phone Number        | Yes    | App Functionality            |
| Coarse Location     | Yes    | App Functionality            |
| User ID             | Yes    | App Functionality, Analytics |
| Device ID           | Yes    | Analytics                    |
| Other Usage Data    | Yes    | Analytics                    |
| Other Data Types    | Yes    | App Functionality, Analytics |

Verify these entries against the privacy report from the exact release archive
before answering App Store Connect. Apple framework processing that is not
received by Splidly does not need to be declared as Splidly collection.

Use these URLs:

- Privacy Policy URL: `https://splidly.site/privacy`
- User Privacy Choices URL: `https://splidly.site/account/delete`

Before submission, make sure `privacy@splidly.site` accepts mail or replace it
in `apps/server/src/pages.ts` with a monitored address.

## Account deletion review path

In the review notes, tell Apple that account deletion is available at
**Profile → Account → Delete account**. The reviewer can delete immediately;
open balances and active groups do not block the request. Splidly asks for a
fresh sign-in when the current session is more than 15 minutes old and then
shows one explicit irreversible-action confirmation.

Deletion revokes an available Sign in with Apple token, removes authentication
connections, sessions, invitations, push registrations, cached currency
requests, notification preferences, identifying profile data, and protected
Splidly data on the device. It also erases group images owned by the account and
financial descriptions and notes the account authored or most recently edited.
Shared financial amounts, currencies, and dates remain pseudonymized as
“Deleted user” because removing them would alter other participants' balances.
The public fallback deletion page is `https://splidly.site/account/delete`.

Before submission, verify this path with fresh Apple and Google test accounts,
including one account with an open balance. Confirm that the deleted account
cannot reuse its old session and that another participant still sees an
accurate balance attributed to “Deleted user.” Do not use a real account whose
ledger history must be retained.

## External TestFlight review

A group invitation is a suitable reviewer path. It can be accepted by multiple
accounts for seven days, unless the group owner revokes it. Keep the review
group free of real personal or financial data.

Prepare the group with:

- at least two seeded, clearly fictional members;
- several expenses in different currencies;
- at least one settlement and one remaining balance;
- descriptions that make the test data obviously fictional; and
- a group invite that will remain valid throughout review.

After the reviewer joins, existing transactions demonstrate group history but
do not give the new reviewer a balance. In the review notes, ask the reviewer
to add a small test expense involving their account and a seeded member, then
record a settlement. This exercises the complete workflow.

Suggested **Beta App Description**:

> Splidly is a private shared-expense ledger for friends and groups. Members
> record expenses and settlements, including multi-currency costs, and Splidly
> keeps each participant's balances synchronized. Splidly never moves money.

Suggested **What to Test**:

> Sign in with Apple or Google, then open this review-group invitation:
> [INSERT FRESH REVIEW INVITE URL]. Accept the invitation to inspect fictional
> sample expenses and settlements. Add a small expense involving your account
> and a seeded member, then use Settle Up on the Friends tab to record repayment.
> Profile contains the privacy policy, sign-out, and account-deletion controls.
> All review-group data is fictional and may be changed freely.

Also provide a monitored feedback email, review contact name and phone number,
and any authentication notes requested by App Store Connect.
