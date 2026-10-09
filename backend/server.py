"""Sehat Saathi backend — medicine management + Gemini AI (chat & OCR)."""
import os
import uuid
import logging
import json
import re
from pathlib import Path
from datetime import datetime, date, timezone
from typing import Any

from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

app = FastAPI(title="Sehat Saathi API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sehat")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def strip_id(doc: dict | None) -> dict | None:
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc


# ---------- Models ----------
class UserProfile(BaseModel):
    device_key: str
    language: str = "en"
    voice_enabled: bool = True
    voice_speed: float = 1.0
    tracking_window_end_hour: int = 23  # end-of-day cutoff
    accessibility_large_text: bool = False
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class EmergencyContact(BaseModel):
    device_key: str
    name: str
    phone: str
    language: str = "en"
    consent: bool = False
    enabled: bool = True
    updated_at: str = Field(default_factory=now_iso)


class ScheduleVersion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    medicine_id: str
    dose_amount: str  # e.g. "1 tablet"
    dose_unit: str = "tablet"
    times: list[str]  # ["08:00","20:00"]
    start_date: str  # YYYY-MM-DD
    end_date: str | None = None
    food_instructions: str = ""
    notes: str = ""
    created_at: str = Field(default_factory=now_iso)


class Medicine(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_key: str
    name: str
    active_ingredient: str = ""
    strength: str = ""
    formulation: str = "tablet"  # tablet/capsule/syrup
    manufacturer: str = ""
    image_url: str = ""
    status: str = "active"  # active | paused | discontinued
    schedules: list[ScheduleVersion] = []
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class MedicineCreate(BaseModel):
    device_key: str
    name: str
    active_ingredient: str = ""
    strength: str = ""
    formulation: str = "tablet"
    manufacturer: str = ""
    image_url: str = ""
    dose_amount: str
    dose_unit: str = "tablet"
    times: list[str]
    start_date: str
    end_date: str | None = None
    food_instructions: str = ""
    notes: str = ""


class MedicineUpdate(BaseModel):
    name: str | None = None
    active_ingredient: str | None = None
    strength: str | None = None
    formulation: str | None = None
    manufacturer: str | None = None
    image_url: str | None = None
    status: str | None = None


class ScheduleUpdate(BaseModel):
    dose_amount: str
    dose_unit: str = "tablet"
    times: list[str]
    start_date: str
    end_date: str | None = None
    food_instructions: str = ""
    notes: str = ""


class DoseStatusUpdate(BaseModel):
    device_key: str
    medicine_id: str
    schedule_version_id: str
    scheduled_date: str  # YYYY-MM-DD
    scheduled_time: str  # HH:MM
    status: str  # taken | skipped | pending
    source: str = "ui"


class DailyNoteUpdate(BaseModel):
    device_key: str
    date: str
    notes: str


class ScanRequest(BaseModel):
    device_key: str
    image_base64: str
    mime_type: str = "image/jpeg"


class AssistantRequest(BaseModel):
    device_key: str
    message: str
    language: str = "en"
    session_id: str | None = None


# ---------- Helpers ----------
async def _get_schedule_for_date(medicine: dict, target: date) -> ScheduleVersion | None:
    """Return the ScheduleVersion effective on target date for a medicine."""
    best: dict | None = None
    for sv in medicine.get("schedules", []):
        start = datetime.strptime(sv["start_date"], "%Y-%m-%d").date()
        if start > target:
            continue
        if sv.get("end_date"):
            try:
                end = datetime.strptime(sv["end_date"], "%Y-%m-%d").date()
                if end < target:
                    continue
            except Exception:
                pass
        if best is None or sv["start_date"] > best["start_date"]:
            best = sv
    return ScheduleVersion(**best) if best else None


async def _scheduled_doses_for_date(device_key: str, target_date: str) -> list[dict]:
    target = datetime.strptime(target_date, "%Y-%m-%d").date()
    meds = await db.medicines.find({"device_key": device_key}).to_list(2000)
    out: list[dict] = []
    for m in meds:
        if m.get("status") == "discontinued":
            # still include history-only medicines when their schedule covered this date? Only if a dose event exists.
            continue
        sv = await _get_schedule_for_date(m, target)
        if not sv:
            continue
        if m.get("status") == "paused":
            continue
        for t in sv.times:
            dose_id = f"{m['id']}:{sv.id}:{target_date}:{t}"
            ev = await db.dose_events.find_one({"dose_id": dose_id})
            out.append({
                "dose_id": dose_id,
                "medicine_id": m["id"],
                "medicine_name": m["name"],
                "strength": m.get("strength", ""),
                "formulation": m.get("formulation", "tablet"),
                "schedule_version_id": sv.id,
                "dose_amount": sv.dose_amount,
                "dose_unit": sv.dose_unit,
                "food_instructions": sv.food_instructions,
                "scheduled_date": target_date,
                "scheduled_time": t,
                "status": (ev or {}).get("status", "pending"),
                "updated_at": (ev or {}).get("updated_at"),
            })
    # Also include dose events that reference medicines whose status is now discontinued (preserve history)
    out.sort(key=lambda d: d["scheduled_time"])
    return out


# ---------- Endpoints ----------
@api.get("/")
async def root():
    return {"app": "Sehat Saathi", "version": "1.0"}


@api.get("/profile/{device_key}")
async def get_profile(device_key: str):
    doc = await db.profiles.find_one({"device_key": device_key})
    if not doc:
        return None
    return strip_id(doc)


@api.post("/profile")
async def upsert_profile(payload: UserProfile):
    payload.updated_at = now_iso()
    await db.profiles.update_one(
        {"device_key": payload.device_key},
        {"$set": payload.dict()},
        upsert=True,
    )
    return payload.dict()


@api.get("/emergency-contact/{device_key}")
async def get_contact(device_key: str):
    return strip_id(await db.emergency.find_one({"device_key": device_key}))


@api.post("/emergency-contact")
async def set_contact(payload: EmergencyContact):
    payload.updated_at = now_iso()
    await db.emergency.update_one(
        {"device_key": payload.device_key},
        {"$set": payload.dict()},
        upsert=True,
    )
    return payload.dict()


@api.delete("/emergency-contact/{device_key}")
async def delete_contact(device_key: str):
    await db.emergency.delete_one({"device_key": device_key})
    return {"ok": True}


@api.get("/medicines")
async def list_medicines(device_key: str):
    rows = await db.medicines.find({"device_key": device_key}).to_list(500)
    return [strip_id(r) for r in rows]


@api.get("/medicines/{medicine_id}")
async def get_medicine(medicine_id: str):
    row = await db.medicines.find_one({"id": medicine_id})
    if not row:
        raise HTTPException(404)
    return strip_id(row)


@api.post("/medicines")
async def create_medicine(payload: MedicineCreate):
    sv = ScheduleVersion(
        medicine_id="pending",
        dose_amount=payload.dose_amount,
        dose_unit=payload.dose_unit,
        times=payload.times,
        start_date=payload.start_date,
        end_date=payload.end_date,
        food_instructions=payload.food_instructions,
        notes=payload.notes,
    )
    med = Medicine(
        device_key=payload.device_key,
        name=payload.name,
        active_ingredient=payload.active_ingredient,
        strength=payload.strength,
        formulation=payload.formulation,
        manufacturer=payload.manufacturer,
        image_url=payload.image_url,
        schedules=[sv],
    )
    sv.medicine_id = med.id
    med.schedules = [sv]
    doc = med.dict()
    await db.medicines.insert_one(doc)
    return strip_id(doc)


@api.patch("/medicines/{medicine_id}")
async def update_medicine(medicine_id: str, payload: MedicineUpdate):
    changes = {k: v for k, v in payload.dict().items() if v is not None}
    if not changes:
        return strip_id(await db.medicines.find_one({"id": medicine_id}))
    changes["updated_at"] = now_iso()
    await db.medicines.update_one({"id": medicine_id}, {"$set": changes})
    return strip_id(await db.medicines.find_one({"id": medicine_id}))


@api.post("/medicines/{medicine_id}/schedule")
async def add_schedule(medicine_id: str, payload: ScheduleUpdate):
    """Append a new ScheduleVersion — preserving historical versions."""
    med = await db.medicines.find_one({"id": medicine_id})
    if not med:
        raise HTTPException(404)
    sv = ScheduleVersion(medicine_id=medicine_id, **payload.dict())
    await db.medicines.update_one(
        {"id": medicine_id},
        {"$push": {"schedules": sv.dict()}, "$set": {"updated_at": now_iso()}},
    )
    return sv.dict()


@api.delete("/medicines/{medicine_id}")
async def discontinue_medicine(medicine_id: str):
    await db.medicines.update_one(
        {"id": medicine_id},
        {"$set": {"status": "discontinued", "updated_at": now_iso()}},
    )
    return {"ok": True}


@api.get("/scheduled-doses")
async def scheduled_doses(device_key: str, date: str):
    return await _scheduled_doses_for_date(device_key, date)


@api.post("/scheduled-doses/status")
async def set_dose_status(payload: DoseStatusUpdate):
    dose_id = f"{payload.medicine_id}:{payload.schedule_version_id}:{payload.scheduled_date}:{payload.scheduled_time}"
    prev = await db.dose_events.find_one({"dose_id": dose_id})
    prev_status = (prev or {}).get("status", "pending")
    event = {
        "id": str(uuid.uuid4()),
        "dose_id": dose_id,
        "device_key": payload.device_key,
        "medicine_id": payload.medicine_id,
        "schedule_version_id": payload.schedule_version_id,
        "scheduled_date": payload.scheduled_date,
        "scheduled_time": payload.scheduled_time,
        "status": payload.status,
        "prev_status": prev_status,
        "source": payload.source,
        "updated_at": now_iso(),
    }
    await db.dose_events.update_one(
        {"dose_id": dose_id}, {"$set": event}, upsert=True
    )
    # Append status change to audit log
    await db.dose_history.insert_one(
        {
            "id": str(uuid.uuid4()),
            "dose_id": dose_id,
            "prev_status": prev_status,
            "new_status": payload.status,
            "source": payload.source,
            "ts": now_iso(),
        }
    )
    return {"ok": True, "event": {k: v for k, v in event.items() if k != "_id"}}


@api.get("/calendar")
async def calendar(device_key: str, year: int, month: int):
    """Return per-date status for the given month."""
    from calendar import monthrange
    _, last = monthrange(year, month)
    today = date.today()
    profile = await db.profiles.find_one({"device_key": device_key}) or {}
    cutoff_hour = profile.get("tracking_window_end_hour", 23)

    out: list[dict] = []
    for d in range(1, last + 1):
        dstr = f"{year:04d}-{month:02d}-{d:02d}"
        doses = await _scheduled_doses_for_date(device_key, dstr)
        total = len(doses)
        if total == 0:
            out.append({"date": dstr, "status": "none", "total": 0, "taken": 0, "skipped": 0, "pending": 0})
            continue
        taken = sum(1 for x in doses if x["status"] == "taken")
        skipped = sum(1 for x in doses if x["status"] == "skipped")
        current = date(year, month, d)
        is_today = current == today
        is_future = current > today
        # cutoff logic for today
        if is_future:
            status = "pending"
        elif is_today:
            now_hour = datetime.now().hour
            if now_hour < cutoff_hour and (taken + skipped) < total:
                status = "pending" if taken == 0 else "partial"
            else:
                if taken == total:
                    status = "all_taken"
                elif taken > 0:
                    status = "partial"
                else:
                    status = "none_taken"
        else:
            if taken == total:
                status = "all_taken"
            elif taken > 0:
                status = "partial"
            else:
                status = "none_taken"
        out.append({"date": dstr, "status": status, "total": total, "taken": taken, "skipped": skipped, "pending": total - taken - skipped})
    return out


@api.get("/daily/{device_key}/{d}")
async def daily_record(device_key: str, d: str):
    doses = await _scheduled_doses_for_date(device_key, d)
    note_doc = await db.daily_notes.find_one({"device_key": device_key, "date": d})
    return {
        "date": d,
        "doses": doses,
        "notes": (note_doc or {}).get("notes", ""),
    }


@api.post("/daily/note")
async def set_daily_note(payload: DailyNoteUpdate):
    await db.daily_notes.update_one(
        {"device_key": payload.device_key, "date": payload.date},
        {"$set": {"device_key": payload.device_key, "date": payload.date, "notes": payload.notes, "updated_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True}


# ---------- Gemini integrations ----------
async def _run_gemini(system: str, user_text: str, image_b64: str | None = None, mime: str = "image/jpeg", session_id: str | None = None) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id or str(uuid.uuid4()),
        system_message=system,
    ).with_model("gemini", "gemini-3-flash-preview")
    kwargs: dict[str, Any] = {"text": user_text}
    if image_b64:
        kwargs["file_contents"] = [ImageContent(image_base64=image_b64)]
    msg = UserMessage(**kwargs)
    out = await chat.send_message(msg)
    return out


@api.post("/scan")
async def scan_medicine(payload: ScanRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "AI vision not configured.")
    system = (
        "You read medicine packaging. Extract ONLY what is clearly legible. "
        "Return STRICT JSON with keys: name, active_ingredient, strength, formulation, "
        "manufacturer, batch_or_expiry, instructions, raw_text, confidence (low|medium|high), "
        "uncertain_fields (array of field names). Use empty string for anything not legible. "
        "NEVER invent. If the image is not a medicine package or is unreadable set confidence='low' "
        "and leave fields empty. Only JSON, no prose."
    )
    try:
        raw = await _run_gemini(system, "Read this medicine packaging and return JSON only.", payload.image_base64, payload.mime_type)
    except Exception as e:
        logger.exception("Gemini scan failed")
        raise HTTPException(502, f"AI vision failed: {e}")
    # extract first JSON block
    m = re.search(r"\{.*\}", raw, re.S)
    try:
        parsed = json.loads(m.group(0)) if m else {"raw_text": raw, "confidence": "low"}
    except Exception:
        parsed = {"raw_text": raw, "confidence": "low"}
    scan_doc = {
        "id": str(uuid.uuid4()),
        "device_key": payload.device_key,
        "ts": now_iso(),
        "result": parsed,
    }
    await db.scans.insert_one(scan_doc.copy())
    scan_doc.pop("_id", None)
    # match against saved medicines
    name = (parsed.get("name") or "").strip().lower()
    match_id = None
    if name:
        meds = await db.medicines.find({"device_key": payload.device_key}).to_list(500)
        for m in meds:
            if name in m["name"].lower() or m["name"].lower() in name:
                match_id = m["id"]
                break
    scan_doc["possible_match_medicine_id"] = match_id
    return scan_doc


LANG_NAMES = {
    "as": "Assamese", "bn": "Bengali", "brx": "Bodo", "doi": "Dogri", "gu": "Gujarati",
    "hi": "Hindi", "kn": "Kannada", "ks": "Kashmiri", "kok": "Konkani", "mai": "Maithili",
    "ml": "Malayalam", "mni": "Manipuri", "mr": "Marathi", "ne": "Nepali", "or": "Odia",
    "pa": "Punjabi", "sa": "Sanskrit", "sat": "Santali", "sd": "Sindhi", "ta": "Tamil",
    "te": "Telugu", "ur": "Urdu", "en": "English",
}


@api.post("/assistant/chat")
async def assistant_chat(payload: AssistantRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(503, "AI assistant not configured.")
    today = date.today().isoformat()
    doses = await _scheduled_doses_for_date(payload.device_key, today)
    meds_summary = [
        {"name": d["medicine_name"], "time": d["scheduled_time"], "dose": d["dose_amount"],
         "status": d["status"], "instructions": d.get("food_instructions", "")}
        for d in doses
    ]
    contact = await db.emergency.find_one({"device_key": payload.device_key})

    lang_name = LANG_NAMES.get(payload.language, "English")
    system = (
        f"You are Sehat Saathi, a careful medicine-reminder assistant for Indian users. "
        f"REPLY IN {lang_name}. Never invent medicines, doses or times. Never prescribe or diagnose. "
        f"When unsure, ask the user to clarify. "
        f"Use ONLY the schedule JSON below. If empty, tell the user they have no scheduled medicines today. "
        f"Explain calendar colors honestly: green=all doses confirmed, yellow=partial confirmation, "
        f"coral=no dose confirmed by cutoff (not proof it was missed), grey=nothing scheduled. "
        f"Today's schedule JSON: {json.dumps(meds_summary, ensure_ascii=False)}\n"
        f"Emergency contact configured: {bool(contact and contact.get('consent'))}\n"
        f"Keep answers short, warm, under 80 words."
    )
    try:
        text = await _run_gemini(system, payload.message, session_id=payload.session_id or payload.device_key)
    except Exception as e:
        logger.exception("Gemini chat failed")
        raise HTTPException(502, f"AI assistant failed: {e}")
    # save chat history
    await db.chats.insert_one({
        "id": str(uuid.uuid4()),
        "device_key": payload.device_key,
        "ts": now_iso(),
        "user": payload.message,
        "assistant": text,
        "language": payload.language,
    })
    return {"text": text}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)


@app.on_event("shutdown")
async def _shutdown():
    client.close()
