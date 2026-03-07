import httpx
import asyncio
import json
import sys

BASE_URL = "http://localhost:8000/api/v1"
HEADERS = {}

async def test_module(name, func):
    print(f"Testing {name}...", end=" ", flush=True)
    try:
        await func()
        print("✅ PASSED")
        return True
    except Exception as e:
        print(f"❌ FAILED")
        if isinstance(e, httpx.HTTPStatusError):
            print(f"   HTTP Error {e.response.status_code}: {e.response.text}")
        else:
            print(f"   Error: {type(e).__name__}: {e}")
        return False

async def login():
    global HEADERS
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f"{BASE_URL}/auth/login", data={
            "username": "admin",
            "password": "password123"
        })
        resp.raise_for_status()
        token_data = resp.json()
        HEADERS = {"Authorization": f"Bearer {token_data['access_token']}"}
        print("Auth Token Obtained ✅")

async def test_detection():
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f"{BASE_URL}/detection/detect", json={
            "caller_num": "+919876543210",
            "receiver_num": "+919000000000",
            "duration": 45,
            "sim_age": 2,
            "metadata": {"location": "Jamtara"}
        })
        resp.raise_for_status()
        data = resp.json()
        assert "fraud_risk_score" in data
        assert data["verdict"] in ["ROUTE_TO_HONEYPOT", "FLAG_AND_WARN", "SUSPICIOUS", "ALLOW"]

async def test_honeypot():
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Create session (Query params)
        resp = await client.post(f"{BASE_URL}/honeypot/sessions", params={
            "caller_num": "+919999999999",
            "persona": "elderly_uncle"
        })
        resp.raise_for_status()
        session = resp.json()
        session_id = session["session_id"]

        # Chat (Query params)
        resp = await client.post(f"{BASE_URL}/honeypot/sessions/{session_id}/chat", params={
            "message": "Hello, I am calling from your bank. Your KYC is expired."
        })
        resp.raise_for_status()
        data = resp.json()
        assert "response" in data

        # Conclude
        resp = await client.post(f"{BASE_URL}/honeypot/sessions/{session_id}/conclude")
        resp.raise_for_status()

async def test_upi():
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f"{BASE_URL}/upi/verify", json={
            "vpa": "scammer@okaxis"
        })
        resp.raise_for_status()
        data = resp.json()
        assert "risk_level" in data
        assert data["is_flagged"] is True

async def test_bharat():
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(f"{BASE_URL}/bharat/ussd/menu", params={"lang": "hi"})
        resp.raise_for_status()
        data = resp.json()
        assert "swagat" in data["text"].lower()

async def test_forensic():
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f"{BASE_URL}/forensic/deepfake/analyze", headers=HEADERS, json={
            "media_type": "video",
            "media_url": "http://example.com/demo.mp4"
        })
        resp.raise_for_status()
        data = resp.json()
        assert "verdict" in data

async def test_mule():
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f"{BASE_URL}/mule/analyze", headers=HEADERS, json={
            "source": "Telegram",
            "ad_text": "Earn 5000 per day by giving your bank account. Transfer money fast. No work needed.",
            "lang": "en"
        })
        resp.raise_for_status()
        data = resp.json()
        assert data["is_mule_recruitment"] is True

async def main():
    print("=== SENTINEL 1930 FULL SYSTEM VERIFICATION ===")
    try:
        await login()
    except Exception as e:
        print(f"Auth Failed: {e}")
        sys.exit(1)
        
    results = [
        await test_module("Detection Grid (M1)", test_detection),
        await test_module("AI Honeypot Engine (M2)", test_honeypot),
        await test_module("UPI & Payment Shield (M4)", test_upi),
        await test_module("Bharat Feature Phone Layer (M5)", test_bharat),
        await test_module("Deepfake Video Defense (M12)", test_forensic),
        await test_module("Mule Recruitment Interceptor (M14)", test_mule),
    ]
    
    print("=" * 46)
    if all(results):
        print("✅ ALL MODULES OPERATIONAL AND SECURE")
    else:
        print("❌ SOME MODULES FAILED - CHECK LOGS")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
