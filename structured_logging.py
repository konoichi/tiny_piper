"""
Structured logging configuration for TTS Server
"""
import logging
import json
import time
import uuid
import os
from typing import Dict, Any, Optional

class StructuredLogFormatter(logging.Formatter):
    """Formatter that outputs JSON formatted logs"""
    
    def __init__(self, include_timestamp: bool = True):
        super().__init__()
        self.include_timestamp = include_timestamp
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON"""
        log_data = {
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "path": record.pathname,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add timestamp
        if self.include_timestamp:
            log_data["timestamp"] = int(record.created)
            log_data["time"] = time.strftime(
                "%Y-%m-%d %H:%M:%S", time.localtime(record.created)
            )
        
        # Add exception info if available
        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": self.formatException(record.exc_info)
            }
        
        # Add extra fields from the record
        if hasattr(record, "extra"):
            log_data.update(record.extra)
        
        # Add any extra attributes that were passed via kwargs
        for key, value in record.__dict__.items():
            if key not in ["args", "asctime", "created", "exc_info", "exc_text", 
                          "filename", "funcName", "id", "levelname", "levelno", 
                          "lineno", "module", "msecs", "message", "msg", "name", 
                          "pathname", "process", "processName", "relativeCreated", 
                          "stack_info", "thread", "threadName", "extra"]:
                log_data[key] = value
        
        return json.dumps(log_data)

def setup_structured_logging(
    level: int = logging.INFO,
    json_format: bool = True,
    log_file: Optional[str] = None
) -> None:
    """Configure structured logging for the application"""
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Create console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(level)
    
    if json_format:
        formatter = StructuredLogFormatter()
    else:
        formatter = logging.Formatter(
            "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        )
    
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # Add file handler if specified
    if log_file:
        os.makedirs(os.path.dirname(log_file), exist_ok=True)
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

class RequestContextFilter(logging.Filter):
    """Filter that adds request context to log records"""
    
    def __init__(self):
        super().__init__()
        self.context = {}
    
    def filter(self, record):
        """Add request context to log record"""
        for key, value in self.context.items():
            setattr(record, key, value)
        return True

# Global request context filter
request_context = RequestContextFilter()

def set_request_context(correlation_id: Optional[str] = None, **kwargs) -> str:
    """Set context for the current request"""
    if correlation_id is None:
        correlation_id = str(uuid.uuid4())
    
    request_context.context = {
        "correlation_id": correlation_id,
        "request_time": time.time(),
        **kwargs
    }
    
    return correlation_id

def clear_request_context() -> None:
    """Clear the current request context"""
    request_context.context = {}

def get_logger(name: str) -> logging.Logger:
    """Get a logger with the request context filter"""
    logger = logging.getLogger(name)
    
    # Add request context filter if not already added
    for handler in logger.handlers + logging.getLogger().handlers:
        if not any(isinstance(f, RequestContextFilter) for f in handler.filters):
            handler.addFilter(request_context)
    
    return logger