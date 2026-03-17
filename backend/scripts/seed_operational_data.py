import sys
import os
import random
import uuid
import datetime
from sqlalchemy.orm import Session

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from core.database import SessionLocal, engine, ensure_schema_compliance
from models.database import Base, User, UserRole, SuspiciousNumber, HoneypotEntity, TrustLink, SystemStat, ScamCluster

def seed_data():
    # Ensure schema is up to date
    print("Ensuring schema compliance...")
    ensure_schema_compliance()
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("--- [STARTING OPERATIONAL SEEDING] ---")
        
        # 1. Citizen Accounts (A3)
        print("Creating citizen accounts...")
        citizen_count = db.query(User).filter(User.role == UserRole.COMMON.value).count()
        if citizen_count < 5:
            for i in range(5 - citizen_count):
                u = User(
                    username=f"citizen_{i+1}",
                    phone_number=f"+9198765432{i+1}",
                    email=f"citizen_{i+1}@example.in",
                    hashed_password="hashed_placeholder", # Not used for demo logic usually
                    full_name=f"Test Citizen {i+1}",
                    role=UserRole.COMMON.value
                )
                db.add(u)
            db.commit()
            print(f"Added {5 - citizen_count} citizen accounts.")
        
        primary_user = db.query(User).filter(User.username == "citizen_1").first()
        
        # 2. Family Trust Circle (A3)
        if primary_user:
            existing_link = db.query(TrustLink).filter(TrustLink.user_id == primary_user.id).first()
            if not existing_link:
                tl = TrustLink(
                    user_id=primary_user.id,
                    guardian_name="Suresh Kumar",
                    guardian_phone="+919988776655",
                    relation_type="Son"
                )
                db.add(tl)
                db.commit()
                print(f"Family Trust Circle configured for {primary_user.username}")

        # 3. Fraud Entities (A3 - 100 entities)
        print("Seeding fraud entities...")
        entity_count = db.query(SuspiciousNumber).count()
        if entity_count < 100:
            for i in range(100 - entity_count):
                num = f"+919000{random.randint(100000, 999999)}"
                sn = SuspiciousNumber(
                    phone_number=num,
                    reputation_score=random.uniform(0.7, 1.0),
                    category=random.choice(["banking_scam", "job_scam", "upi_trap"]),
                    report_count=random.randint(5, 50)
                )
                db.add(sn)
            db.commit()
            print(f"Added {100 - entity_count} fraud entities.")

        # 4. Test Scammer Phone & UPI (A3)
        test_scammer_num = "+919000123456"
        existing_scammer = db.query(SuspiciousNumber).filter(SuspiciousNumber.phone_number == test_scammer_num).first()
        if not existing_scammer:
            db.add(SuspiciousNumber(
                phone_number=test_scammer_num,
                reputation_score=1.0,
                category="demo_scammer",
                report_count=99
            ))
            print(f"Test scammer phone {test_scammer_num} added.")

        test_upi = "testscammer@paytm"
        existing_upi = db.query(HoneypotEntity).filter(HoneypotEntity.entity_value == test_upi).first()
        if not existing_upi:
            db.add(HoneypotEntity(
                entity_type="VPA",
                entity_value=test_upi,
                risk_score=1.0
            ))
            print(f"Test scammer UPI {test_upi} added.")

        # 5. Scam Weather & Festival Data (A3)
        weather_stat = db.query(SystemStat).filter(SystemStat.category == "weather", SystemStat.key == "threat_level").first()
        if not weather_stat:
            db.add(SystemStat(
                category="weather",
                key="threat_level",
                value="HIGH",
                metadata_json={"reason": "Festival Season Spike", "region": "North India"}
            ))
            print("Scam weather data seeded.")

        fest_stat = db.query(SystemStat).filter(SystemStat.category == "calendar", SystemStat.key == "is_festival").first()
        if not fest_stat:
            db.add(SystemStat(
                category="calendar",
                key="is_festival",
                value="True",
                metadata_json={"festival": "Diwali Pre-surge"}
            ))
            print("Festival calendar data seeded.")

        db.commit()
        print("--- [SEEDING COMPLETE] ---")
        
    except Exception as e:
        db.rollback()
        print(f"Seeding Error: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
