import httpx
import os
from dotenv import load_dotenv

# Load .env from the backend directory
load_dotenv("/Users/mukul/Desktop/DRISHYAM-AI/backend/.env")

API_URL = os.getenv("DRISHYAM_DEEPFAKE_API_URL", "https://deepfake-production-39b6.up.railway.app")
API_KEY = os.getenv("DRISHYAM_DEEPFAKE_API_KEY", "drishyam_admin_2026")

def test_health():
    print(f"Testing health: {API_URL}/health")
    try:
        response = httpx.get(f"{API_URL}/health")
        print(f"Status: {response.status_code}")
        print(f"Body: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")

def test_stats():
    print(f"\nTesting stats: {API_URL}/stats")
    try:
        headers = {"X-API-KEY": API_KEY}
        response = httpx.get(f"{API_URL}/stats", headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Body: {response.json()}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_health()
    test_stats()
