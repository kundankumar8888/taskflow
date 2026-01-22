from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import stripe
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')
stripe.api_key = STRIPE_API_KEY

# Security
security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

@app.get("/")
async def health_check():
    try:
        # Check DB connection
        await client.admin.command('ping')
        db_status = "connected"
    except Exception as e:
        db_status = f"disconnected: {str(e)}"
        
    return {
        "status": "ok", 
        "message": "Server is running",
        "database": db_status
    }

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class OrganizationCreate(BaseModel):
    name: str

class OrganizationResponse(BaseModel):
    id: str
    name: str
    stripe_customer_id: Optional[str] = None
    subscription_status: str = "free"
    created_by: str
    created_at: str

class OrganizationMemberInvite(BaseModel):
    email: EmailStr
    role: str  # admin, manager, employee

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    status: str = "pending"  # pending, about_to_do, completed
    duration_minutes: Optional[int] = None
    is_daily: bool = False
    due_date: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    status: Optional[str] = None
    duration_minutes: Optional[int] = None
    is_daily: Optional[bool] = None
    due_date: Optional[str] = None

class TaskResponse(BaseModel):
    id: str
    org_id: str
    title: str
    description: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    status: str
    duration_minutes: Optional[int] = None
    is_daily: bool
    due_date: Optional[str] = None
    created_at: str
    created_by: str

class AdminConfigUpdate(BaseModel):
    key_name: str
    value: str
    is_secret: bool = False

class CheckoutRequest(BaseModel):
    package_id: str
    org_id: str

# ==================== AUTH UTILITIES ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(user_id: str) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        
        user = await db.users.find_one({'id': user_id}, {'_id': 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_user_org_role(user_id: str, org_id: str) -> Optional[str]:
    member = await db.organization_members.find_one(
        {'user_id': user_id, 'org_id': org_id},
        {'_id': 0}
    )
    return member['role'] if member else None

async def require_role(user, org_id: str, allowed_roles: List[str]):
    role = await get_user_org_role(user['id'], org_id)
    if not role or role not in allowed_roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return role

async def require_sys_admin(user):
    admin_user = await db.sys_admins.find_one({'user_id': user['id']}, {'_id': 0})
    if not admin_user:
        raise HTTPException(status_code=403, detail="System admin access required")

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({'email': user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        'id': user_id,
        'email': user_data.email,
        'password_hash': hash_password(user_data.password),
        'full_name': user_data.full_name,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_access_token(user_id)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=user_data.email,
            full_name=user_data.full_name,
            created_at=user_doc['created_at']
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({'email': credentials.email}, {'_id': 0})
    if not user or not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token(user['id'])
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user['id'],
            email=user['email'],
            full_name=user['full_name'],
            created_at=user['created_at']
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user = Depends(get_current_user)):
    return UserResponse(
        id=current_user['id'],
        email=current_user['email'],
        full_name=current_user['full_name'],
        created_at=current_user['created_at']
    )

# ==================== ORGANIZATION ROUTES ====================

@api_router.post("/organizations", response_model=OrganizationResponse)
async def create_organization(org_data: OrganizationCreate, current_user = Depends(get_current_user)):
    org_id = str(uuid.uuid4())
    org_doc = {
        'id': org_id,
        'name': org_data.name,
        'stripe_customer_id': None,
        'subscription_status': 'free',
        'created_by': current_user['id'],
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.organizations.insert_one(org_doc)
    
    # Add creator as admin
    member_doc = {
        'id': str(uuid.uuid4()),
        'user_id': current_user['id'],
        'org_id': org_id,
        'role': 'admin',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.organization_members.insert_one(member_doc)
    
    return OrganizationResponse(**org_doc)

@api_router.get("/organizations", response_model=List[OrganizationResponse])
async def get_my_organizations(current_user = Depends(get_current_user)):
    members = await db.organization_members.find(
        {'user_id': current_user['id']},
        {'_id': 0}
    ).to_list(100)
    
    org_ids = [m['org_id'] for m in members]
    orgs = await db.organizations.find(
        {'id': {'$in': org_ids}},
        {'_id': 0}
    ).to_list(100)
    
    return [OrganizationResponse(**org) for org in orgs]

@api_router.get("/organizations/{org_id}", response_model=OrganizationResponse)
async def get_organization(org_id: str, current_user = Depends(get_current_user)):
    # Verify user is member
    role = await get_user_org_role(current_user['id'], org_id)
    if not role:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    
    org = await db.organizations.find_one({'id': org_id}, {'_id': 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    return OrganizationResponse(**org)

@api_router.post("/organizations/{org_id}/invite")
async def invite_member(org_id: str, invite: OrganizationMemberInvite, current_user = Depends(get_current_user)):
    # Only admin can invite
    await require_role(current_user, org_id, ['admin'])
    
    # Check if user exists
    invited_user = await db.users.find_one({'email': invite.email}, {'_id': 0})
    if not invited_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already member
    existing = await db.organization_members.find_one(
        {'user_id': invited_user['id'], 'org_id': org_id}
    )
    if existing:
        raise HTTPException(status_code=400, detail="User already a member")
    
    member_doc = {
        'id': str(uuid.uuid4()),
        'user_id': invited_user['id'],
        'org_id': org_id,
        'role': invite.role,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.organization_members.insert_one(member_doc)
    
    return {"message": "Member invited successfully"}

@api_router.get("/organizations/{org_id}/members")
async def get_organization_members(org_id: str, current_user = Depends(get_current_user)):
    role = await get_user_org_role(current_user['id'], org_id)
    if not role:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    
    members = await db.organization_members.find(
        {'org_id': org_id},
        {'_id': 0}
    ).to_list(100)
    
    user_ids = [m['user_id'] for m in members]
    users = await db.users.find(
        {'id': {'$in': user_ids}},
        {'_id': 0, 'password_hash': 0}
    ).to_list(100)
    
    user_map = {u['id']: u for u in users}
    
    result = []
    for member in members:
        user = user_map.get(member['user_id'])
        if user:
            result.append({
                'id': member['id'],
                'user_id': member['user_id'],
                'email': user['email'],
                'full_name': user['full_name'],
                'role': member['role'],
                'created_at': member['created_at']
            })
    
    return result

# ==================== TASK ROUTES ====================

@api_router.post("/organizations/{org_id}/tasks", response_model=TaskResponse)
async def create_task(org_id: str, task_data: TaskCreate, current_user = Depends(get_current_user)):
    # Admin and Manager can create tasks
    await require_role(current_user, org_id, ['admin', 'manager'])
    
    task_id = str(uuid.uuid4())
    task_doc = {
        'id': task_id,
        'org_id': org_id,
        'title': task_data.title,
        'description': task_data.description,
        'assigned_to': task_data.assigned_to,
        'status': task_data.status,
        'duration_minutes': task_data.duration_minutes,
        'is_daily': task_data.is_daily,
        'due_date': task_data.due_date,
        'created_by': current_user['id'],
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.tasks.insert_one(task_doc)
    
    assigned_to_name = None
    if task_data.assigned_to:
        assigned_user = await db.users.find_one({'id': task_data.assigned_to}, {'_id': 0})
        if assigned_user:
            assigned_to_name = assigned_user['full_name']
    
    return TaskResponse(**task_doc, assigned_to_name=assigned_to_name)

@api_router.get("/organizations/{org_id}/tasks", response_model=List[TaskResponse])
async def get_tasks(
    org_id: str,
    status: Optional[str] = None,
    assigned_to_me: bool = False,
    is_daily: Optional[bool] = None,
    current_user = Depends(get_current_user)
):
    role = await get_user_org_role(current_user['id'], org_id)
    if not role:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    
    query = {'org_id': org_id}
    
    if status:
        query['status'] = status
    
    if assigned_to_me:
        query['assigned_to'] = current_user['id']
    
    if is_daily is not None:
        query['is_daily'] = is_daily
    
    tasks = await db.tasks.find(query, {'_id': 0}).to_list(1000)
    
    # Get all assigned user names
    assigned_ids = [t['assigned_to'] for t in tasks if t.get('assigned_to')]
    if assigned_ids:
        users = await db.users.find(
            {'id': {'$in': assigned_ids}},
            {'_id': 0}
        ).to_list(100)
        user_map = {u['id']: u['full_name'] for u in users}
    else:
        user_map = {}
    
    result = []
    for task in tasks:
        result.append(TaskResponse(
            **task,
            assigned_to_name=user_map.get(task.get('assigned_to'))
        ))
    
    return result

@api_router.get("/organizations/{org_id}/tasks/{task_id}", response_model=TaskResponse)
async def get_task(org_id: str, task_id: str, current_user = Depends(get_current_user)):
    role = await get_user_org_role(current_user['id'], org_id)
    if not role:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    
    task = await db.tasks.find_one({'id': task_id, 'org_id': org_id}, {'_id': 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    assigned_to_name = None
    if task.get('assigned_to'):
        assigned_user = await db.users.find_one({'id': task['assigned_to']}, {'_id': 0})
        if assigned_user:
            assigned_to_name = assigned_user['full_name']
    
    return TaskResponse(**task, assigned_to_name=assigned_to_name)

@api_router.patch("/organizations/{org_id}/tasks/{task_id}", response_model=TaskResponse)
async def update_task(org_id: str, task_id: str, task_update: TaskUpdate, current_user = Depends(get_current_user)):
    task = await db.tasks.find_one({'id': task_id, 'org_id': org_id}, {'_id': 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Admin and manager can update any task, employee can update their own tasks
    role = await get_user_org_role(current_user['id'], org_id)
    if role not in ['admin', 'manager']:
        if task.get('assigned_to') != current_user['id']:
            raise HTTPException(status_code=403, detail="Can only update your own tasks")
    
    update_data = {k: v for k, v in task_update.model_dump().items() if v is not None}
    
    if update_data:
        await db.tasks.update_one(
            {'id': task_id},
            {'$set': update_data}
        )
        task.update(update_data)
    
    assigned_to_name = None
    if task.get('assigned_to'):
        assigned_user = await db.users.find_one({'id': task['assigned_to']}, {'_id': 0})
        if assigned_user:
            assigned_to_name = assigned_user['full_name']
    
    return TaskResponse(**task, assigned_to_name=assigned_to_name)

@api_router.delete("/organizations/{org_id}/tasks/{task_id}")
async def delete_task(org_id: str, task_id: str, current_user = Depends(get_current_user)):
    # Only admin and manager can delete
    await require_role(current_user, org_id, ['admin', 'manager'])
    
    result = await db.tasks.delete_one({'id': task_id, 'org_id': org_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return {"message": "Task deleted successfully"}

# ==================== STRIPE PAYMENT ROUTES ====================

SUBSCRIPTION_PACKAGES = {
    'starter': {'amount': 29.00, 'name': 'Starter Plan'},
    'professional': {'amount': 79.00, 'name': 'Professional Plan'},
    'enterprise': {'amount': 199.00, 'name': 'Enterprise Plan'}
}

@api_router.post("/payments/checkout")
async def create_checkout_session(checkout: CheckoutRequest, request: Request, current_user = Depends(get_current_user)):
    # Verify user is admin of org
    await require_role(current_user, checkout.org_id, ['admin'])
    
    # Validate package
    if checkout.package_id not in SUBSCRIPTION_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    package = SUBSCRIPTION_PACKAGES[checkout.package_id]
    
    # Get host URL from request
    host_url = str(request.base_url).rstrip('/')
    
    # Create success and cancel URLs
    success_url = f"{host_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{host_url}/payment-cancel"
    
    # Initialize Stripe checkout
    webhook_url = f"{host_url}/api/payments/webhook"
    
    # Create checkout session directly with Stripe
    try:
        session = await asyncio.to_thread(
            stripe.checkout.Session.create,
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': package['name'],
                    },
                    'unit_amount': int(package['amount'] * 100),  # Amount in cents
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                'org_id': checkout.org_id,
                'package_id': checkout.package_id,
                'user_id': current_user['id']
            }
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Create payment transaction record
    transaction_doc = {
        'id': str(uuid.uuid4()),
        'session_id': session.id,
        'org_id': checkout.org_id,
        'user_id': current_user['id'],
        'package_id': checkout.package_id,
        'amount': package['amount'],
        'currency': 'usd',
        'payment_status': 'pending',
        'status': 'initiated',
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.payment_transactions.insert_one(transaction_doc)
    
    return {'url': session.url, 'session_id': session.id}

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, request: Request, current_user = Depends(get_current_user)):
    # Check if transaction already processed
    transaction = await db.payment_transactions.find_one(
        {'session_id': session_id},
        {'_id': 0}
    )
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # If already processed as paid, return immediately
    if transaction['payment_status'] == 'paid':
        return {
            'status': transaction['status'],
            'payment_status': transaction['payment_status'],
            'message': 'Payment already processed'
        }
    
    # Get status from Stripe
    try:
        session = await asyncio.to_thread(
            stripe.checkout.Session.retrieve,
            session_id
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Map Stripe status to our internal status
    stripe_status = session.status
    payment_status = session.payment_status
    
    # Update transaction
    update_data = {
        'status': stripe_status,
        'payment_status': payment_status,
        'updated_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.payment_transactions.update_one(
        {'session_id': session_id},
        {'$set': update_data}
    )
    
    # If payment successful and not yet processed, update organization
    if payment_status == 'paid' and transaction['payment_status'] != 'paid':
        await db.organizations.update_one(
            {'id': transaction['org_id']},
            {'$set': {'subscription_status': 'active'}}
        )
    
    return {
        'status': stripe_status,
        'payment_status': payment_status,
        'amount_total': session.amount_total / 100 if session.amount_total else 0,
        'currency': session.currency
    }

@api_router.post("/payments/webhook")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get('Stripe-Signature')
    
    try:
        webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')
        if not webhook_secret:
             # If no secret, just proceed (insecure but allows functional testing if not configured)
             # In production, this should be enforced.
             event = stripe.Event.construct_from(
                await request.json(), stripe.api_key
             )
        else:
            event = stripe.Webhook.construct_event(
                body, signature, webhook_secret
            )
        
        # Handle the event
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            session_id = session.get('id')
            payment_status = session.get('payment_status')
            
            # Update transaction based on webhook
            if session_id:
                transaction = await db.payment_transactions.find_one(
                    {'session_id': session_id},
                    {'_id': 0}
                )
                
                if transaction:
                    update_data = {
                        'payment_status': payment_status,
                        'status': 'completed' if payment_status == 'paid' else 'failed',
                        'updated_at': datetime.now(timezone.utc).isoformat()
                    }
                    
                    await db.payment_transactions.update_one(
                        {'session_id': session_id},
                        {'$set': update_data}
                    )
                    
                    # Update organization subscription if paid
                    if payment_status == 'paid':
                        await db.organizations.update_one(
                            {'id': transaction['org_id']},
                            {'$set': {'subscription_status': 'active'}}
                        )
        
        return {'status': 'success'}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ==================== ADMIN ROUTES ====================

@api_router.get("/admin/config")
async def get_admin_config(current_user = Depends(get_current_user)):
    await require_sys_admin(current_user)
    
    configs = await db.admin_config.find({}, {'_id': 0}).to_list(100)
    return configs

@api_router.post("/admin/config")
async def update_admin_config(config: AdminConfigUpdate, current_user = Depends(get_current_user)):
    await require_sys_admin(current_user)
    
    # Check if config exists
    existing = await db.admin_config.find_one({'key_name': config.key_name})
    
    config_doc = {
        'key_name': config.key_name,
        'value': config.value,
        'is_secret': config.is_secret,
        'updated_at': datetime.now(timezone.utc).isoformat(),
        'updated_by': current_user['id']
    }
    
    if existing:
        await db.admin_config.update_one(
            {'key_name': config.key_name},
            {'$set': config_doc}
        )
    else:
        config_doc['id'] = str(uuid.uuid4())
        config_doc['created_at'] = datetime.now(timezone.utc).isoformat()
        await db.admin_config.insert_one(config_doc)
    
    return {"message": "Config updated successfully"}

@api_router.delete("/admin/config/{key_name}")
async def delete_admin_config(key_name: str, current_user = Depends(get_current_user)):
    await require_sys_admin(current_user)
    
    result = await db.admin_config.delete_one({'key_name': key_name})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Config not found")
    
    return {"message": "Config deleted successfully"}

@api_router.post("/admin/make-admin/{user_id}")
async def make_sys_admin(user_id: str, current_user = Depends(get_current_user)):
    await require_sys_admin(current_user)
    
    user = await db.users.find_one({'id': user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = await db.sys_admins.find_one({'user_id': user_id})
    if existing:
        raise HTTPException(status_code=400, detail="User is already a system admin")
    
    admin_doc = {
        'id': str(uuid.uuid4()),
        'user_id': user_id,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'created_by': current_user['id']
    }
    
    await db.sys_admins.insert_one(admin_doc)
    
    return {"message": "User promoted to system admin"}

# ==================== DASHBOARD STATS ====================

@api_router.get("/organizations/{org_id}/stats")
async def get_org_stats(org_id: str, current_user = Depends(get_current_user)):
    role = await get_user_org_role(current_user['id'], org_id)
    if not role:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    
    total_tasks = await db.tasks.count_documents({'org_id': org_id})
    pending_tasks = await db.tasks.count_documents({'org_id': org_id, 'status': 'pending'})
    in_progress_tasks = await db.tasks.count_documents({'org_id': org_id, 'status': 'about_to_do'})
    completed_tasks = await db.tasks.count_documents({'org_id': org_id, 'status': 'completed'})
    
    my_tasks = await db.tasks.count_documents({'org_id': org_id, 'assigned_to': current_user['id']})
    
    members_count = await db.organization_members.count_documents({'org_id': org_id})
    
    return {
        'total_tasks': total_tasks,
        'pending_tasks': pending_tasks,
        'in_progress_tasks': in_progress_tasks,
        'completed_tasks': completed_tasks,
        'my_tasks': my_tasks,
        'members_count': members_count
    }

# Include router
app.include_router(api_router)

# Update CORS to allow specific origins
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://taskflow-2frontend.onrender.com"
]

# Add environment variable origins if present
env_origins = os.environ.get('CORS_ORIGINS')
if env_origins:
    origins.extend(env_origins.split(','))

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()