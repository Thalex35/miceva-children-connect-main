# MICEVA Children Connect

Build a Private Full-Stack Children's Department Management System

Build a complete, production-quality full-stack web application for the Children's Department of Église MICEVA de Puits-Salés, Haiti.

This is NOT a public school-management platform and NOT a public registration website.

It is a private internal management system used by only two authorized users to manage information about the children and the Children's Department administration.

The application should be simple, fast, secure, mobile-first, and practical for real use at church.

1. Core purpose

The main purpose of the application is to replace the current paper-based children's register.

The current register contains 41 children for 2026.

The application must allow authorized users to:

View all children

Quickly search for a specific child

View a child's complete information

Find a parent's/guardian's phone number quickly

Add new children

Edit existing children

Mark incomplete information

Manage the Children's Department administration

Manage church activities and events

Create recurring activities such as weekly prayer meetings

See important statistics from the dashboard

The application should NOT contain unnecessary features such as grades, public student accounts, teacher accounts, payments, or a parent portal.

2. Technology and architecture

Build this as a genuine full-stack application.

Use:

React + TypeScript

Modern responsive UI

Tailwind CSS

A proper backend/database

Supabase or another secure PostgreSQL-backed solution if appropriate

Secure authentication

Row-level security / authorization rules

Server-side validation where appropriate

Proper relational database design

No sensitive credentials exposed in frontend source code

Environment variables for secrets

Production-ready structure

Do not create a fake frontend-only demo with localStorage as the primary database.

The data must persist in a real database.

3. Application name

Use:

MICEVA Children's Department

Subtitle:

Private Management System — 2026

The application is for:

Église MICEVA de Puits-Salés
Département des Enfants

Use a clean, professional, friendly visual identity appropriate for a church Children's Department.

Avoid childish cartoon-heavy design. The application should look professional because it manages real administrative information.

4. Authentication and privacy

This is a PRIVATE application.

There must be:

Login page

Logout

Session persistence

Protected routes

No public registration

No "Create Account" button

No public user signup

No anonymous access

No public child profiles

Only two authorized application users should initially exist.

Initial usernames:

Theed

Kinishama

Initial passwords:

TheoChild

JeyChild

IMPORTANT:

Do not expose these credentials anywhere in the frontend source code, public UI, API responses, database queries, or documentation.

Create the accounts securely using the backend/authentication system.

Treat these as initial credentials that can later be changed securely.

The application should have only a login screen before accessing the dashboard.

5. User permissions

There are only two application users.

User 1

Username:

Theed

Role:

Administrator / Manager

This user should have full access to:

Dashboard

Children

Add/edit/delete children

Administration

Calendar

Recurring activities

Events

Settings

User/session management if needed

User 2

Username:

Kinishama

Role:

Authorized Committee Member

This user should be able to:

View children

Search children

View child profiles

View parent/guardian contact information

Add/edit children if appropriate

View administration

View calendar

View events

View recurring activities

Keep permissions simple. Do not create a complicated multi-role system.

6. Main navigation

After login, show a clean dashboard with navigation:

Dashboard

Children

Administration

Calendar

Activities

Reports

Settings

On mobile, use a bottom navigation or responsive menu.

7. Dashboard

Create a useful dashboard.

Display cards such as:

Children

41 children

This should initially reflect the imported register.

Incomplete profiles

Show the number of children with missing information.

This number should be calculated dynamically.

Clicking it should show the children whose profiles need information.

Administration

4 committee members

Upcoming event

Show the next upcoming event.

Next recurring activity

Example:

Sunday Prayer Meeting

or

Tuesday Prayer Meeting

Also show a small calendar/upcoming-events section.

The dashboard should prioritize information that is useful immediately.

8. Children database

Create a proper relational children table.

Each child should have fields such as:

id

first_name

last_name

full_name if useful

date_of_birth

age calculated dynamically from date_of_birth

gender

parent_guardian_name

parent_guardian_phone

second_parent_guardian_name

second_parent_guardian_phone

address

class_group

emergency_contact

emergency_phone

registration_date

notes

active_status

created_at

updated_at

created_by

updated_by

Do not store age as the authoritative value if date_of_birth exists.

Calculate the current age automatically.

If only an age is known and the date of birth is unavailable, allow the age to be displayed as an approximate/manual value until the date of birth is added.

9. Children page

Create a professional searchable table/card interface.

Each row/card should show:

Child name

Age

Class/group

Parent/guardian

Parent phone

Profile completeness

Include:

Search

Search by:

First name

Last name

Full name

Parent/guardian name

Parent phone

Search should be fast and case-insensitive.

Filters

Allow filtering by:

Age

Gender

Class/group

Active/inactive

Complete/incomplete profile

Sorting

Allow sorting by:

Name

Age

Registration date

10. Child profile

Clicking a child should open a detailed profile.

Example layout:

Jean Prisdarlens

Personal Information

Date of birth

Age

Gender

Address

Class/group

Parent / Guardian

Name

Phone

Second guardian

Second phone

Emergency Contact

Name

Phone

Department Information

Registration date

Status

Notes

Provide buttons:

Edit

Delete

Back

Call parent

On mobile, the parent phone number should be clickable and use the tel: functionality so the authorized user can call the parent directly.

11. Profile completeness

Create automatic profile completeness checking.

A profile should be considered incomplete if important fields are missing.

For example:

Date of birth

Parent/guardian name

Parent/guardian phone

Address

Class/group

Do not require every field because some information may genuinely be unavailable.

Display something like:

Profile: 60% complete

or:

Missing: Parent phone, Address

Allow the user to click "Complete Profile" and immediately edit the missing fields.

12. Adding children

Create an "Add Child" form.

The form should validate:

Required name

Valid phone format

Valid date

Reasonable date of birth

No accidental duplicate child records

Before saving, warn if another child appears to have the same name/date of birth.

Do not automatically delete or merge possible duplicates.

Let the authorized user decide.

13. Administration section

The Children's Department currently has these committee members:

Theodore Louisjuste

Role:
Management / Coordinator

Daphca Vilbrun

Role:
Secretary

Andy Vilbrun

Role:
Disciplinary

Rosena Silin

Role:
Principal

Create an administration_members table.

Fields:

id

name

role

phone

email

address

responsibilities

notes

active

created_at

updated_at

Some information is currently unavailable, so do NOT invent phone numbers, emails, addresses, or responsibilities.

Allow authorized users to complete these fields later.

The Administration page should display the members as clean cards.

Each card can show:

Name

Position

Phone

Email

Responsibilities

Phone numbers should be clickable on mobile.

14. Calendar

Create a full calendar system.

Users should be able to:

Create events

Edit events

Delete events

View events

View daily/weekly/monthly calendar

See upcoming events

Each event should have:

Title

Description

Date

Start time

End time

Location

Responsible person

Event type

Recurrence

Notes

Examples:

Children's Event

Christmas Program

Department Meeting

Children's Department Meeting

Prayer

Prayer Meeting

15. Recurring activities

This is an important feature.

Allow the user to create recurring activities.

Examples:

Sunday Prayer

Every Sunday

Time: configurable

Location: Church

Category: Prayer

Tuesday Prayer

Every Tuesday

Time: configurable

Location: Church

Category: Prayer

The recurrence system should support:

None

Daily

Weekly

Monthly

Custom weekly recurrence

The calendar should automatically display future occurrences without requiring the user to manually create every occurrence.

The user should be able to edit the recurring series or a single occurrence.

16. Activities page

Create a dedicated page showing recurring activities.

Each activity card should show:

Activity name

Day

Time

Location

Responsible person

Recurrence

Active/inactive status

Actions:

Create

Edit

Pause

Delete

17. Reports

Create a simple Reports section.

Reports should include:

Children report

List all children with:

Name

Age

Date of birth

Parent

Parent phone

Class/group

Status

Children by age

Show how many children belong to each age group.

Children by class

Show how many children belong to each class/group.

Incomplete profiles

Show children with missing important information.

Administration report

List the current committee members and their roles.

Allow export where practical:

CSV

Excel

PDF

Do not make reporting overly complicated.

18. Audit history

Because two people will use the system, create a simple activity/audit log.

Record important actions such as:

Child created

Child updated

Child deleted

Administration member updated

Event created

Event updated

Event deleted

Record:

User

Action

Entity

Timestamp

Example:

"Theed updated Jean Prisdarlens — Parent phone"

This should be accessible from Settings or a simple Activity Log page.

19. Data security

This application contains sensitive information about children.

Implement appropriate security:

Authentication required

Protected database access

Row-level security where supported

Authorization checks

Secure password handling

No passwords stored as plain text

No sensitive information in client-side environment variables

No public API endpoints exposing children

No public child URLs that reveal private information

HTTPS-ready deployment

Secure session handling

Automatic logout/session expiration where appropriate

Do not expose private children's information to search engines.

Add noindex behavior where applicable.

20. Data import

Import the existing 2026 children's register into the database.

There are currently:

41 registered children

The original register is alphabetically ordered by surname.

Use the information exactly as provided.

Do NOT invent missing information.

Where the source has:

—

NA

blank fields

incomplete values

store them as NULL/missing values and display:

Not provided

The initial dataset includes children such as:

Benoit Jackson Fils — 20/01/2014 — age 12 — parent phone 37 93 15 75

Benoit Jackson Ley — 11/12/2023 — age 2

Bis Kervens Rondellyson — missing information

Delva James — 05/06/2013 — age 12

Dévine Guerson — 20/01/2015 — age 11

Doryson Joseph — 01/10/2015 — age 11

Dumé Anne Darlie Julia — 26/06/2015 — age 11 — parent phone 34 10 32 39

Exilus Alexandelle — 04/12/2014 — age 11

Ferjus Charnia — 10/05/2017 — age 9 — parent phone 31 46 80 55

Ferjus Charnison — 10/05/2017 — age 9 — parent phone 31 46 80 55

Ferjus Fredena — 24/03/2014 — age 12 — parent phone 31 46 80 55

François Naïssa — 03/06/2016

François Watson — 06/10/2015 — age 11 — parent phone 46 18 06 23

Continue importing ALL 41 children from the supplied register.

Do not omit the children whose information is incomplete.

Important: preserve names exactly as they appear in the register, including accents and hyphens.

The source register states that the total number registered is 41 children and that missing fields need to be completed.

21. Database relationships

Use a clean relational schema.

Suggested tables:

users

id

username

role

created_at

updated_at

Use the authentication provider's secure user ID as the relationship key.

children

id

first_name

last_name

date_of_birth

manual_age_if_needed

gender

address

class_group

registration_date

status

notes

created_by

updated_by

timestamps

guardians

Instead of putting all parent information directly into the child table, preferably create:

id

child_id

name

relationship

phone

email

address

is_primary

notes

This allows a child to have multiple guardians.

administration_members

id

name

role

phone

email

address

responsibilities

notes

active

timestamps

events

id

title

description

start_datetime

end_datetime

location

responsible_person

event_type

recurrence_rule

notes

created_by

timestamps

audit_logs

id

user_id

action

entity_type

entity_id

description

created_at

Use proper foreign keys and indexes.

Create indexes for common searches such as child names and guardian phone numbers.

22. UI/UX

Make the application:

Responsive

Mobile-first

Fast

Clean

Professional

Accessible

Easy to understand

Use a modern dashboard style.

Suggested structure:

Desktop

Sidebar:

MICEVA Children's Department

Dashboard

Children

Administration

Calendar

Activities

Reports

Settings

Logout

Mobile

Use a compact navigation system with the most important items easily accessible.

The Children search should be especially easy to reach.

23. Important UX principle

Optimize the application around the most common real-world scenario:

A committee member is at church.

Someone asks:

"Do you have Jean Prisdarlens' information?"

The user opens the app.

Searches:

Jean Prisdarlens

Immediately sees:

Jean Prisdarlens
Age: 12
Parent: ...
Phone: 36 16 34 16

Then taps the phone number and calls.

This entire process should be extremely fast.

24. Empty states and errors

Do not show technical errors to normal users.

Use friendly messages:

"No children found."

"No upcoming events."

"This profile is missing some information."

"Child successfully added."

"Changes saved."

Handle:

Network errors

Validation errors

Duplicate warnings

Unauthorized access

Expired sessions

25. Settings

Settings should contain only useful administrative options.

Include:

Current logged-in user

Change password

Logout

Activity log

Application information

Do NOT provide public registration.

26. Important constraints

Do NOT add:

Public registration

Public child profiles

Student accounts

Parent accounts

Teacher accounts

Grades

Tuition/payment management

Online classes

Public messaging

Social network functionality

Unnecessary AI features

Keep the application focused.

27. Seed/demo data

Do not use fake children instead of the supplied register.

Use the actual 41 children from the provided 2026 register.

For information that is missing, use NULL and display "Not provided".

For events and recurring activities, it is acceptable to create a few initial examples such as:

Sunday Prayer

Tuesday Prayer

But make these editable so the committee can change the exact times and locations.

28. Production readiness

Before considering the project complete:

Create the database schema.

Create migrations.

Configure authentication.

Configure secure authorization.

Seed the 41 children.

Seed the 4 administration members.

Create the two authorized accounts.

Implement all CRUD operations.

Implement search and filters.

Implement calendar.

Implement recurring activities.

Implement dashboard statistics.

Implement reports.

Implement audit logging.

Make the application responsive.

Test authentication.

Test unauthorized access.

Test adding/editing/deleting children.

Test search.

Test recurring events.

Test mobile layout.

Check for console errors.

Check database security policies.

Ensure no sensitive credentials are exposed in frontend code.

Do not stop at a visual prototype.

I want a working full-stack application with a real database, real authentication, real CRUD operations, and persistent data.

29. Final quality requirement

The final result should feel like a small professional internal application that a real Children's Department could use every Sunday.

Prioritize:

Security → Simplicity → Speed → Reliability → Mobile usability → Clean design

Do not over-engineer the application.

Build the complete first version, then show me what was implemented and identify anything that requires configuration such as database credentials or deployment environment variables.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/78e5741b-c2a7-44e1-b297-df2a516b64a4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
