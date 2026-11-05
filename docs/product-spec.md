# Nail Tech Pay Tracker
**Product Requirements Document (PRD) — Version 1.0**

**Product type:** Personal nail technician earnings tracker  
**Target audience:** Individual nail technicians working in the United States  
**Primary platforms:** iPhone / mobile web / installable PWA  
**Languages:** English and Vietnamese  
**Business model:** Free core application  
**Development status:** New product / MVP

---

## 1. Product Vision

Build a fast, simple, private, mobile-first application that allows individual nail technicians to track their daily work, customer turns, service revenue, cash tips, card tips, commission, and actual take-home earnings.

The application must be designed around the everyday workflow of a nail technician working at an American nail salon.

**The primary product promise:**

> Know exactly how many clients you served, how much money you made, how much commission you earned, and how much your salon owes you — without using the salon's software.

The user should be able to record a completed customer service in approximately 10–15 seconds after initial setup.

The app must not require an employer account, salon approval, POS integration, or access to customer payment systems.

## 2. User Profile

### Primary user

An individual Vietnamese-speaking nail technician living and working in the United States.

Typical characteristics:
- Works at an independent nail salon.
- May be paid through commission, commonly 60/40 or 50/50.
- Handles multiple customers throughout the day.
- Receives cash tips and credit card tips.
- Wants an independent record of earnings.
- May receive payment weekly, biweekly, or on another schedule.
- Uses an iPhone.
- Prefers a simple interface with Vietnamese language support.
- Wants to avoid recurring subscription fees.

### Main user problems

1. Manually remembering the number of turns worked each day.
2. Having to calculate commission on service revenue.
3. Forgetting how much individual customers tipped.
4. Difficulty separating cash tips from card tips.
5. Uncertainty about how much money the salon owes at payday.
6. No convenient way to review earnings over several weeks or months.
7. Existing salon software is often intended for business owners rather than individual workers.
8. Some available personal tracking apps require subscriptions.

## 3. Product Scope

### MVP — Mandatory

- Personal daily turn tracking.
- Individual customer/service entries.
- Service price tracking.
- Configurable commission calculations.
- Cash tip tracking.
- Credit card tip tracking.
- Daily, weekly, and monthly income summaries.
- Work history with editing and deletion.
- Payday and payout reconciliation.
- English/Vietnamese interface.
- USD formatting.
- Offline local data storage.
- Data export and backup.
- Mobile-first interface.
- No account required.
- Free core functionality.

### Phase 2 — Optional

- Multiple salon profiles.
- Hourly wage tracking.
- Hybrid wage plus commission.
- Guaranteed minimum pay.
- Advanced tip-pooling rules.
- Expense tracking.
- Customer-request versus walk-in statistics.
- Charts and earnings trends.
- Home-screen widgets.
- Cloud backup and synchronization.
- Native iOS packaging.
- Optional PIN or biometric lock.

### Explicit non-goals for MVP

Do not build:
- Salon-wide employee management.
- Appointment booking.
- Customer marketing/CRM.
- Inventory management.
- POS payments.
- Credit card processing.
- Salon scheduling systems.
- Employee time-clock enforcement.
- Tax filing services.
- Employer payroll processing.
- Subscription payment infrastructure.

This application is a **personal work and income tracker**, not an employer payroll platform.

---

## 4. Core Terminology

| Term | Meaning |
|---|---|
| Turn | One customer/service rotation recorded by the technician |
| Service | A nail service performed, such as manicure, pedicure, Gel-X, or acrylic |
| Ticket | Total service revenue for a customer visit |
| Commission | Technician's share of eligible service revenue |
| Cash Tip | Tip received in physical cash |
| Card Tip | Tip recorded on a credit/debit card |
| Gross Service Revenue | Total service value before commission |
| Earned Income | Commission plus eligible tips and other compensation |
| Paid Amount | Money confirmed as received by the technician |
| Outstanding Balance | Earned amounts not yet marked as paid |
| Payday | Date the technician receives payment |
| Request Client | Client who specifically asks for the technician |
| Walk-in | Client assigned without requesting the technician |

The app must not assume that a "turn" always equals exactly one service. One customer visit may contain multiple services.

---

## 5. Screen Specifications

### Screen 1: Home / Today Dashboard

This is the primary screen and must load immediately when the application opens.

**Required information:**
- Today's date.
- Total turns completed today.
- Total service revenue.
- Total commission earned.
- Total cash tips.
- Total card tips.
- Total earned income.
- Number of customers served.
- Recent transactions.
- Large "+ Add Turn" button.

**Suggested layout:**

TODAY — Wednesday, November 4

**8 Turns**  
**$430.00 Service Revenue**

Commission: $258.00  
Cash Tips: $55.00  
Card Tips: $35.00

**Total Earned: $348.00**

[+ Add Turn]

Recent Turns:
- Turn #8 — Pedicure — $45 — Tip $10
- Turn #7 — Gel-X — $70 — Tip $15
- Turn #6 — Manicure — $30 — Tip $5

All numbers above are illustrative.

**Behavior:**
- Update instantly after adding/editing an entry.
- Reset today's display at local midnight, while retaining all historical data.
- Show zero-state guidance when no entries exist.
- Support viewing another date.

### Screen 2: Add Turn

This is the most important interaction.

**Required fields:**

| Field | Type | Default |
|---|---|---|
| Date/time | Date/time picker | Current local time |
| Turn count | Integer | 1 |
| Service type | Quick-select | Last used |
| Service amount | Currency | Empty |
| Commission percentage | Percentage | Salon default |
| Cash tip | Currency | $0 |
| Card tip | Currency | $0 |
| Client type | Optional selector | Unspecified |
| Notes | Optional text | Empty |

**Service quick-select options:**
- Manicure
- Pedicure
- Gel Manicure
- Gel Pedicure
- Gel-X
- Acrylic Full Set
- Acrylic Fill
- Dip Powder
- Nail Art / Design
- Removal
- Other / Custom

Users must be able to add, rename, reorder, and remove custom service presets.

**Additional requirements:**
- Support more than one service under a single customer visit.
- Allow selecting a preset and immediately entering the ticket amount.
- Calculate commission and earned amount in real time.
- Save in one action.
- Return to the Today dashboard after saving.
- Never require entering a customer name.
- Save all financial values precisely to two decimal places.
- Offer an optional "Save & Add Another" action.
- Allow editing and deleting previous entries.

**Turn-count behavior:**

Turn count must be configurable because salons may use different definitions of a turn.

Default: One customer visit counts as one turn, even when multiple services are performed.

Allow an override per entry, including zero turns for adjustments or services that should not count toward the rotation.

### Screen 3: History

Show all saved transactions.

**Required functionality:**
- List entries by day.
- Group entries chronologically.
- Display turn number, services, amount, tips, and earned income.
- Filter by date.
- Edit existing entries.
- Delete entries with confirmation.
- Search or filter by service type.
- Display each day's income total.

**Date navigation:**
- Today
- Yesterday
- This Week
- Last Week
- Custom Range

Deleting an entry must trigger recalculation of every affected summary.

### Screen 4: Earnings / Reports

Display earnings across different time periods.

**Time filters:**
- Daily
- Weekly
- Monthly
- Yearly
- Custom date range

**Required metrics:**
- Total turns.
- Total service revenue.
- Total commission.
- Total cash tips.
- Total card tips.
- Total tips.
- Total earned income.
- Total paid.
- Outstanding balance.
- Average earnings per turn.
- Average tips per turn.
- Average earnings per working day.

**Charts:**
- Daily earnings bar chart.
- Weekly earnings trend.
- Monthly earnings trend.
- Service revenue versus earned income.

Charts can be deferred until after the core reports function correctly.

**Export:**
- Export CSV.
- Export JSON backup.
- Optional PDF summary in Phase 2.

### Screen 5: Payday / Payout Tracker

The user needs to confirm whether the salon paid the expected amount.

**Required functionality:**
- Configure a pay period.
- Weekly, biweekly, or custom.
- Show expected earnings for that period.
- Record payments received.
- Track partial payments.
- Show unpaid balance.

Example:

Pay Period: November 1–7

Service Commission: $1,200  
Card Tips: $240  
Cash Tips: $180

Total Earned: $1,620  
Cash Tips Already Received: $180  
Expected Salon Payout: $1,440

Salon Paid: $1,400

**Outstanding: $40**

A payment can cover multiple days, and a pay period can have multiple payments.

Cash tips already received directly must not be counted again as money owed by the salon.

Do not automatically mark credit card tips as paid.

### Screen 6: Settings

**Essential settings:**
- Language: English / Vietnamese.
- Currency: USD.
- Default commission: 60%, 50%, or custom.
- Commission calculation basis.
- Whether different services have different commission rates.
- Workweek start day.
- Payday schedule.
- Default treatment of cash tips.
- Default treatment of card tips.
- Service presets.
- Data backup.
- Data restore.
- Export history.
- Delete all data with confirmation.

Default weekly reporting should allow a configurable week start (Sunday or Monday).

---

## 6. Commission Calculation Engine

The financial calculation engine must be independent of the interface and fully unit tested.

### Standard commission

**Formula:**

Commission = Eligible Service Revenue × Commission Rate

Example:

Service: $100  
Commission Rate: 60%

Commission = $100 × 0.60 = $60

### Total earned income

**Formula:**

Earned Income = Commission + Cash Tips + Card Tips + Other Earned Compensation − Applicable Deductions

Example:

Service Revenue: $100  
Commission: 60%  
Cash Tip: $10  
Card Tip: $15

Commission: $60  
Total Tips: $25

**Earned Income: $85**

### Multiple services

Example:

Gel Manicure: $40  
Pedicure: $50  
Design: $15

Total Service Revenue = $105

Commission at 60% = $63

If card tip is $15:

Total Earned = $78

Count this as one customer visit and one turn by default.

### Different commission rates

Support service-specific commission rates.

Example:

Gel-X: $75 at 60% = $45  
Nail Art: $20 at 70% = $14

Total Commission = $59

### Important commission rules

- Tips are not part of service revenue for calculating commission by default.
- Tips are generally credited fully to the technician unless the user configures a different tip arrangement.
- Allow commission overrides per entry.
- Allow zero-commission services.
- Allow negative financial adjustments as separately typed adjustment records.
- Never silently change historical commission calculations after a default rate is updated.
- Store the commission rate and financial amounts applicable to each transaction.
- Use integer cents for monetary arithmetic; never floating-point currency calculations.
- Calculate money using explicitly defined rounding rules.

### Optional advanced compensation modes

Future support:
- Hourly rate.
- Hourly plus commission.
- Daily guarantee.
- Guaranteed base plus variable earnings.
- Tiered commission.
- Custom salon-defined pay rules.

These should not complicate the initial setup experience.

---

## 7. Cash Tips Versus Card Tips

The application must track the two independently.

**Cash tips:**
- May be received immediately.
- May not be included in the salon's later payment.
- Must appear in overall earned income.
- Must be separately identifiable as already paid or unpaid.

**Card tips:**
- May be held by the salon until payday.
- Must appear in earned income.
- Must be included in expected salon payouts if not already paid.

**Important:** Earned income and unpaid salary are not the same metric.

The app must use a clear distinction between:
1. Money earned.
2. Money already received.
3. Money still owed.

---

## 8. Data Model

Use a local-first relational database or equivalent structured persistence.

### Entity: Settings

Fields:
- id
- language
- currency
- defaultCommissionRate
- commissionBasis
- weekStartDay
- payPeriodType
- payPeriodAnchorDate
- theme
- createdAt
- updatedAt

### Entity: SalonProfile

Although MVP may only have one profile, the architecture should support more than one later.

Fields:
- id
- name
- defaultCommissionRate
- isActive
- createdAt
- updatedAt

### Entity: ServicePreset

Fields:
- id
- salonId (nullable)
- nameEn
- nameVi
- defaultPriceCents (nullable)
- defaultCommissionRate (nullable)
- isCustom
- sortOrder
- isActive
- createdAt
- updatedAt

### Entity: Turn

Fields:
- id (UUID)
- salonId (nullable)
- occurredAt
- localWorkDate
- turnCount
- clientType
- note
- cashTipCents
- cardTipCents
- commissionTotalCents
- serviceRevenueTotalCents
- earnedTotalCents
- createdAt
- updatedAt

### Entity: TurnService

Fields:
- id
- turnId
- servicePresetId (nullable)
- serviceNameSnapshot
- servicePriceCents
- commissionRateSnapshot
- commissionCents
- createdAt
- updatedAt

Service names and rates must be snapshotted to prevent historical entries from changing when the user edits a service preset.

### Entity: Adjustment

Fields:
- id
- occurredAt
- localWorkDate
- amountCents (signed)
- category
- note
- createdAt
- updatedAt

Examples:
- Manual earning bonus.
- Commission correction.
- Tip correction.
- Non-payroll bookkeeping deduction.

### Entity: Payment

Fields:
- id
- paymentDate
- amountCents
- paymentMethod
- notes
- createdAt
- updatedAt

### Entity: PaymentAllocation

Fields:
- id
- paymentId
- payPeriodId
- amountCents

This enables partial payments and payments spanning multiple periods.

### Entity: PayPeriod

Fields:
- id
- startDate
- endDate
- status
- createdAt
- updatedAt

Use explicit relationships and foreign keys.

Use UTC timestamps for system event times, while preserving the user's local work date independently.

---

## 9. User Experience / UI Requirements

### General visual direction

The interface should feel like a modern personal finance app customized for nail technicians.

**Style:**
- Clean.
- Minimal.
- Professional.
- Friendly.
- High readability.
- Rounded components.
- Generous touch targets.
- Strong financial number hierarchy.

Avoid overly decorative salon-themed interfaces.

### Color palette

Suggested:
- Background: Warm white.
- Primary: Deep plum or muted rose.
- Secondary: Light neutral gray.
- Positive income: Muted green.
- Outstanding balance: Amber.
- Error/negative: Red.

Support light and dark themes eventually.

### Navigation

Bottom navigation with four or five tabs:

1. Today
2. History
3. Earnings
4. Payday
5. Settings

The Add Turn action should always be easy to access.

### Input optimization

- Open numeric keypad automatically for money fields.
- Keep inputs large enough for one-handed use.
- Preserve recent service selections.
- Minimize unnecessary typing.
- Auto-fill current date.
- Support one-tap preset selection.
- Show commission and total earned before saving.

### Vietnamese localization

Provide genuine Vietnamese translations, not machine-like literal phrasing.

Examples:

| English | Vietnamese |
|---|---|
| Today | Hôm nay |
| Add Turn | Thêm turn |
| Total Turns | Tổng số turn |
| Service Amount | Tiền dịch vụ |
| Commission | Tiền chia |
| Cash Tips | Tip tiền mặt |
| Card Tips | Tip thẻ |
| Total Earned | Tổng tiền kiếm được |
| Payday | Ngày nhận lương |
| Outstanding Balance | Tiền chưa nhận |
| History | Lịch sử |
| Settings | Cài đặt |
| Save | Lưu |
| Edit | Chỉnh sửa |
| Delete | Xóa |

Keep the term **turn** recognizable because it is common in Vietnamese-American nail salon conversation.

---

## 10. Onboarding

On first launch, display a short onboarding process.

### Step 1: Choose language

English / Tiếng Việt

### Step 2: Select pay arrangement

- 60% commission.
- 50% commission.
- Custom commission.
- Other (future support).

### Step 3: Configure tips

Ask how the technician normally receives tips.

- Cash tips immediately, card tips at payday.
- All tips at payday.
- Custom.

### Step 4: Choose payday frequency

- Weekly.
- Every two weeks.
- Custom.
- Skip.

### Step 5: Start tracking

Show dashboard with a clear Add First Turn button.

Do not require registration or collecting personal information.

Onboarding should be skippable, and every setting must remain editable.

---

## 11. Offline Storage, Privacy, and Backup

### Requirements

- Work without internet.
- Local data storage by default.
- No required account.
- No advertising SDKs.
- No personal financial data sent to external services by default.
- No analytics collecting client or income details.
- No dependency on salon software.
- Export all data.
- Restore from backup.

### Backup architecture

Support a downloadable JSON backup containing:
- Schema version.
- Settings.
- Service presets.
- Turns.
- Turn services.
- Adjustments.
- Pay periods.
- Payments.
- Payment allocations.

Restoration must validate input, support schema migrations, and prevent duplicate IDs.

Provide a warning that browser data can be deleted and that exporting a backup is important.

---

## 12. Recommended Technical Architecture

**Preferred MVP implementation:**

- React.
- TypeScript.
- Vite.
- Tailwind CSS.
- IndexedDB using Dexie.js.
- React Router.
- Zustand or simple React state.
- date-fns.
- Zod for input validation.
- Vitest for unit testing.
- Playwright for end-to-end tests.
- PWA manifest.
- Service worker for offline usage.

Use a responsive web interface optimized for iPhone Safari and home-screen installation.

### Architecture layers

1. **Presentation:** React screens and reusable UI components.
2. **Domain:** Financial calculations and pay-period logic.
3. **Data:** IndexedDB repositories and migrations.
4. **Localization:** English and Vietnamese dictionaries.
5. **Export:** JSON backup and CSV reporting.

The domain calculation layer must be framework-independent.

### Important engineering principles

- Strict TypeScript types.
- Avoid `any` where possible.
- Reusable components.
- No hardcoded financial values.
- Centralized currency formatting.
- Consistent input validation.
- Persistent data across refreshes.
- Clear migrations for database updates.
- No backend required for MVP.
- No authentication required.
- Avoid unnecessary dependencies.

The user should be able to install and use the app from the iPhone home screen.

---

## 13. Critical Edge Cases

The app must correctly handle:

1. A customer receives multiple services in one turn.
2. Two separate customers receive services at the same time or in one combined ticket.
3. A completed service has no tip.
4. A service has a tip but is excluded from commission.
5. Cash tips are already paid before payday.
6. Card tips are paid later.
7. A user edits a service from several weeks ago.
8. A commission rate changes in the future.
9. A user deletes a turn that affected an existing report.
10. A shift crosses midnight.
11. A user records an entry from a previous date.
12. A salon pays less than expected.
13. A salon pays more than expected.
14. Partial payments.
15. A payment covers more than one pay period.
16. A negative adjustment or commission correction.
17. A zero-dollar service.
18. A workday with zero customers.
19. No internet access.
20. The app is closed and reopened.
21. Restoring an old backup.
22. Malformed or incompatible backup files.
23. Duplicate entries after backup restoration.
24. A service price such as $19.99 with a non-integer percentage.
25. Date changes, daylight-saving transitions, and time zones.

**Rounding rule:** Use deterministic decimal arithmetic with integer cents as stored monetary values. Round each commission component to the nearest cent using half-up rounding; sum rounded components. Preserve decimal commission rates precisely rather than using binary floating-point calculations.

---

## 14. Acceptance Criteria

### Daily tracking

- A technician can enter a basic turn in 15 seconds or less after becoming familiar with the app.
- The saved turn appears immediately on Today.
- The dashboard recalculates without a refresh.
- Multiple services can belong to one turn.
- Editing or deleting an entry updates all relevant financial summaries.

### Earnings

- 60% of $100 produces $60 commission.
- $60 commission plus $10 cash tip and $15 card tip produces $85 earned.
- Cash tips already received are excluded from outstanding salon payments.
- A $40 payment shortage displays a $40 outstanding balance.
- Historical commission remains unchanged when the default rate changes.

### Localization

- All navigation and core financial terms have English and Vietnamese translations.
- Switching language does not affect stored financial data.
- The app preserves language selection after refresh.

### Persistence

- Data survives app reload and device restarts as long as browser storage remains intact.
- Offline entry is supported.
- JSON backup and restore round-trip without losing values.
- CSV export contains correct transaction values.

### User experience

- Mobile layout works at an iPhone-sized width of 375px.
- No horizontal overflow on primary screens.
- Buttons and fields are touch-friendly.
- Financial metrics are clear and legible.
- The app does not ask the user to create an account.

---

## 15. Reference Applications

The following applications were mentioned in the original conversation as inspiration.

### The Nail Ledger

App Store:
https://apps.apple.com/us/app/the-nail-ledger/id6799482492

Relevant ideas:
- Individual nail tech income tracking.
- Commission and tip entry.
- Earnings summaries.
- Vietnamese support.
- Free basic usage.

### NailPay Tracker

App Store:
https://apps.apple.com/us/app/nailpay-tracker/id6772872833

Relevant ideas:
- Individual service tracking.
- Commission percentages.
- Tip tracking.
- Vietnamese support.

### Nail Tech Income Tracker

Relevant ideas:
- Service and tip management.
- Commission calculations.
- Salon payout records.

### Nail Tech Payroll & Commission

Relevant ideas:
- Commission reporting.
- Payroll calculations.
- Income and deductions tracking.

### Alio / SimpliNail

These are salon-oriented systems. They can be used to understand industry terminology and turn management, but their employer-focused scope should not be copied.

**Reference disclaimer:** The app names, features, prices, and links above come from the earlier conversation and have not been independently verified for this specification. They are product research leads, not confirmed feature inventories.

The development team should not copy any proprietary designs, code, logos, or branded assets.

---

## 16. Development Plan

### Milestone 1 — Foundation

Build:
- React/TypeScript project.
- App structure.
- Design system.
- IndexedDB database.
- Type definitions.
- Localization.
- Routing.
- Settings persistence.

### Milestone 2 — Core Tracking

Build:
- Today dashboard.
- Add Turn form.
- Multi-service support.
- Edit and delete.
- Automatic calculations.
- Service presets.
- Transaction history.

### Milestone 3 — Earnings and Payday

Build:
- Date-filtered reports.
- Weekly and monthly earnings.
- Pay-period records.
- Payments.
- Outstanding balances.
- Tip reconciliation.

### Milestone 4 — Offline and Backup

Build:
- PWA installation.
- Offline support.
- JSON backup and restore.
- CSV export.
- Database migration support.

### Milestone 5 — Testing and Polish

- Calculation unit tests.
- Database persistence tests.
- Language checks.
- Backup/restore tests.
- Mobile UI tests.
- Accessibility checks.
- Performance optimization.
- Final bug fixes.

---

## 17. Definition of Done

The MVP is complete when:

- An individual nail technician can open the app without creating an account.
- Select Vietnamese or English.
- Configure a 60/40 or custom commission rate.
- Add several customer turns.
- Record service amounts, cash tips, and card tips.
- See accurate daily and weekly earned income.
- Review and edit transaction history.
- Check what the salon still owes at payday.
- Export and restore all data.
- Use the application offline on an iPhone.
- Use all essential features without a monthly subscription.

**Final product principle:** Prioritize speed, financial correctness, privacy, and simplicity over unnecessary features.
