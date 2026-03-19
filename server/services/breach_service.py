import requests
import time
import hashlib
from datetime import datetime, timedelta
from flask import current_app
from pymongo.errors import PyMongoError
from services.audit_service import log_audit_event
from config import HIBP_PWNED_PASSWORDS_URL, HIBP_RATE_LIMIT_DELAY
from services.socketio_instance import notify_user
from db.redis_client import redis_client

class BreachService:
    def __init__(self):
        self.pwned_passwords_url = HIBP_PWNED_PASSWORDS_URL
        self.rate_limit_delay = HIBP_RATE_LIMIT_DELAY
        self.last_request_time = 0

    def _rate_limit(self):
        """Ensure we don't exceed API rate limits GLOBALLY across all AWS servers"""
        
        if not redis_client:
            current_time = time.time()
            time_since_last_request = current_time - self.last_request_time
            if time_since_last_request < self.rate_limit_delay:
                time.sleep(self.rate_limit_delay - time_since_last_request)
            self.last_request_time = time.time()
            return

        delay_ms = int(self.rate_limit_delay * 1000)
        
        while True:
            lock_acquired = redis_client.set("hibp_api_lock", "locked", nx=True, px=delay_ms)
            
            if lock_acquired:
                break
            
            time.sleep(0.1)

    def check_password_breach(self, password):
        """Check if a password has been compromised using HIBP's free Pwned Passwords API"""
        try:
            sha1_hash = hashlib.sha1(password.encode('utf-8')).hexdigest().upper()
            prefix = sha1_hash[:5]
            suffix = sha1_hash[5:]
            
            self._rate_limit()
            
            response = requests.get(f"{self.pwned_passwords_url}/{prefix}", timeout=10)
            
            if response.status_code == 200:
                hashes = (line.split(':') for line in response.text.splitlines())
                for hash_suffix, count in hashes:
                    if hash_suffix == suffix:
                        return {
                            "is_breached": True,
                            "breach_count": int(count),
                            "message": f"Password has been found in {count} data breaches"
                        }
                
                return {
                    "is_breached": False,
                    "breach_count": 0,
                    "message": "Password has not been found in any known data breaches"
                }
            else:
                return {"error": f"API error: {response.status_code}"}, response.status_code
                
        except requests.exceptions.RequestException as e:
            return {"error": f"Network error: {str(e)}"}, 500
        except Exception as e:
            return {"error": f"Error checking password: {str(e)}"}, 500


    def check_email_breaches(self, email):
        return [], 200

    def store_breach_data(self, user_email, email_address, breach_data):
        """Store breach data in the database for the user"""
        db = current_app.db
        
        try:
            existing = db.breach_data.find_one({
                "userEmail": user_email,
                "emailAddress": email_address
            })
            
            if existing:
                db.breach_data.update_one(
                    {"userEmail": user_email, "emailAddress": email_address},
                    {
                        "$set": {
                            "breaches": breach_data,
                            "lastChecked": datetime.utcnow(),
                            "updatedAt": datetime.utcnow()
                        }
                    }
                )
            else:
                breach_record = {
                    "userEmail": user_email,
                    "emailAddress": email_address,
                    "breaches": breach_data,
                    "lastChecked": datetime.utcnow(),
                    "createdAt": datetime.utcnow(),
                    "updatedAt": datetime.utcnow()
                }
                db.breach_data.insert_one(breach_record)
            
            log_audit_event(user_email, f"breach_check_completed:{email_address}")
            return {"message": "Breach data stored successfully"}, 200
            
        except PyMongoError as e:
            return {"error": "Database error"}, 500

    def store_password_breach_data(self, user_email, site, username, breach_data):
        """Store password breach data in the database for the user"""
        db = current_app.db
        
        try:
            existing = db.password_breach_data.find_one({
                "userEmail": user_email,
                "site": site,
                "username": username
            })
            
            if existing:
                db.password_breach_data.update_one(
                    {"userEmail": user_email, "site": site, "username": username},
                    {
                        "$set": {
                            "breachData": breach_data,
                            "lastChecked": datetime.utcnow(),
                            "updatedAt": datetime.utcnow()
                        }
                    }
                )
            else:
                breach_record = {
                    "userEmail": user_email,
                    "site": site,
                    "username": username,
                    "breachData": breach_data,
                    "lastChecked": datetime.utcnow(),
                    "createdAt": datetime.utcnow(),
                    "updatedAt": datetime.utcnow()
                }
                db.password_breach_data.insert_one(breach_record)
            
            log_audit_event(user_email, f"password_breach_check_completed:{site}:{username}")
            
            # Send real-time socket alert if a breach is detected
            if breach_data.get("is_breached"):
                print(f"Alerting user {user_email} about breach on {site}")
                notify_user(user_email, "security_alert", {
                    "type": "BREACH_DETECTED",
                    "site": site,
                    "username": username,
                    "message": f"Critical: Your password for {site} was found in {breach_data.get('breach_count')} data breaches!"
                })

            return {"message": "Password breach data stored successfully"}, 200
            
        except PyMongoError as e:
            return {"error": "Database error"}, 500

    def get_user_breach_data(self, user_email):
        db = current_app.db
        
        try:
            breach_records = list(db.breach_data.find({"userEmail": user_email}))
            
            result = []
            for record in breach_records:
                email_data = {
                    "emailAddress": record["emailAddress"],
                    "lastChecked": record["lastChecked"].isoformat(),
                    "breachCount": len(record["breaches"]),
                    "breaches": record["breaches"]
                }
                result.append(email_data)
            
            return result, 200
            
        except PyMongoError as e:
            return {"error": "Database error"}, 500

    def get_user_password_breach_data(self, user_email):
        """Get all password breach data for a user"""
        db = current_app.db
        
        try:
            breach_records = list(db.password_breach_data.find({"userEmail": user_email}))
            
            result = []
            for record in breach_records:
                password_data = {
                    "site": record["site"],
                    "username": record["username"],
                    "lastChecked": record["lastChecked"].isoformat(),
                    "breachData": record["breachData"]
                }
                result.append(password_data)
            
            return result, 200
            
        except PyMongoError as e:
            return {"error": "Database error"}, 500

    def check_all_user_emails(self, user_email, email_addresses):
        if not email_addresses:
            return {"error": "No email addresses provided"}, 400
        
        results = []
        errors = []
        
        for email in email_addresses:
            breach_data, status_code = self.check_email_breaches(email)
            
            if status_code == 200:
                store_result, store_status = self.store_breach_data(user_email, email, breach_data)
                
                if store_status == 200:
                    results.append({
                        "email": email,
                        "breachCount": len(breach_data) if isinstance(breach_data, list) else 0,
                        "breaches": breach_data if isinstance(breach_data, list) else []
                    })
                else:
                    errors.append(f"Failed to store data for {email}")
            else:
                errors.append(f"Failed to check {email}: {breach_data.get('error', 'Unknown error')}")
        
        return {
            "results": results,
            "errors": errors,
            "totalChecked": len(email_addresses),
            "successfulChecks": len(results)
        }, 200

    def check_vault_passwords(self, user_email, vault_entries):
        if not vault_entries:
            return {"error": "No vault entries provided"}, 400
        
        results = []
        errors = []
        
        for entry in vault_entries:
            try:
                results.append({
                    "site": entry.get("site", ""),
                    "username": entry.get("username", ""),
                    "message": "Password breach checking requires decryption - implement in vault service"
                })
            except Exception as e:
                errors.append(f"Failed to check password for {entry.get('site', 'unknown')}: {str(e)}")
        
        return {
            "results": results,
            "errors": errors,
            "totalChecked": len(vault_entries),
            "successfulChecks": len(results)
        }, 200

breach_service = BreachService()
