import logging
import json
from datetime import datetime

class JsonFormatter(logging.Formatter):
    def mask_pii(self, text):
        import re
        # Mask phone numbers: +91 98765 43210 -> +91 98765 XXXXX
        text = re.sub(r'(\+91\s?\d{5})\s?\d{5}', r'\1 XXXXX', text)
        # Mask UPI IDs: user@upi -> u***@upi
        text = re.sub(r'([a-zA-Z0-9])[a-zA-Z0-9._-]*(@[a-zA-Z]+)', r'\1***\2', text)
        return text

    def format(self, record):
        message = record.getMessage()
        masked_message = self.mask_pii(message)
        
        log_entry = {
            "timestamp": datetime.utcfromtimestamp(record.created).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": masked_message,
            "request_id": getattr(record, "request_id", None)
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)

def setup_production_logging():
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    
    logger = logging.getLogger("drishyam")
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)
    
    # Also capture uvicorn access logs
    uvicorn_logger = logging.getLogger("uvicorn.access")
    uvicorn_logger.handlers = [handler]
