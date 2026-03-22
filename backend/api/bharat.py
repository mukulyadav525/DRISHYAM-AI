from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from core.database import get_db
from models.database import CrimeReport, NotificationLog
import uuid
import logging
import datetime

logger = logging.getLogger("drishyam.bharat")

router = APIRouter()


class ComprehensiveBharatReportRequest(BaseModel):
    reporter_num: str | None = None
    category: str | None = None
    scam_type: str | None = None
    amount: str | None = None
    platform: str | None = None
    description: str | None = None
    channel: str | None = None
    lang: str | None = None
    region: str | None = None
    bank_name: str | None = None
    impersonated_name: str | None = None
    id_type: str | None = None
    leak_location: str | None = None
    handle_link: str | None = None
    utr_id: str | None = None
    fake_handle: str | None = None
    pii_details: str | None = None
    scam_link: str | None = None

REGION_DIRECTORY = {
    "north": {"name": "North India (Haryana/Punjab)", "short_name": "North Grid"},
    "east": {"name": "East India (Bihar/WB/Odisha)", "short_name": "East Grid"},
    "west": {"name": "West India (Rajasthan/Gujarat)", "short_name": "West Grid"},
    "south": {"name": "South India (Karnataka/TN/AP)", "short_name": "South Grid"},
}

LANGUAGE_PACKS = {
    "hi": {
        "name": "Hindi",
        "script": "Devanagari",
        "regions": ["north", "west"],
        "channels": ["USSD", "IVR", "SMS"],
        "greeting": "DRISHYAM 1930 Helpline mein aapka swagat hai.",
        "menu": "1. Scam report karein\n2. Case status jaanein\n3. Suraksha salaah sunen",
        "report_success": "Aapki report darj kar li gayi hai. Case ID: {case_id}",
        "ivr_steps": [
            "Dhanyavaad. Scam ki shreni chunne ke liye 1 dabayein.",
            "Nuksaan ya payment jaankari record karne ke liye 2 dabayein.",
            "Verification SMS turant bheja jayega.",
        ],
        "low_literacy_prompt": "Agar padhna mushkil ho, line par bane rahein. Agla nirdesh awaaz mein diya jayega.",
    },
    "en": {
        "name": "English",
        "script": "Latin",
        "regions": ["north", "south", "west", "east"],
        "channels": ["USSD", "IVR", "SMS"],
        "greeting": "Welcome to the DRISHYAM 1930 Helpline.",
        "menu": "1. Report scam\n2. Check case status\n3. Hear safety tips",
        "report_success": "Your report has been logged. Case ID: {case_id}",
        "ivr_steps": [
            "Press 1 to report a scam category.",
            "Press 2 to record payment or account loss details.",
            "A verification SMS will be sent immediately.",
        ],
        "low_literacy_prompt": "Stay on the line for spoken prompts if reading the menu is difficult.",
    },
    "bn": {
        "name": "Bengali",
        "script": "Bengali",
        "regions": ["east"],
        "channels": ["USSD", "IVR", "SMS"],
        "greeting": "DRISHYAM 1930 হেল্পলাইনে স্বাগতম।",
        "menu": "1. প্রতারণার অভিযোগ করুন\n2. কেসের অবস্থা জানুন\n3. সুরক্ষা পরামর্শ শুনুন",
        "report_success": "আপনার অভিযোগ নথিভুক্ত হয়েছে। কেস আইডি: {case_id}",
        "ivr_steps": [
            "প্রতারণার ধরন জানাতে ১ চাপুন।",
            "টাকা বা লেনদেনের তথ্য রেকর্ড করতে ২ চাপুন।",
            "যাচাইয়ের এসএমএস এখনই পাঠানো হবে।",
        ],
        "low_literacy_prompt": "মেনু পড়তে অসুবিধা হলে লাইনে থাকুন, ভয়েস নির্দেশনা শোনানো হবে।",
    },
    "ta": {
        "name": "Tamil",
        "script": "Tamil",
        "regions": ["south"],
        "channels": ["USSD", "IVR", "SMS"],
        "greeting": "DRISHYAM 1930 உதவி வரிக்கு வரவேற்கிறோம்.",
        "menu": "1. மோசடியை புகாரளிக்கவும்\n2. வழக்கு நிலை பார்க்கவும்\n3. பாதுகாப்பு குறிப்புகள் கேட்கவும்",
        "report_success": "உங்கள் புகார் பதிவு செய்யப்பட்டது. வழக்கு எண்: {case_id}",
        "ivr_steps": [
            "மோசடி வகையை பதிவு செய்ய 1 அழுத்தவும்.",
            "பணம் அல்லது பரிவர்த்தனை விவரத்தை பதிவு செய்ய 2 அழுத்தவும்.",
            "சரிபார்ப்பு SMS உடனே அனுப்பப்படும்.",
        ],
        "low_literacy_prompt": "மெனுவை படிக்க முடியாவிட்டால் காத்திருக்கவும். அடுத்த வழிமுறை குரலில் வரும்.",
    },
    "te": {
        "name": "Telugu",
        "script": "Telugu",
        "regions": ["south"],
        "channels": ["USSD", "IVR", "SMS"],
        "greeting": "DRISHYAM 1930 హెల్ప్‌లైన్‌కు స్వాగతం.",
        "menu": "1. మోసం నివేదించండి\n2. కేసు స్థితి తెలుసుకోండి\n3. భద్రతా సూచనలు వినండి",
        "report_success": "మీ నివేదిక నమోదు అయింది. కేసు ID: {case_id}",
        "ivr_steps": [
            "మోసం రకాన్ని నమోదు చేయడానికి 1 నొక్కండి.",
            "నష్టం లేదా చెల్లింపు వివరాలకు 2 నొక్కండి.",
            "ధృవీకరణ SMS వెంటనే పంపబడుతుంది.",
        ],
        "low_literacy_prompt": "చదవడం కష్టమైతే కాల్‌లోనే ఉండండి. వాయిస్ సూచనలు వినిపిస్తాయి.",
    },
    "mr": {
        "name": "Marathi",
        "script": "Devanagari",
        "regions": ["west"],
        "channels": ["USSD", "IVR", "SMS"],
        "greeting": "DRISHYAM 1930 हेल्पलाईनमध्ये आपले स्वागत आहे.",
        "menu": "1. फसवणुकीची तक्रार करा\n2. केस स्थिती तपासा\n3. सुरक्षा सूचना ऐका",
        "report_success": "तुमची तक्रार नोंदवली गेली आहे. केस आयडी: {case_id}",
        "ivr_steps": [
            "फसवणुकीचा प्रकार नोंदवण्यासाठी 1 दाबा.",
            "नुकसान किंवा पेमेंट तपशीलासाठी 2 दाबा.",
            "तपासणी SMS लगेच पाठवला जाईल.",
        ],
        "low_literacy_prompt": "वाचणे कठीण असल्यास कॉलवरच रहा. पुढील सूचना आवाजात दिली जाईल.",
    },
    "pa": {
        "name": "Punjabi",
        "script": "Gurmukhi",
        "regions": ["north"],
        "channels": ["USSD", "IVR", "SMS"],
        "greeting": "DRISHYAM 1930 ਹੈਲਪਲਾਈਨ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ।",
        "menu": "1. ਠੱਗੀ ਦੀ ਰਿਪੋਰਟ ਕਰੋ\n2. ਕੇਸ ਦੀ ਸਥਿਤੀ ਵੇਖੋ\n3. ਸੁਰੱਖਿਆ ਸੁਝਾਅ ਸੁਣੋ",
        "report_success": "ਤੁਹਾਡੀ ਰਿਪੋਰਟ ਦਰਜ ਹੋ ਗਈ ਹੈ। ਕੇਸ ID: {case_id}",
        "ivr_steps": [
            "ਠੱਗੀ ਦੀ ਕਿਸਮ ਦਰਜ ਕਰਨ ਲਈ 1 ਦਬਾਓ।",
            "ਨੁਕਸਾਨ ਜਾਂ ਭੁਗਤਾਨ ਵੇਰਵੇ ਲਈ 2 ਦਬਾਓ।",
            "ਤਸਦੀਕ SMS ਤੁਰੰਤ ਭੇਜਿਆ ਜਾਵੇਗਾ।",
        ],
        "low_literacy_prompt": "ਜੇ ਪੜ੍ਹਨਾ ਔਖਾ ਹੈ ਤਾਂ ਲਾਈਨ ਤੇ ਬਣੇ ਰਹੋ। ਅਗਲੀ ਹਦਾਇਤ ਆਵਾਜ਼ ਵਿੱਚ ਆਏਗੀ।",
    },
    "or": {
        "name": "Odia",
        "script": "Odia",
        "regions": ["east"],
        "channels": ["USSD", "IVR", "SMS"],
        "greeting": "DRISHYAM 1930 ହେଲ୍ପଲାଇନକୁ ସ୍ୱାଗତ।",
        "menu": "1. ଠକେଇ ରିପୋର୍ଟ କରନ୍ତୁ\n2. କେସ୍ ସ୍ଥିତି ଜାଣନ୍ତୁ\n3. ସୁରକ୍ଷା ପରାମର୍ଶ ଶୁଣନ୍ତୁ",
        "report_success": "ଆପଣଙ୍କ ରିପୋର୍ଟ ଦାଖଲ ହୋଇଛି। କେସ୍ ID: {case_id}",
        "ivr_steps": [
            "ଠକେଇର ପ୍ରକାର ଦେବାକୁ 1 ଦବାନ୍ତୁ।",
            "ଟଙ୍କା କିମ୍ବା ଲେନଦେନ ବିବରଣୀ ପାଇଁ 2 ଦବାନ୍ତୁ।",
            "ଯାଞ୍ଚ SMS ତୁରନ୍ତ ପଠାଯିବ।",
        ],
        "low_literacy_prompt": "ପଢିବା କଷ୍ଟକର ହେଲେ ଲାଇନରେ ରୁହନ୍ତୁ। ଆଗକୁ ଧ୍ୱନି ନିର୍ଦ୍ଦେଶ ମିଳିବ।",
    },
}

SMS_TEMPLATES = {
    "case_registered": {
        "channel": "SMS",
        "translations": {
            "hi": "DRISHYAM 1930: Aapki report {case_id} darj ho gayi hai. Team aapse jaldi sampark karegi.",
            "en": "DRISHYAM 1930: Your report {case_id} is registered. Our team will contact you shortly.",
            "bn": "DRISHYAM 1930: আপনার রিপোর্ট {case_id} নথিভুক্ত হয়েছে। টিম শীঘ্রই যোগাযোগ করবে।",
            "ta": "DRISHYAM 1930: உங்கள் {case_id} பதிவு முடிந்தது. எங்கள் குழு விரைவில் தொடர்புகொள்ளும்.",
            "te": "DRISHYAM 1930: మీ {case_id} నివేదిక నమోదు అయింది. బృందం త్వరలో సంప్రదిస్తుంది.",
            "mr": "DRISHYAM 1930: तुमची {case_id} तक्रार नोंद झाली आहे. टीम लवकर संपर्क करेल.",
            "pa": "DRISHYAM 1930: ਤੁਹਾਡੀ ਰਿਪੋਰਟ {case_id} ਦਰਜ ਹੋ ਗਈ ਹੈ। ਟੀਮ ਜਲਦੀ ਸੰਪਰਕ ਕਰੇਗੀ।",
            "or": "DRISHYAM 1930: ଆପଣଙ୍କ {case_id} ରିପୋର୍ଟ ଦାଖଲ ହୋଇଛି। ଦଳ ସିଘ୍ର ସଂଯୋଗ କରିବ।",
        },
    },
    "regional_warning": {
        "channel": "SMS",
        "translations": {
            "hi": "DRISHYAM ALERT: {region} mein bank ya UPI impersonation badh raha hai. OTP aur PIN share na karein.",
            "en": "DRISHYAM ALERT: Bank and UPI impersonation is rising in {region}. Never share OTP or PIN.",
            "bn": "DRISHYAM সতর্কতা: {region}-এ ব্যাংক ও UPI প্রতারণা বাড়ছে। OTP বা PIN শেয়ার করবেন না।",
            "ta": "DRISHYAM எச்சரிக்கை: {region}-இல் வங்கி மற்றும் UPI மோசடி அதிகரிக்கிறது. OTP அல்லது PIN பகிர வேண்டாம்.",
            "te": "DRISHYAM హెచ్చరిక: {region}లో బ్యాంక్ మరియు UPI మోసాలు పెరుగుతున్నాయి. OTP లేదా PIN పంచుకోవద్దు.",
            "mr": "DRISHYAM सतर्कता: {region} मध्ये बँक आणि UPI फसवणूक वाढत आहे. OTP किंवा PIN शेअर करू नका.",
            "pa": "DRISHYAM ਚੇਤਾਵਨੀ: {region} ਵਿੱਚ ਬੈਂਕ ਅਤੇ UPI ਠੱਗੀ ਵੱਧ ਰਹੀ ਹੈ। OTP ਜਾਂ PIN ਸਾਂਝਾ ਨਾ ਕਰੋ।",
            "or": "DRISHYAM ସତର୍କତା: {region} ରେ ବ୍ୟାଙ୍କ ଓ UPI ଠକେଇ ବଢୁଛି। OTP କିମ୍ବା PIN ଶେୟର କରନ୍ତୁ ନାହିଁ।",
        },
    },
    "ivr_callback": {
        "channel": "SMS",
        "translations": {
            "hi": "DRISHYAM 1930: Aapke liye {region} se IVR callback 90 seconds mein aayega. Kripya phone on rakhein.",
            "en": "DRISHYAM 1930: An IVR callback from {region} will reach you within 90 seconds. Please keep your phone available.",
            "bn": "DRISHYAM 1930: {region} থেকে ৯০ সেকেন্ডের মধ্যে IVR কলব্যাক যাবে। ফোন হাতে রাখুন।",
            "ta": "DRISHYAM 1930: {region} இலிருந்து 90 விநாடிகளில் IVR callback வரும். தயவு செய்து கைபேசியை தயார் நிலையில் வைத்திருக்கவும்.",
            "te": "DRISHYAM 1930: {region} నుండి 90 సెకన్లలో IVR callback వస్తుంది. దయచేసి ఫోన్ అందుబాటులో ఉంచండి.",
            "mr": "DRISHYAM 1930: {region} कडून 90 सेकंदात IVR callback येईल. कृपया फोन जवळ ठेवा.",
            "pa": "DRISHYAM 1930: {region} ਤੋਂ 90 ਸਕਿੰਟ ਵਿੱਚ IVR callback ਆਵੇਗਾ। ਕਿਰਪਾ ਕਰਕੇ ਫੋਨ ਕੋਲ ਰੱਖੋ।",
            "or": "DRISHYAM 1930: {region} ରୁ 90 ସେକେଣ୍ଡ ମଧ୍ୟରେ IVR callback ଆସିବ। ଫୋନ୍ ଚାଲୁ ରଖନ୍ତୁ।",
        },
    },
}


def _normalize_language(lang: str | None) -> tuple[str, dict]:
    code = (lang or "en").lower()
    if code not in LANGUAGE_PACKS:
        code = "en"
    return code, LANGUAGE_PACKS[code]


def _normalize_region(region: str | None) -> str:
    code = (region or "north").lower()
    return code if code in REGION_DIRECTORY else "north"


def _region_name(region: str) -> str:
    return REGION_DIRECTORY.get(region, REGION_DIRECTORY["north"])["short_name"]


def _mask_phone(phone_number: str | None) -> str:
    if not phone_number:
        return "Unknown"
    if len(phone_number) <= 4:
        return phone_number
    return f"{phone_number[:2]}XXXXXX{phone_number[-2:]}"


def _parse_amount(amount: str | None) -> float:
    try:
        return float(str(amount or "0").replace(",", "").strip())
    except ValueError:
        return 0.0


def _build_sms_template(alert_type: str, lang: str, region: str, case_id: str | None = None) -> dict:
    language_code, language_content = _normalize_language(lang)
    normalized_region = _normalize_region(region)
    template = SMS_TEMPLATES.get(alert_type, SMS_TEMPLATES["case_registered"])
    text_template = template["translations"].get(language_code, template["translations"]["en"])
    return {
        "alert_type": alert_type,
        "language": language_code,
        "language_name": language_content["name"],
        "region": normalized_region,
        "channel": template["channel"],
        "template_id": f"{alert_type.upper()}_{language_code.upper()}",
        "text": text_template.format(case_id=case_id or "REF-DEMO", region=_region_name(normalized_region)),
    }


def _log_sms_notification(
    db: Session,
    recipient: str,
    template: dict,
    metadata: dict | None = None,
):
    db.add(
        NotificationLog(
            recipient=recipient,
            channel=template["channel"],
            template_id=template["template_id"],
            status="SENT",
            metadata_json={**template, **(metadata or {})},
        )
    )


def _extract_feature_phone_channel(report: CrimeReport) -> str | None:
    metadata = report.metadata_json or {}
    channel = str(metadata.get("channel") or "").upper()
    if channel in {"USSD", "IVR", "SMS", "FEATURE_PHONE"}:
        return channel
    if metadata.get("source") == "1930_HELPLINE_WIZARD":
        return "IVR"
    if report.platform == "GSM_NETWORK":
        return "USSD"
    return None


def _serialize_incident(report: CrimeReport) -> dict:
    metadata = report.metadata_json or {}
    channel = _extract_feature_phone_channel(report) or "IVR"
    language_code, language_content = _normalize_language(metadata.get("language"))
    region = _normalize_region(metadata.get("region"))
    return {
        "report_id": report.report_id,
        "scam_type": report.scam_type,
        "channel": channel,
        "language": language_code,
        "language_name": language_content["name"],
        "region": region,
        "region_name": REGION_DIRECTORY[region]["name"],
        "priority": report.priority,
        "status": report.status,
        "reporter": _mask_phone(report.reporter_num),
        "created_at": report.created_at.isoformat() if report.created_at else None,
        "next_action": "Regional IVR follow-up" if channel == "USSD" else "Queue for agency review",
        "summary": metadata.get("description") or f"{channel} incident routed into DRISHYAM Bharat layer.",
    }


def _agency_targets_for_report(report_category: str, scam_type: str) -> list[str]:
    targets = ["police:national_cyber_cell"]
    if report_category == "bank" or "financial" in scam_type.lower() or "upi" in scam_type.lower():
        targets.append("bank:nodal_freeze_desk")
    if report_category == "telecom" or "sim" in scam_type.lower() or "call" in scam_type.lower():
        targets.append("telecom:trace_desk")
    return targets


def _log_operational_notifications(
    db: Session,
    report_category: str,
    scam_type: str,
    case_id: str,
    reporter_num: str,
    metadata: dict,
) -> list[str]:
    recipients = _agency_targets_for_report(report_category, scam_type)
    for recipient in recipients:
        db.add(
            NotificationLog(
                recipient=recipient,
                channel="OPS_EVENT",
                template_id="BHARAT_CASE_ROUTED",
                status="DELIVERED",
                metadata_json={
                    "case_id": case_id,
                    "reporter": _mask_phone(reporter_num),
                    **metadata,
                },
            )
        )
    return recipients


@router.get("/languages", response_model=dict)
def get_bharat_languages():
    return {
        "pilot_regions": [
            {"id": key, "name": value["name"]}
            for key, value in REGION_DIRECTORY.items()
        ],
        "languages": [
            {
                "code": code,
                "name": content["name"],
                "script": content["script"],
                "regions": content["regions"],
                "channels": content["channels"],
                "greeting": content["greeting"],
                "sample_menu": content["menu"],
                "low_literacy_prompt": content["low_literacy_prompt"],
            }
            for code, content in LANGUAGE_PACKS.items()
        ],
    }


@router.get("/ussd/menu", response_model=dict)
def get_ussd_menu(lang: str = "hi", region: str = "north"):
    """Regional USSD menu and low-literacy guidance for feature-phone flows."""
    language_code, content = _normalize_language(lang)
    normalized_region = _normalize_region(region)
    return {
        "language": language_code,
        "region": normalized_region,
        "text": f"{content['greeting']}\n{content['menu']}",
        "low_literacy_prompt": content["low_literacy_prompt"],
        "callback_eta": "90 seconds",
    }


@router.get("/ivr/script", response_model=dict)
def get_ivr_script(lang: str = "hi", region: str = "north", scenario: str = "reporting"):
    """Selected pilot-language IVR script for dashboard preview."""
    language_code, content = _normalize_language(lang)
    normalized_region = _normalize_region(region)
    return {
        "language": language_code,
        "region": normalized_region,
        "scenario": scenario,
        "voice": f"{content['name']} neutral voice",
        "greeting": content["greeting"],
        "steps": content["ivr_steps"],
        "low_literacy_prompt": content["low_literacy_prompt"],
        "callback_eta": "Under 90 seconds",
    }


@router.get("/templates/sms", response_model=dict)
def get_sms_template(
    lang: str = "hi",
    region: str = "north",
    alert_type: str = Query("regional_warning", pattern="^(case_registered|regional_warning|ivr_callback)$"),
):
    """Regional SMS content preview for alert and confirmation flows."""
    return _build_sms_template(alert_type, lang, region)


@router.get("/coverage", response_model=dict)
def get_bharat_coverage(db: Session = Depends(get_db)):
    reports = db.query(CrimeReport).order_by(CrimeReport.created_at.desc()).limit(120).all()
    incidents = [_serialize_incident(report) for report in reports if _extract_feature_phone_channel(report)]

    if not incidents:
        incidents = [
            {
                "report_id": "USS-DEMO01",
                "scam_type": "USSD: Bank KYC Fraud",
                "channel": "USSD",
                "language": "hi",
                "language_name": "Hindi",
                "region": "north",
                "region_name": REGION_DIRECTORY["north"]["name"],
                "priority": "MEDIUM",
                "status": "PENDING",
                "reporter": "91XXXXXX55",
                "created_at": datetime.datetime.utcnow().isoformat(),
                "next_action": "Regional IVR follow-up",
                "summary": "Low-signal report waiting for IVR callback confirmation.",
            },
            {
                "report_id": "IVR-DEMO02",
                "scam_type": "Impersonation",
                "channel": "IVR",
                "language": "bn",
                "language_name": "Bengali",
                "region": "east",
                "region_name": REGION_DIRECTORY["east"]["name"],
                "priority": "HIGH",
                "status": "PENDING",
                "reporter": "91XXXXXX81",
                "created_at": datetime.datetime.utcnow().isoformat(),
                "next_action": "Queue for agency review",
                "summary": "Citizen completed spoken reporting flow and requested SMS confirmation.",
            },
        ]

    channel_counts = {"USSD": 0, "IVR": 0, "SMS": 0}
    language_counts: dict[str, int] = {}
    region_counts: dict[str, int] = {code: 0 for code in REGION_DIRECTORY}
    region_channels: dict[str, dict[str, int]] = {code: {} for code in REGION_DIRECTORY}

    for incident in incidents:
        channel_counts[incident["channel"]] = channel_counts.get(incident["channel"], 0) + 1
        language_counts[incident["language"]] = language_counts.get(incident["language"], 0) + 1
        region_counts[incident["region"]] = region_counts.get(incident["region"], 0) + 1
        region_channels[incident["region"]][incident["channel"]] = region_channels[incident["region"]].get(incident["channel"], 0) + 1

    sms_logs = db.query(NotificationLog).filter(NotificationLog.channel == "SMS").order_by(NotificationLog.sent_at.desc()).limit(200).all()
    sms_total = len(sms_logs)
    sms_success = len([log for log in sms_logs if log.status in {"SENT", "DELIVERED"}])

    regional_queue = []
    for code, details in REGION_DIRECTORY.items():
        dominant_channel = "USSD"
        if region_channels[code]:
            dominant_channel = max(region_channels[code].items(), key=lambda item: item[1])[0]
        regional_queue.append(
            {
                "id": code,
                "name": details["name"],
                "incident_count": region_counts[code],
                "dominant_channel": dominant_channel,
            }
        )

    regional_queue.sort(key=lambda item: item["incident_count"], reverse=True)

    return {
        "total_feature_phone_reports": len(incidents),
        "channel_breakdown": [
            {"channel": key, "value": value}
            for key, value in channel_counts.items()
        ],
        "language_breakdown": [
            {
                "code": code,
                "name": LANGUAGE_PACKS.get(code, LANGUAGE_PACKS["en"])["name"],
                "value": value,
            }
            for code, value in sorted(language_counts.items(), key=lambda item: item[1], reverse=True)
        ] or [{"code": "hi", "name": "Hindi", "value": 1}],
        "regional_queue": regional_queue,
        "sms_delivery_rate": round((sms_success / sms_total) * 100, 1) if sms_total else 98.0,
        "ivr_callbacks_pending": len([incident for incident in incidents if incident["channel"] == "USSD" and incident["status"] != "RESOLVED"]),
        "low_signal_ready": True,
    }


@router.get("/incidents", response_model=dict)
def get_bharat_incidents(
    limit: int = Query(10, ge=1, le=50),
    channel: str | None = None,
    db: Session = Depends(get_db),
):
    reports = db.query(CrimeReport).order_by(CrimeReport.created_at.desc()).limit(max(limit * 5, 30)).all()
    incidents = []
    normalized_channel = channel.upper() if channel else None

    for report in reports:
        report_channel = _extract_feature_phone_channel(report)
        if not report_channel:
            continue
        if normalized_channel and report_channel != normalized_channel:
            continue
        incidents.append(_serialize_incident(report))
        if len(incidents) >= limit:
            break

    if not incidents:
        incidents = get_bharat_coverage(db)["language_breakdown"] and [
            item
            for item in [
                {
                    "report_id": "USS-DEMO01",
                    "scam_type": "USSD: Bank KYC Fraud",
                    "channel": "USSD",
                    "language": "hi",
                    "language_name": "Hindi",
                    "region": "north",
                    "region_name": REGION_DIRECTORY["north"]["name"],
                    "priority": "MEDIUM",
                    "status": "PENDING",
                    "reporter": "91XXXXXX55",
                    "created_at": datetime.datetime.utcnow().isoformat(),
                    "next_action": "Regional IVR follow-up",
                    "summary": "Low-signal report waiting for IVR callback confirmation.",
                }
            ]
            if not normalized_channel or item["channel"] == normalized_channel
        ]

    return {"incidents": incidents}


@router.post("/ussd/report", response_model=dict)
def report_scam_ussd(
    phone_number: str,
    scam_type: str = "General",
    lang: str = "hi",
    region: str = "north",
    db: Session = Depends(get_db),
):
    """Log a low-bandwidth USSD report and queue a follow-up SMS."""
    case_id = f"USS-{uuid.uuid4().hex[:6].upper()}"
    language_code, content = _normalize_language(lang)
    normalized_region = _normalize_region(region)
    sms_template = _build_sms_template("case_registered", language_code, normalized_region, case_id)

    new_report = CrimeReport(
        report_id=case_id,
        category="police",
        scam_type=f"USSD: {scam_type}",
        platform="GSM_NETWORK",
        priority="MEDIUM",
        reporter_num=phone_number,
        status="PENDING",
        metadata_json={
            "channel": "USSD",
            "language": language_code,
            "region": normalized_region,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "callback_required": True,
            "template_id": sms_template["template_id"],
        },
    )
    db.add(new_report)
    _log_sms_notification(db, phone_number, sms_template, {"case_id": case_id})
    routed_to = _log_operational_notifications(
        db,
        "police",
        scam_type,
        case_id,
        phone_number,
        {"channel": "USSD", "language": language_code, "region": normalized_region},
    )
    db.commit()

    logger.info("USSD report logged for %s in %s (%s)", phone_number, normalized_region, language_code)

    return {
        "status": "success",
        "case_id": case_id,
        "message": content["report_success"].format(case_id=case_id),
        "sms_preview": sms_template,
        "routed_to": routed_to,
        "next_step": "Regional IVR callback queued",
    }


@router.post("/ivr/report", response_model=dict)
def report_scam_ivr(
    phone_number: str,
    scam_type: str = "General",
    lang: str = "hi",
    region: str = "north",
    db: Session = Depends(get_db),
):
    """Voice-first reporting path for low-literacy and no-app citizens."""
    case_id = f"IVR-{uuid.uuid4().hex[:6].upper()}"
    language_code, content = _normalize_language(lang)
    normalized_region = _normalize_region(region)
    sms_template = _build_sms_template("ivr_callback", language_code, normalized_region, case_id)

    new_report = CrimeReport(
        report_id=case_id,
        category="police",
        scam_type=scam_type,
        platform="IVR_1930",
        priority="HIGH",
        reporter_num=phone_number,
        status="PENDING",
        metadata_json={
            "channel": "IVR",
            "language": language_code,
            "region": normalized_region,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "voice_prompt": content["ivr_steps"][0],
            "template_id": sms_template["template_id"],
            "low_literacy_mode": True,
        },
    )
    db.add(new_report)
    _log_sms_notification(db, phone_number, sms_template, {"case_id": case_id})
    routed_to = _log_operational_notifications(
        db,
        "police",
        scam_type,
        case_id,
        phone_number,
        {"channel": "IVR", "language": language_code, "region": normalized_region},
    )
    db.commit()

    logger.info("IVR report queued for %s in %s (%s)", phone_number, normalized_region, language_code)

    return {
        "status": "success",
        "case_id": case_id,
        "message": content["report_success"].format(case_id=case_id),
        "ivr_ticket": f"CB-{uuid.uuid4().hex[:5].upper()}",
        "sms_preview": sms_template,
        "routed_to": routed_to,
    }


@router.post("/report/comprehensive", response_model=dict)
def report_scam_comprehensive(
    reporter_num: str | None = None,
    category: str | None = None,
    scam_type: str = "Citizen Report",
    amount: str = "0",
    platform: str = "Unknown",
    description: str = "",
    channel: str = "IVR",
    lang: str = "hi",
    region: str = "north",
    payload: ComprehensiveBharatReportRequest | None = Body(default=None),
    db: Session = Depends(get_db),
):
    """Comprehensive reporting flow shared by the simulation wizard and dashboard."""
    if payload:
        reporter_num = payload.reporter_num or reporter_num
        category = payload.category or category
        scam_type = payload.scam_type or scam_type
        amount = payload.amount or amount
        platform = payload.platform or platform
        description = payload.description or description
        channel = payload.channel or channel
        lang = payload.lang or lang
        region = payload.region or region

    if not reporter_num or not category:
        raise HTTPException(status_code=400, detail="reporter_num and category are required")

    case_id = f"REF-{uuid.uuid4().hex[:8].upper()}"
    normalized_region = _normalize_region(region)
    language_code, language_content = _normalize_language(lang)
    normalized_channel = (channel or "IVR").upper()
    amount_value = _parse_amount(amount)

    category_map = {"police", "bank", "telecom"}
    normalized_category = category.lower()
    report_category = normalized_category if normalized_category in category_map else "police"
    resolved_scam_type = category if normalized_category not in category_map else scam_type

    sms_template = _build_sms_template("case_registered", language_code, normalized_region, case_id)
    extra_context = payload.model_dump(exclude_none=True) if payload else {}
    report_metadata = {
        "description": description,
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "source": "1930_HELPLINE_WIZARD",
        "section_65b_status": "GENERATED",
        "channel": normalized_channel,
        "language": language_code,
        "language_name": language_content["name"],
        "region": normalized_region,
        "template_id": sms_template["template_id"],
        "bank_name": extra_context.get("bank_name"),
        "impersonated_name": extra_context.get("impersonated_name"),
        "id_type": extra_context.get("id_type"),
        "leak_location": extra_context.get("leak_location"),
        "handle_link": extra_context.get("handle_link"),
        "utr_id": extra_context.get("utr_id"),
        "fake_handle": extra_context.get("fake_handle"),
        "pii_details": extra_context.get("pii_details"),
        "scam_link": extra_context.get("scam_link"),
        "raw_context": extra_context,
    }

    new_report = CrimeReport(
        report_id=case_id,
        category=report_category,
        scam_type=resolved_scam_type,
        amount=amount,
        platform=platform,
        priority="HIGH" if amount_value > 50000 else "MEDIUM",
        reporter_num=reporter_num,
        status="PENDING",
        metadata_json=report_metadata,
    )
    db.add(new_report)
    _log_sms_notification(db, reporter_num, sms_template, {"case_id": case_id})
    routed_to = _log_operational_notifications(
        db,
        report_category,
        resolved_scam_type,
        case_id,
        reporter_num,
        {
            "channel": normalized_channel,
            "language": language_code,
            "region": normalized_region,
            "amount": amount,
        },
    )
    db.commit()

    return {
        "status": "success",
        "case_id": case_id,
        "fir_copy_url": f"/api/v1/bharat/fir/{case_id}",
        "message": f"Incident logged successfully. FIR {case_id} generated.",
        "sms_preview": sms_template,
        "routed_to": routed_to,
        "saved_context": report_metadata,
    }


@router.get("/fir/{case_id}", response_model=dict)
def get_digital_fir(case_id: str, db: Session = Depends(get_db)):
    """Simulate Section 65B Digital FIR retrieval."""
    report = db.query(CrimeReport).filter(CrimeReport.report_id == case_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Case not found")

    return {
        "case_id": report.report_id,
        "timestamp": report.created_at.isoformat() if report.created_at else None,
        "section_65b_certified": True,
        "digital_signature": "DRISHYAM-AI-SECURE-SIG-772",
        "details": {
            "category": report.category,
            "loss": report.amount,
            "platform": report.platform,
            "channel": (report.metadata_json or {}).get("channel", "IVR"),
            "language": (report.metadata_json or {}).get("language", "hi"),
        },
    }
