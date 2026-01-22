import requests
import uuid
import sys

BASE_URL = "http://localhost:8000/api"
EMAIL = f"test_auto_{uuid.uuid4().hex[:8]}@example.com"
PASSWORD = "Password123!"
FULL_NAME = "Automated Tester"

def run_test(name, func):
    print(f"Testing {name}...", end=" ", flush=True)
    try:
        result = func()
        print("✅ PASS")
        return result
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return None

def verify_endpoints():
    print(f"Target: {BASE_URL}")
    print(f"User: {EMAIL}")
    print("-" * 50)

    # 1. Register
    def test_register():
        payload = {
            "email": EMAIL,
            "password": PASSWORD,
            "full_name": FULL_NAME
        }
        resp = requests.post(f"{BASE_URL}/auth/register", json=payload)
        resp.raise_for_status()
        return resp.json()
    
    auth_data = run_test("Register", test_register)
    if not auth_data: return

    token = auth_data['access_token']
    headers = {"Authorization": f"Bearer {token}"}
    user_id = auth_data['user']['id']

    # 2. Get Me
    def test_me():
        resp = requests.get(f"{BASE_URL}/auth/me", headers=headers)
        resp.raise_for_status()
        data = resp.json()
        assert data['email'] == EMAIL
    
    run_test("Get Current User", test_me)

    # 3. Create Organization
    def test_create_org():
        payload = {"name": "Test Corp Automation"}
        resp = requests.post(f"{BASE_URL}/organizations", json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()

    org = run_test("Create Organization", test_create_org)
    if not org: return
    org_id = org['id']

    # 4. List Organizations
    def test_list_orgs():
        resp = requests.get(f"{BASE_URL}/organizations", headers=headers)
        resp.raise_for_status()
        orgs = resp.json()
        assert len(orgs) > 0
    
    run_test("List Organizations", test_list_orgs)

    # 5. Get Organization Details
    def test_get_org():
        resp = requests.get(f"{BASE_URL}/organizations/{org_id}", headers=headers)
        resp.raise_for_status()
        assert resp.json()['id'] == org_id

    run_test("Get Organization Details", test_get_org)

    # 6. Create Task
    def test_create_task():
        payload = {
            "title": "Automated Task",
            "description": "This is a test task",
            "status": "pending",
            "priority": "medium" # Note: Schema might not have priority, checking server.py... it does not.
        }
        resp = requests.post(f"{BASE_URL}/organizations/{org_id}/tasks", json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()

    task = run_test("Create Task", test_create_task)
    if not task: return
    task_id = task['id']

    # 7. List Tasks
    def test_list_tasks():
        resp = requests.get(f"{BASE_URL}/organizations/{org_id}/tasks", headers=headers)
        resp.raise_for_status()
        tasks = resp.json()
        assert len(tasks) > 0

    run_test("List Tasks", test_list_tasks)

    # 8. Update Task
    def test_update_task():
        payload = {"status": "completed"}
        resp = requests.patch(f"{BASE_URL}/organizations/{org_id}/tasks/{task_id}", json=payload, headers=headers)
        resp.raise_for_status()
        assert resp.json()['status'] == "completed"

    run_test("Update Task", test_update_task)

    # 9. Get Task Details
    def test_get_task():
        resp = requests.get(f"{BASE_URL}/organizations/{org_id}/tasks/{task_id}", headers=headers)
        resp.raise_for_status()
        assert resp.json()['id'] == task_id

    run_test("Get Task Details", test_get_task)

    # 10. Org Stats
    def test_stats():
        resp = requests.get(f"{BASE_URL}/organizations/{org_id}/stats", headers=headers)
        resp.raise_for_status()
        data = resp.json()
        assert 'total_tasks' in data

    run_test("Organization Stats", test_stats)

    # 11. Delete Task
    def test_delete_task():
        resp = requests.delete(f"{BASE_URL}/organizations/{org_id}/tasks/{task_id}", headers=headers)
        resp.raise_for_status()

    run_test("Delete Task", test_delete_task)

    print("-" * 50)
    print("Verification Complete!")

if __name__ == "__main__":
    verify_endpoints()
