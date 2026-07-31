# App Store Connect checklist

This checklist reflects the data and features currently present in Splidly.
Recheck it whenever authentication, analytics, advertising, payments, uploads,
support tooling, or server-side retention changes.

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

## External TestFlight review

A reusable group invitation is a suitable reviewer path because group invites
remain valid for 30 days and can be accepted by more than one account. Keep the
review group free of real personal or financial data.

Prepare the group with:

- at least two seeded, clearly fictional members;
- several expenses in different currencies;
- at least one settlement and one remaining balance;
- descriptions that make the test data obviously fictional; and
- a fresh group invite that will remain valid throughout review.

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
