import requests
import sys
import argparse

def test_deployment(base_url):
    print(f"Testing deployment at: {base_url}")
    print("-" * 50)

    # 1. Test Health / Docs
    print("[1] Checking /docs endpoint (Server Reachability)...")
    try:
        resp = requests.get(f"{base_url}/docs", timeout=10)
        if resp.status_code == 200:
            print("✅ SUCCESS: Server is reachable and Docs are running.")
        else:
            print(f"❌ FAIL: Server returned status code {resp.status_code} for /docs")
    except requests.exceptions.RequestException as e:
        print(f"❌ FAIL: Could not connect to server. Error: {e}")
        return

    # 2. Test API Prefix / Auth Check
    print("\n[2] Checking /api/auth/me (Expect 401 Unauthenticated)...")
    try:
        resp = requests.get(f"{base_url}/api/auth/me", timeout=10)
        if resp.status_code == 401:
            print("✅ SUCCESS: Auth middleware is working (Received expected 401).")
        elif resp.status_code == 200:
             print("⚠️ WARNING: Received 200 OK. This is unexpected for an unauthenticated request to /me.")
        else:
             print(f"⚠️ WARNING: Received unexpected status code {resp.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ FAIL: Request failed. Error: {e}")

    # 3. Test Stripe Integration (Optional - just checking if endpoint exists/doesn't 404 immediately)
    print("\n[3] Checking /api/payments/checkout (Method Not Allowed check)...")
    # Sending GET to a POST endpoint should return 405 Method Not Allowed, proving the path exists
    try:
        resp = requests.get(f"{base_url}/api/payments/checkout", timeout=10)
        if resp.status_code == 405:
            print("✅ SUCCESS: Stripe checkout endpoint exists (Received 405 Method Not Allowed as expected for GET).")
        elif resp.status_code == 404:
            print("❌ FAIL: Stripe checkout endpoint not found (404). Check if server code is updated.")
        else:
            print(f"ℹ️ INFO: Received status {resp.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ FAIL: Request failed. Error: {e}")

    print("-" * 50)
    print("Test Complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Test deployment health.')
    parser.add_argument('url', nargs='?', help='The base URL of the deployed server (e.g., https://my-app.onrender.com)')
    args = parser.parse_args()

    url = args.url
    if not url:
        url = input("Enter your deployed server URL (e.g., https://api.myapp.com): ").strip()
    
    if url.endswith('/'):
        url = url[:-1]
        
    test_deployment(url)
