# Sehat Saathi — PRD

**Tagline:** Dawaiyon ki yaad, har din saath

Senior-friendly multilingual medicine reminder & management app for Indian users. React Native (Expo) frontend + FastAPI (MongoDB) backend.

## MVP Scope (shipped)
- Onboarding flow: Welcome → Language (22 Eighth-Schedule languages, native scripts) → Voice preference → Notifications permission → Optional emergency contact.
- Hindi + English full UI translation. Other 20 languages render in selector with native script and gracefully fall back where strings aren't translated.
- Bottom-tab shell: Home, Medicines, Calendar, Assistant.
- Home dashboard: greeting, Next Medicine gradient card (peach), Today's schedule progress, quick actions (Scan, Add, Settings).
- Medicines: list, add, edit (new schedule version preserves history), discontinue.
- Monthly gradient calendar: calendar_green / yellow / coral / grey + sky-blue "today" outline, legend. Status computed from individual scheduled doses, not medicine count. Pending future dates stay neutral.
- Daily record: per-date doses, correct status (taken/skipped/pending reset), optional health notes.
- AI Voice Assistant (Gemini 3 Flash via Emergent universal key): language-aware chat using actual saved schedule data; refuses to invent medicines or doses. Quick prompts seeded in Hindi/English.
- Scan Medicine: real camera / gallery via `expo-image-picker` → Gemini Vision OCR. Returns name, strength, formulation, manufacturer, instructions, confidence, uncertain_fields. User reviews + confirms before saving; prefills Add Medicine form.
- Settings: language switcher, voice toggle, emergency contact (consent-based), privacy screen.
- Data model with MongoDB: UserProfile, Medicine, ScheduleVersion (append-only history), DoseEvent + DoseHistory (audit), DailyNote, EmergencyContact, MedicineScan, Chat.
- All data persisted; `_id` stripped on every response.

## Known honest limitations
- Scheduled OS notifications: `expo-notifications` installed and permission requested, but the per-dose scheduling job isn't wired yet (local reminders will arrive only when added in next iteration). In-app reminders & manual confirmation work today.
- Only Hindi + English UI strings fully translated. The other 20 languages are listed with native labels and marked "limited"; AI assistant does reply in all 22 since Gemini handles them.
- Voice TTS/STT not implemented in this iteration — assistant works via text input (large touch targets).
- Emergency alert generation (end-of-day no-dose detection + outbound notification) stores the contact and consent but background delivery service isn't wired; honest adherence copy is in place.

## Testing
- Backend: 28/28 tests passed (profile, medicines, schedule history, dose status + audit, calendar, daily, emergency contact, Gemini chat EN+HI, Gemini Vision OCR + matching).
- Frontend: smoke-tested — onboarding flow end-to-end renders correctly in Hindi.

## Credentials
- Local device key auto-generated per install (AsyncStorage).
- `EMERGENT_LLM_KEY` in `/app/backend/.env` powers Gemini 3 Flash chat & vision.
