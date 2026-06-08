# Changelog - CHANGELOG.md

All major updates, structural shifts, design milestones, and implementation details for the Hintro Meeting Intelligence Service are logged here.

---

## 🚀 [1.2.0] - 2026-06-08 (Premium Frontend & QA)
* **Unified 401 Interceptor**: Integrated dynamic credentials interception inside `App.jsx`. If any API request fails with a `401 Unauthorized` status (due to secret key updates or DB refreshes), browser storage is cleared, and the user is redirected to the login gate.
* **State-Controlled Avatar**: Replaced CSS `:hover` profile menus with a dynamic initials-based circular badge (`isProfileOpen`) and backdrop overlays to support clicking outside to close.
* **Follow-ups Formatting**: Adjusted state keys and tab labels to `'follow ups'` (with a space). Enhanced fallback keywords parser to return multiple interactive items from default transcripts.
* **SEO & Automated QA**: Integrated custom IDs (`auth-email-input`, `nav-dashboard-btn`, etc.) for browser testing and updated header elements to correct hierarchy `<h1>` elements.

---

## 🎨 [1.1.0] - 2026-06-08 (Design System & Transitions)
* **Monochrome Fluid Canvas**: Configured off-white canvas backgrounds (`bg-neutral-50`) and white cards (`bg-white`) featuring thin borders and soft shadows.
* **Interactive Animations**: Defined keyframe transitions for entry fades (`fadeInUp`), upload drops (`gentleBounce`), lines highlighting (`flashPulse`), drawing checkmarks (`drawCheckmark`), and checklists text striking (`strike-text`).
* **Glassy Top Navigation Bar**: Built floating pill navigation menu bars equipped with gateway status lights and active selection transitions.
* **Predictive Metrics & SVG Sparklines**: Generated SVG path line charts for meetings stats and caution alerts for overdue tasks without utilizing red colors.
* **Tab-Specific Skeletons**: Designed gradient pulsing skeleton shapes for Summary, Actions, and Follow ups tabs.

---

## 🛠️ [1.0.0] - 2026-06-08 (Backend Foundation)
* **Integer Database Models**: Replaced UUID keys with auto-incrementing Integers for `User`, `Meeting`, and `ActionItem` models.
* **Passlib Migration**: Swapped `passlib` with native `bcrypt` cryptography to support Python 3.13 deprecation updates.
* **Gemini REST API**: Integrated direct asynchronous `httpx` connection endpoints calling Gemini 1.5 Flash with strict JSON output specifications.
* **Overdue Webhooks Scheduler**: Mounted background task routines checking for overdue deliverables and pushing rich cards to Discord and Slack webhook interfaces.
