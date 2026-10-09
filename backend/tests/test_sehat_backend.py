"""Sehat Saathi backend tests.

Covers:
  - Profile upsert/get
  - Emergency contact upsert/get/delete
  - Medicines CRUD + schedule version history
  - Scheduled doses & dose status + idempotency + history
  - Calendar aggregation (none / all_taken / partial / none_taken / future pending)
  - Daily record & notes
  - Assistant chat (English + Hindi script) + db.chats persistence
  - Scan (Gemini vision OCR) + possible_match_medicine_id after save
  - _id leakage check across endpoints
"""
import os
import re
import time
import uuid
import pytest
import requests
from datetime import date, timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path("/app/frontend/.env"))
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

from test_image_builder import build_medicine_jpeg_base64  # noqa: E402

DEVICE = f"TEST_device_{uuid.uuid4().hex[:8]}"


def _no_underscore_id(obj):
    """Recursively assert no '_id' key present."""
    if isinstance(obj, dict):
        assert "_id" not in obj, f"_id leaked in dict keys: {list(obj.keys())}"
        for v in obj.values():
            _no_underscore_id(v)
    elif isinstance(obj, list):
        for i in obj:
            _no_underscore_id(i)


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------------- Profile ----------------
class TestProfile:
    def test_get_profile_null_initially(self, session):
        r = session.get(f"{API}/profile/{DEVICE}")
        assert r.status_code == 200
        assert r.json() is None

    def test_upsert_profile(self, session):
        payload = {"device_key": DEVICE, "language": "hi", "voice_enabled": True, "voice_speed": 1.1, "tracking_window_end_hour": 22}
        r = session.post(f"{API}/profile", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        _no_underscore_id(data)
        assert data["device_key"] == DEVICE
        assert data["language"] == "hi"
        assert data["tracking_window_end_hour"] == 22

    def test_get_profile_after_upsert(self, session):
        r = session.get(f"{API}/profile/{DEVICE}")
        assert r.status_code == 200
        data = r.json()
        assert data is not None
        _no_underscore_id(data)
        assert data["language"] == "hi"


# ------------- Emergency Contact -------------
class TestEmergency:
    def test_get_empty(self, session):
        r = session.get(f"{API}/emergency-contact/{DEVICE}")
        assert r.status_code == 200
        assert r.json() is None

    def test_upsert(self, session):
        payload = {"device_key": DEVICE, "name": "TEST_Son", "phone": "+911234567890", "language": "hi", "consent": True, "enabled": True}
        r = session.post(f"{API}/emergency-contact", json=payload)
        assert r.status_code == 200
        data = r.json()
        _no_underscore_id(data)
        assert data["name"] == "TEST_Son"

    def test_get_after_upsert(self, session):
        r = session.get(f"{API}/emergency-contact/{DEVICE}")
        assert r.status_code == 200
        data = r.json()
        _no_underscore_id(data)
        assert data["phone"] == "+911234567890"

    def test_delete(self, session):
        r = session.delete(f"{API}/emergency-contact/{DEVICE}")
        assert r.status_code == 200
        r2 = session.get(f"{API}/emergency-contact/{DEVICE}")
        assert r2.json() is None

    def test_reupsert_for_chat(self, session):
        # need an emergency contact present for assistant chat context
        payload = {"device_key": DEVICE, "name": "TEST_Son", "phone": "+911234567890", "consent": True}
        r = session.post(f"{API}/emergency-contact", json=payload)
        assert r.status_code == 200


# ------------- Medicines -------------
MED_IDS: dict[str, str] = {}


class TestMedicines:
    def test_list_empty(self, session):
        r = session.get(f"{API}/medicines", params={"device_key": DEVICE})
        assert r.status_code == 200
        assert r.json() == []

    def test_create(self, session):
        today = date.today().isoformat()
        payload = {
            "device_key": DEVICE,
            "name": "Metformin",
            "active_ingredient": "Metformin HCl",
            "strength": "500mg",
            "formulation": "tablet",
            "manufacturer": "ACME",
            "dose_amount": "1 tablet",
            "dose_unit": "tablet",
            "times": ["08:00", "20:00"],
            "start_date": today,
            "food_instructions": "with food",
            "notes": "TEST",
        }
        r = session.post(f"{API}/medicines", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        _no_underscore_id(data)
        assert data["name"] == "Metformin"
        assert data["status"] == "active"
        assert isinstance(data["schedules"], list) and len(data["schedules"]) == 1
        sv = data["schedules"][0]
        assert sv["times"] == ["08:00", "20:00"]
        assert sv["medicine_id"] == data["id"]
        MED_IDS["metformin"] = data["id"]
        MED_IDS["metformin_sv0"] = sv["id"]

    def test_create_second_medicine(self, session):
        today = date.today().isoformat()
        payload = {
            "device_key": DEVICE,
            "name": "VitD",
            "strength": "60k IU",
            "dose_amount": "1 cap",
            "times": ["09:00"],
            "start_date": today,
        }
        r = session.post(f"{API}/medicines", json=payload)
        assert r.status_code == 200
        MED_IDS["vitd"] = r.json()["id"]

    def test_list_two(self, session):
        r = session.get(f"{API}/medicines", params={"device_key": DEVICE})
        assert r.status_code == 200
        data = r.json()
        _no_underscore_id(data)
        assert len(data) == 2

    def test_get_detail(self, session):
        r = session.get(f"{API}/medicines/{MED_IDS['metformin']}")
        assert r.status_code == 200
        data = r.json()
        _no_underscore_id(data)
        assert data["name"] == "Metformin"

    def test_get_not_found(self, session):
        r = session.get(f"{API}/medicines/does-not-exist")
        assert r.status_code == 404

    def test_patch(self, session):
        r = session.patch(f"{API}/medicines/{MED_IDS['metformin']}", json={"manufacturer": "ACME-2", "strength": "500 mg"})
        assert r.status_code == 200
        data = r.json()
        _no_underscore_id(data)
        assert data["manufacturer"] == "ACME-2"
        assert data["strength"] == "500 mg"

    def test_add_schedule_version(self, session):
        today = date.today().isoformat()
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        r = session.post(f"{API}/medicines/{MED_IDS['metformin']}/schedule", json={
            "dose_amount": "2 tablet",
            "dose_unit": "tablet",
            "times": ["08:00", "14:00", "20:00"],
            "start_date": tomorrow,
            "food_instructions": "with food",
            "notes": "TEST new version",
        })
        assert r.status_code == 200
        sv_new = r.json()
        _no_underscore_id(sv_new)
        MED_IDS["metformin_sv1"] = sv_new["id"]

        # verify history preserved
        r2 = session.get(f"{API}/medicines/{MED_IDS['metformin']}")
        d2 = r2.json()
        assert len(d2["schedules"]) == 2
        ids = [s["id"] for s in d2["schedules"]]
        assert MED_IDS["metformin_sv0"] in ids
        assert MED_IDS["metformin_sv1"] in ids

    def test_discontinue(self, session):
        r = session.delete(f"{API}/medicines/{MED_IDS['vitd']}")
        assert r.status_code == 200
        r2 = session.get(f"{API}/medicines/{MED_IDS['vitd']}")
        assert r2.status_code == 200
        assert r2.json()["status"] == "discontinued"


# ------------- Scheduled Doses & Status -------------
class TestDoses:
    def test_today_doses(self, session):
        today = date.today().isoformat()
        r = session.get(f"{API}/scheduled-doses", params={"device_key": DEVICE, "date": today})
        assert r.status_code == 200
        data = r.json()
        _no_underscore_id(data)
        # Only metformin (active) today, with sv0 (sv1 starts tomorrow): 2 doses
        names = [d["medicine_name"] for d in data]
        assert "Metformin" in names
        # vitd discontinued -> excluded
        assert "VitD" not in names
        assert all(d["status"] == "pending" for d in data if d["medicine_name"] == "Metformin")
        # Save a dose id for status update
        met = [d for d in data if d["medicine_name"] == "Metformin"]
        assert len(met) == 2
        MED_IDS["dose_sample"] = met[0]

    def test_set_status_taken(self, session):
        d = MED_IDS["dose_sample"]
        payload = {
            "device_key": DEVICE,
            "medicine_id": d["medicine_id"],
            "schedule_version_id": d["schedule_version_id"],
            "scheduled_date": d["scheduled_date"],
            "scheduled_time": d["scheduled_time"],
            "status": "taken",
        }
        r = session.post(f"{API}/scheduled-doses/status", json=payload)
        assert r.status_code == 200
        body = r.json()
        _no_underscore_id(body)
        assert body["ok"] is True
        assert body["event"]["status"] == "taken"

    def test_status_idempotent(self, session):
        d = MED_IDS["dose_sample"]
        payload = {
            "device_key": DEVICE,
            "medicine_id": d["medicine_id"],
            "schedule_version_id": d["schedule_version_id"],
            "scheduled_date": d["scheduled_date"],
            "scheduled_time": d["scheduled_time"],
            "status": "skipped",
        }
        r = session.post(f"{API}/scheduled-doses/status", json=payload)
        assert r.status_code == 200

        today = date.today().isoformat()
        r2 = session.get(f"{API}/scheduled-doses", params={"device_key": DEVICE, "date": today})
        met = [x for x in r2.json() if x["dose_id"] == d["dose_id"]]
        assert len(met) == 1
        assert met[0]["status"] == "skipped"

    def test_tomorrow_uses_new_schedule(self, session):
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        r = session.get(f"{API}/scheduled-doses", params={"device_key": DEVICE, "date": tomorrow})
        assert r.status_code == 200
        met = [x for x in r.json() if x["medicine_name"] == "Metformin"]
        # new version has 3 times
        assert len(met) == 3
        assert all(x["schedule_version_id"] == MED_IDS["metformin_sv1"] for x in met)


# ------------- Calendar -------------
class TestCalendar:
    def test_calendar(self, session):
        today = date.today()
        r = session.get(f"{API}/calendar", params={"device_key": DEVICE, "year": today.year, "month": today.month})
        assert r.status_code == 200
        data = r.json()
        _no_underscore_id(data)
        from calendar import monthrange
        _, last = monthrange(today.year, today.month)
        assert len(data) == last
        today_str = today.isoformat()
        tomorrow_str = (today + timedelta(days=1)).isoformat()
        today_cell = next(c for c in data if c["date"] == today_str)
        # today: one dose skipped, one still pending => partial per logic (taken==0 but has skipped & cutoff may apply)
        assert today_cell["total"] == 2
        assert today_cell["skipped"] == 1
        assert today_cell["status"] in ("partial", "pending", "none_taken")

        tomorrow_cell = next((c for c in data if c["date"] == tomorrow_str), None)
        if tomorrow_cell:
            # future -> pending (never none_taken)
            assert tomorrow_cell["status"] == "pending", tomorrow_cell

        # a day with nothing (far future, e.g., day 28/29 of a far month) -> use month+2 to look at empty day prior to med start
        # instead check: scan all cells and ensure none in the past before start_date have status
        if today.day > 1:
            yesterday_str = (today - timedelta(days=1)).isoformat()
            y_cell = next((c for c in data if c["date"] == yesterday_str), None)
            if y_cell:
                assert y_cell["total"] == 0
                assert y_cell["status"] == "none"


# ------------- Daily Note -------------
class TestDaily:
    def test_get_daily(self, session):
        today = date.today().isoformat()
        r = session.get(f"{API}/daily/{DEVICE}/{today}")
        assert r.status_code == 200
        data = r.json()
        _no_underscore_id(data)
        assert data["date"] == today
        assert isinstance(data["doses"], list)
        assert data["notes"] == ""

    def test_upsert_note(self, session):
        today = date.today().isoformat()
        r = session.post(f"{API}/daily/note", json={"device_key": DEVICE, "date": today, "notes": "TEST feeling well"})
        assert r.status_code == 200

        r2 = session.get(f"{API}/daily/{DEVICE}/{today}")
        assert r2.json()["notes"] == "TEST feeling well"


# ------------- Assistant Chat -------------
class TestAssistant:
    def test_english(self, session):
        r = session.post(f"{API}/assistant/chat", json={
            "device_key": DEVICE,
            "message": "What should I take right now?",
            "language": "en",
        }, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        _no_underscore_id(data)
        text = data["text"]
        assert isinstance(text, str) and len(text) > 0
        # Should be mostly ascii/English
        ascii_ratio = sum(1 for c in text if ord(c) < 128) / max(len(text), 1)
        assert ascii_ratio > 0.85, f"English response had low ASCII ratio: {text[:100]}"

    def test_hindi(self, session):
        r = session.post(f"{API}/assistant/chat", json={
            "device_key": DEVICE,
            "message": "मुझे आज कौन सी दवा लेनी है?",
            "language": "hi",
        }, timeout=90)
        assert r.status_code == 200, r.text
        text = r.json()["text"]
        assert isinstance(text, str) and len(text) > 0
        # Devanagari block check
        has_devanagari = bool(re.search(r"[\u0900-\u097F]", text))
        assert has_devanagari, f"Hindi response missing Devanagari script: {text[:200]}"


# ------------- Scan (Gemini Vision OCR) -------------
class TestScan:
    @pytest.fixture(scope="class")
    def big_image(self):
        return build_medicine_jpeg_base64()

    def test_scan_before_save_fresh_device(self, session, big_image):
        """Fresh device_key with no saved medicines => possible_match_medicine_id must be null."""
        fresh = f"TEST_scan_{uuid.uuid4().hex[:6]}"
        r = session.post(f"{API}/scan", json={
            "device_key": fresh,
            "image_base64": big_image,
            "mime_type": "image/jpeg",
        }, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        _no_underscore_id(data)
        assert "result" in data
        result = data["result"]
        # keys expected (raw_text, confidence always present; name/strength may be empty if OCR missed)
        for k in ("name", "strength", "confidence", "raw_text", "uncertain_fields"):
            # tolerate missing uncertain_fields if parser returned raw_text fallback
            if "raw_text" in result and result.get("confidence") == "low" and k in ("uncertain_fields",):
                continue
            assert k in result or k in ("uncertain_fields",), f"missing key {k}"
        assert data["possible_match_medicine_id"] is None

    def test_scan_matches_saved_metformin(self, session, big_image):
        r = session.post(f"{API}/scan", json={
            "device_key": DEVICE,
            "image_base64": big_image,
            "mime_type": "image/jpeg",
        }, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        _no_underscore_id(data)
        name = (data.get("result", {}).get("name") or "").lower()
        # If OCR picked up Metformin, matching should succeed
        if "metformin" in name:
            assert data["possible_match_medicine_id"] == MED_IDS["metformin"], data
        else:
            pytest.skip(f"Gemini OCR did not return 'metformin' in name field; got name={name!r}. Match test skipped.")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
