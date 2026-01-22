import requests
import os
import sys
import uuid
import datetime
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env')

MONGO_URL = os.getenv('MONGO_URL')
DB_NAME = os.getenv('DB_NAME', 'taskflow_db')
API_URL = "http://localhost:8000/api"

# Passwords
COMMON_PASSWORD = "Password123!"

USERS = {
    "sysadmin": {
        "email": "sysadmin@taskflow.com",
        "full_name": "System Administrator",
        "role_type": "SYS_ADMIN"
    },
    "org_admin": {
        "email": "admin@demo.org",
        "full_name": "Org Admin",
        "role_type": "ORG_ADMIN"
    },
    "manager": {
        "email": "manager@demo.org",
        "full_name": "Department Manager",
        "role_type": "ORG_MANAGER"
    },
    "employee": {
        "email": "employee@demo.org",
        "full_name": "John Employee",
        "role_type": "ORG_EMPLOYEE"
    }
}

def get_db_connection():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]

def register_user(user_key):
    user = USERS[user_key]
    print(f"Registering {user['full_name']} ({user['email']})...", end=" ")
    
    payload = {
        "email": user["email"],
        "password": COMMON_PASSWORD,
        "full_name": user["full_name"]
    }
    
    try:
        resp = requests.post(f"{API_URL}/auth/register", json=payload)
        if resp.status_code == 400 and "already registered" in resp.text:
            print("Already exists. Logging in...", end=" ")
            # Login to get ID
            login_resp = requests.post(f"{API_URL}/auth/login", json={"email": user["email"], "password": COMMON_PASSWORD})
            login_resp.raise_for_status()
            data = login_resp.json()
            print("✅ OK")
            return data
        
        resp.raise_for_status()
        print("✅ Created")
        return resp.json()
    except Exception as e:
        print(f"❌ FAIL: {e}")
        return None

def main():
    print("--- Creating Users with Roles ---")
    
    # 1. Register All Users
    user_data = {}
    for key in USERS:
        data = register_user(key)
        if data:
            user_data[key] = data
        else:
            print("Aborting due to registration failure.")
            return

    # 2. Bootstrap System Admin
    print("\nBootstrapping System Admin...", end=" ")
    sys_admin_id = user_data["sysadmin"]["user"]["id"]
    db = get_db_connection()
    
    # Check if already sys admin
    if db.sys_admins.find_one({"user_id": sys_admin_id}):
        print("✅ Already a SysAdmin")
    else:
        db.sys_admins.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": sys_admin_id,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "created_by": "bootstrap_script"
        })
        print("✅ Promoted to SysAdmin")

    # 3. Setup Organization
    print("\nSetting up 'Demo Corp' Organization...")
    
    # Login as Org Admin
    org_admin_token = user_data["org_admin"]["access_token"]
    headers = {"Authorization": f"Bearer {org_admin_token}"}
    
    # Check if Org exists or Create
    resp = requests.get(f"{API_URL}/organizations", headers=headers)
    orgs = resp.json()
    
    demo_org = None
    for o in orgs:
        if o["name"] == "Demo Technologies":
            demo_org = o
            break
            
    if demo_org:
        print(f"Organization 'Demo Technologies' found (ID: {demo_org['id']}).")
    else:
        print("Creating Organization 'Demo Technologies'...", end=" ")
        resp = requests.post(f"{API_URL}/organizations", json={"name": "Demo Technologies"}, headers=headers)
        if resp.status_code == 200:
            demo_org = resp.json()
            print("✅ Created")
        else:
            print(f"❌ FAIL: {resp.text}")
            return

    org_id = demo_org["id"]

    # 4. Invite Members
    def invite_user(target_key, role):
        target_email = USERS[target_key]["email"]
        print(f"Inviting {target_key} as {role}...", end=" ")
        
        payload = {
            "email": target_email,
            "role": role
        }
        
        resp = requests.post(f"{API_URL}/organizations/{org_id}/invite", json=payload, headers=headers)
        if resp.status_code == 200:
            print("✅ Invited")
        elif resp.status_code == 400 and "already a member" in resp.text:
             print("✅ Already a member")
        else:
            print(f"❌ FAIL: {resp.text}")

    invite_user("manager", "manager")
    invite_user("employee", "employee")  # Presuming 'employee' is a valid role string, usually roles are admin/manager/employee

    print("\n--- Summary of Credentials ---")
    print(f"Password for all: {COMMON_PASSWORD}")
    print("-" * 40)
    for key, info in USERS.items():
        print(f"{info['role_type']:<15} : {info['email']}")
    print("-" * 40)
    print("Done.")

if __name__ == "__main__":
    main()
