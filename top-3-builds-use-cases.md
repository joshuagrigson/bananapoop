# Top 3 AI Builds + 10 Use Cases Each — September 2026

Boiled down from `top-10-ai-builds.md`.

**How the ten collapse to three:**
- #4 (show-rate engine) and #8 (invoice chasing) merge into #3. All three are the same product: an AI that makes the calls a business forgets to make.
- #5, #6, #7, #9 and #10 drop out. Each is a standalone service in a field where Joshua has no head start, and each had lower odds.

**The three are one company.** All three sell to the same buyer, any business that makes money on the phone, and they cover three stages of the same call:
1. **Reach.** Does the call connect? (Contact-Rate Engine)
2. **Talk.** Was the call good? (Call Intelligence)
3. **Show.** Does the appointment happen, and does the invoice get paid? (AI Front Office)

One sales motion sells all three.

**Counter-case:** all three depend on the phone channel. If FCC or carrier rules tighten on AI voice or call labeling, all three get hit at once. If you want a spread instead, swap in the Texas property-tax engine (#5). It's the best play that doesn't depend on phones.

**Legend:** ✅ already built · 🔧 partly built / needs fixes · 🆕 new build

---

## 1. Call Intelligence: AI call grading + coaching for 10–200-seat centers

**Why it's here:** enterprise tools lock this segment out. Observe.AI runs about $60–180K a year per 100 seats, with 100-seat minimums.

**Already built:** Whisper transcription, rubric grading, coaching docs, weekly KPI review.

**Fix before selling:**
- Keep speaker labels and timestamps. Whisper already returns the segments, and the code throws them away.
- Calculate points in code instead of trusting the AI's arithmetic.
- Grade from the call date, not the grading day.
- Check that the agent named in the call header matches the agent being graded.

**Price anchor:** $40–80 per seat per month. Example: 30 centers × 50 seats × $60 = **$1.08M ARR**.

1. **Grade every call, not a sample.** Every call is scored against the rubric, with the quote and timestamp for each miss. 🔧 (needs speaker labels)
2. **Show-rate behavior scoring tied to outcomes.** Score the behaviors that predict an appointment actually happening: confirmation set, a specific time, both decision-makers present. Then measure which of them really predict shows. Today those behaviors can cost an agent at most 5 of 110 points, while no-shows cost about $55K in 35 days. 🔧
3. **Coaching cards with follow-through.** One main behavior and one secondary, with a practice drill built from the customer's own words. It checks whether last week's focus stuck, and it's kept separate from the disciplinary form. 🔧
4. **New-hire ramp scorecard.** Grade every call in weeks 1–4 and show who is ready for live leads. The results feed the tier gates in the 6-tier pay scale. 🔧
5. **Compliance disclosure monitoring.** Flag every call that misses a required statement: recording disclosure, honoring an opt-out, the debt-collector disclosure for collectors. The first buyers are collections, insurance and lending floors, where FDCPA suits hit 4,534 in 2025. 🆕 (rubric pack)
6. **Lead-source quality audit.** Tag every call by vendor or list, and show which sources produce real conversations and which produce junk. That's ammunition for vendor refunds. 🆕
7. **"Did they ask for the booking?" for inbound desks.** For dental, med spa, vet and HVAC dispatch front desks. 55% of home-services businesses never ask for the booking. 🆕 (rubric pack)
8. **Objection and rebuttal mining.** Group objections across all calls and rank the rebuttals that led to shows, then feed the winners back into the script. 🔧 (needs the outcome data)
9. **Multi-site calibration.** When a supervisor disputes a deduction, the ruling is stored as a rule, so two centers are graded the same way. Your North and South centers are the proof case. 🔧
10. **AI roleplay practice.** Before the next shift, the agent rehearses against an AI customer built from real objections they fumbled. 🆕

---

## 2. Contact-Rate Engine: catching and fixing "Spam Likely" flags before they cost you

**Why it's here:**
- 86% of calls from unknown numbers go unanswered.
- At Numeracle, businesses seeking protection rose 46% and remediations 44% in 2025, and flags return after removal.
- Each major carrier's labels come from a different opaque engine, and there's no single place to appeal.

**Already built:** the DID Dashboard, v6.28.0, with the early-warning radar, a two-axis spam grade, the swap guard and the buy list.

**Price anchor:** $300–2,000/month per center. Market range $250–8,000/month (unverified); First Orion's enterprise minimum is $1,200/month.

1. **Catch it before the flag.** Eight early signals fire before a carrier labels a number: a number dropping alone while its area code holds, projected time to damage, slipping answer rate, losing streaks, volume surges, rising DNC hits, new numbers falling, and stale scans. Rotate the number out before the label lands. ✅
2. **Don't burn good numbers.** Area-wave detection spots when most numbers in an area code drop together. That means the cause is the list, the calling hours or the carrier, not the numbers. The swap guard then blocks pointless number purchases. ✅
3. **Remediation desk.** File removal requests with each carrier's labeling engine and the Free Caller Registry, then watch for flags coming back (remediations rose 44%). 🆕
4. **Branded caller ID management.** Put the business name and logo on the healthiest numbers and measure the answer-rate lift. Vendors claim about 80%; that's unverified. 🆕 (reseller or partner)
5. **Smart number buying.** Which area codes to buy, and how many, based on how local numbers actually perform. 🔧 (the buy-list board exists)
6. **Volume governor.** Cap calls per number per day to stay under the carrier's surge triggers. The surge signal already exists; turning it into an automatic cap does not. 🔧
7. **Compliance guard module.**
   - DNC and opt-out tracking.
   - The FCC "revoke-all" opt-out rule, arriving 1/31/27.
   - State calling-hour windows.
   - The 7-calls-in-7-days cap for collectors (Reg F).
   - Context: 2,810 TCPA suits in 2025. 🆕
8. **Collections agencies.** Reg F caps how often they can call, so every attempt has to connect. Contact rate is their revenue. (vertical)
9. **White-label reporting for outsourced call centers (BPOs).** They show each client the health of the numbers dialing on its behalf, as a monthly reputation report card. (vertical)
10. **Businesses that must be answered.** Clinics and pharmacies returning results, schools, and home-services firms returning inbound leads. A "Spam Likely" label on the callback kills the lead or the patient contact. (vertical)

---

## 3. AI Front Office: the calls a business forgets to make

Absorbs the show-rate engine (#4) and the invoice chaser (#8). The fastest proof is inside a business you own: last list's HVAC buy has a median owner income of $315K, and every use case below raises it.

**Legal:** AI voices count as "artificial" under TCPA (FCC 24-17). Call only people who booked, submitted a form, or otherwise consented. Promotional calls with an AI voice need written consent. The revoke-all opt-out rule arrives 1/31/27.

**Price anchor:** pay per result: per appointment that shows, per booked job, or a percentage of money collected.

1. **Booking confirmation sequence.** A text at booking, then a call or text 24 hours out. Your own data: when confirmation stopped, no-shows went from 21.5% to 30.1%. Confirmation saved about 1 in 12 booked tours, and a new tour costs about 60 dialed leads. 🆕 (spec'd 09-16)
2. **No-show rescue.** Call within 15 minutes of a missed appointment and rebook it within the week. 🆕
3. **Cancellation backfill.** When a slot opens, call or text the waitlist until it's filled. Randi's Square booking worker already has read and write access to appointments. 🔧
4. **Missed-call and after-hours answering that books the job.** 28% of business calls go unanswered, and only 52% of home-services callers reach a person. 🆕
5. **60-second speed-to-lead on web forms.** Call new web leads, who gave consent on the form, within a minute. 63.5% of B2B companies never answered a demo request (2024 study). 🆕
6. **Unsigned-estimate follow-up.** HVAC, roofing and remodel quotes get a call on day 2, day 5 and day 10 until they're signed or dead. 🆕
7. **Maintenance and renewal reminders.** Tune-ups, quarterly pest service, septic pumping, filter changes, to consented past customers. 🆕
8. **Membership save calls.** Call before a membership lapses (clubs, service plans, gyms). This is your company's own model. 🆕
9. **B2B invoice chasing, voice plus email.** 59% of small businesses have invoices over 30 days late, averaging $17.7K. The consumer debt-collection laws (FDCPA, Reg F) don't apply to a business collecting from another business. Today's tools are email-only. 🆕
10. **Review request after the job.** A text after the job with the Google review link. Cheap, and it compounds local rankings. 🆕

---

## Confidence

- **Target:** the 3 builds with the highest odds-weighted money, and the use cases that sell them.
- **Strong:** your own show-rate data; demand for spam-flag fixes; mid-market centers locked out of QA by vendor minimums.
- **Medium:** the Invoca, CallRail and QuickBooks figures (vendor-published studies).
- **Weak:** vendor claims on branded-calling lift; pricing ranges marked unverified.
- **Still open:** whether native AI QA from dialers (Convoso, Five9) squeezes #1.
- **Load-bearing weakest claim:** that a two-person vendor can sell to mid-size centers before the dialers bundle QA.
- **What the answer comes down to:** sell #2 first. It's the most finished and has the fewest well-funded competitors. Then use it to open doors for #1 and #3.
- **Open question:** whether you own the coaching platform and DID Dashboard IP, or your employer does. That decides whether you sell these builds or rebuild clean.

## Sources

- Observe.AI pricing: https://www.cloudtalk.io/blog/observe-ai-pricing/
- Hiya State of the Call: https://www.hiya.com/state-of-the-call
- Numeracle 2025: https://www.numeracle.com/press-releases/2025-remediation-case-study
- First Orion pricing: https://firstorion.com/inform-pricing
- WebRecon 2025 (TCPA/FDCPA suits): https://webrecon.com/litigation-statistics/webrecon-dec-2025-stats-year-in-review
- Revoke-all delay to 1/31/27: https://www.burr.com/telephone-consumer-protection-act/the-fcc-delays-effective-date-of-tcpa-revoke-all-rule-until-january-31-2027
- FCC AI-voice ruling: https://docs.fcc.gov/public/attachments/FCC-24-17A1.pdf
- Reg F call caps: https://www.tcn.com/regulation-f-guide/
- CallRail unanswered calls: https://www.prnewswire.com/news-releases/callrail-opens-voice-assist-to-every-business-now-with-contextual-ai-texting-302835822.html
- Invoca home services 2026: https://www.invoca.com/reports/the-invoca-home-services-lead-conversion-benchmarks-report-2026
- Speed-to-lead: https://www.revenuehero.io/blog/speed-to-lead
- QuickBooks late payments: https://quickbooks.intuit.com/r/small-business-data/small-business-late-payments-report-2026/
- Hiya branded-call lift [vendor claim]: https://blog.hiya.com/branded-call
- BizBuySell HVAC: https://www.bizbuysell.com/learning-center/valuation-benchmarks/hvac/
- Internal: Brain [DECISIONS] 2026-09-16 show-rate root cause; [ANALYSIS] 2026-09-25 coaching audit; [BUILD] 2026-09-25 DID Dashboard v6.28.0
