"""
Enhanced error handling and recovery for TTS Server
"""
import logging
import traceback
import time
import random
import psutil
from typing import Optional, Dict, Any
from enum import Enum
from fastapi import HTTPException
from pydantic import BaseModel


class ErrorCode(str, Enum):
    """Standardized error codes for the TTS system"""
    # Model-related errors
    MODEL_NOT_FOUND = "MODEL_NOT_FOUND"
    MODEL_INVALID = "MODEL_INVALID"
    MODEL_LOAD_FAILED = "MODEL_LOAD_FAILED"
    SPEAKER_NOT_FOUND = "SPEAKER_NOT_FOUND"
    
    # Request-related errors
    INVALID_TEXT = "INVALID_TEXT"
    TEXT_TOO_LONG = "TEXT_TOO_LONG"
    INVALID_SPEAKER_ID = "INVALID_SPEAKER_ID"
    INVALID_MODEL_NAME = "INVALID_MODEL_NAME"
    
    # System-related errors
    RESOURCE_EXHAUSTED = "RESOURCE_EXHAUSTED"
    TTS_ENGINE_FAILED = "TTS_ENGINE_FAILED"
    TTS_TIMEOUT = "TTS_TIMEOUT"
    CACHE_ERROR = "CACHE_ERROR"
    SYSTEM_OVERLOAD = "SYSTEM_OVERLOAD"
    
    # Configuration errors
    CONFIG_INVALID = "CONFIG_INVALID"
    DEPENDENCY_MISSING = "DEPENDENCY_MISSING"
    STARTUP_FAILED = "STARTUP_FAILED"


class ErrorDetail(BaseModel):
    """Structured error detail information"""
    code: ErrorCode
    message: str
    details: Optional[Dict[str, Any]] = None
    help_url: Optional[str] = None
    correlation_id: Optional[str] = None


class TTSBaseError(Exception):
    """Base class for all TTS-related errors"""
    
    def __init__(
        self, 
        code: ErrorCode, 
        message: str, 
        details: Optional[Dict[str, Any]] = None,
        help_url: Optional[str] = None,
        correlation_id: Optional[str] = None,
        original_error: Optional[Exception] = None
    ):
        self.code = code
        self.message = message
        self.details = details or {}
        self.help_url = help_url
        self.correlation_id = correlation_id
        self.original_error = original_error
        super().__init__(message)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary for API responses"""
        return {
            "error": {
                "code": self.code.value,
                "message": self.message,
                "details": self.details,
                "help_url": self.help_url,
                "correlation_id": self.correlation_id
            }
        }
    
    def to_http_exception(self, status_code: int = 500) -> HTTPException:
        """Convert to FastAPI HTTPException"""
        return HTTPException(
            status_code=status_code,
            detail=self.to_dict()["error"]
        )


class ModelError(TTSBaseError):
    """Errors related to TTS models"""
    
    def __init__(self, code: ErrorCode, message: str, model_name: str = None, **kwargs):
        details = kwargs.get('details', {})
        if model_name:
            details['model_name'] = model_name
        kwargs['details'] = details
        super().__init__(code, message, **kwargs)


class RequestError(TTSBaseError):
    """Errors in request processing"""
    
    def __init__(self, code: ErrorCode, message: str, request_data: Dict[str, Any] = None, **kwargs):
        details = kwargs.get('details', {})
        if request_data:
            # Sanitize request data for logging (remove sensitive info)
            sanitized_data = {k: v for k, v in request_data.items() if k not in ['password', 'token']}
            details['request_data'] = sanitized_data
        kwargs['details'] = details
        super().__init__(code, message, **kwargs)


class SystemError(TTSBaseError):
    """Internal system errors"""
    
    def __init__(self, code: ErrorCode, message: str, system_info: Dict[str, Any] = None, **kwargs):
        details = kwargs.get('details', {})
        if system_info:
            details['system_info'] = system_info
        kwargs['details'] = details
        super().__init__(code, message, **kwargs)


class ConfigurationError(TTSBaseError):
    """Configuration and startup errors"""
    
    def __init__(self, code: ErrorCode, message: str, config_key: str = None, **kwargs):
        details = kwargs.get('details', {})
        if config_key:
            details['config_key'] = config_key
        kwargs['details'] = details
        super().__init__(code, message, **kwargs)


class ErrorHandler:
    """Enhanced error handler with logging and recovery strategies"""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self.error_counts = {}
        self.recovery_strategies = {}
        self.error_history = []  # Store recent errors for analysis
        self.max_error_history = 100  # Maximum number of errors to keep in history
        
    async def log_error(
        self, 
        error: TTSBaseError, 
        context: Optional[Dict[str, Any]] = None,
        include_traceback: bool = True
    ):
        """Log error with structured information and enhanced context"""
        # Enhance context with additional system information
        enhanced_context = context or {}
        
        # Add timestamp
        timestamp = time.time()
        enhanced_context["timestamp"] = timestamp
        enhanced_context["formatted_time"] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(timestamp))
        
        # Add process information
        try:
            process = psutil.Process()
            enhanced_context["process_info"] = {
                "pid": process.pid,
                "memory_percent": process.memory_percent(),
                "cpu_percent": process.cpu_percent(interval=0.1),
                "threads": len(process.threads()),
                "open_files": len(process.open_files()) if hasattr(process, "open_files") else "N/A"
            }
        except Exception:
            pass  # Ignore errors in gathering process info
            
        # Create structured log data
        log_data = {
            "error_code": error.code.value,
            "error_message": error.message,
            "error_details": error.details,
            "correlation_id": error.correlation_id,
            "context": enhanced_context
        }
        
        # Include original error traceback if available
        if error.original_error and include_traceback:
            log_data["original_traceback"] = traceback.format_exception(
                type(error.original_error),
                error.original_error,
                error.original_error.__traceback__
            )
            
            # Add original error type and message
            log_data["original_error_type"] = type(error.original_error).__name__
            log_data["original_error_message"] = str(error.original_error)
        
        # Log at appropriate level based on error type and severity
        if isinstance(error, ModelError):
            if error.code in [ErrorCode.MODEL_NOT_FOUND, ErrorCode.SPEAKER_NOT_FOUND]:
                self.logger.warning(f"TTS Model Error: {error.code.value}", extra=log_data)
            else:
                self.logger.error(f"TTS Model Error: {error.code.value}", extra=log_data)
        elif isinstance(error, RequestError):
            self.logger.warning(f"TTS Request Error: {error.code.value}", extra=log_data)
        elif isinstance(error, SystemError):
            if error.code in [ErrorCode.RESOURCE_EXHAUSTED, ErrorCode.SYSTEM_OVERLOAD]:
                self.logger.warning(f"TTS System Error: {error.code.value}", extra=log_data)
            else:
                self.logger.error(f"TTS System Error: {error.code.value}", extra=log_data)
        elif isinstance(error, ConfigurationError):
            self.logger.error(f"TTS Configuration Error: {error.code.value}", extra=log_data)
        else:
            self.logger.error(f"TTS Error: {error.code.value}", extra=log_data)
        
        # Track error frequency for monitoring
        self._track_error(error.code)
        
        # Add to error history for analysis
        self._add_to_error_history(error, enhanced_context)
    
    def _track_error(self, error_code: ErrorCode):
        """Track error frequency for monitoring"""
        if error_code not in self.error_counts:
            self.error_counts[error_code] = 0
        self.error_counts[error_code] += 1
    
    def _add_to_error_history(self, error: TTSBaseError, context: Dict[str, Any]):
        """Add error to history for analysis and pattern detection"""
        self.error_history.append({
            "timestamp": time.time(),
            "error_code": error.code.value,
            "correlation_id": error.correlation_id,
            "context": {k: v for k, v in context.items() if k != "process_info"}  # Exclude process info to save space
        })
        
        # Trim history if it gets too large
        if len(self.error_history) > self.max_error_history:
            self.error_history = self.error_history[-self.max_error_history:]
    
    def get_error_stats(self) -> Dict[str, Any]:
        """Get enhanced error statistics for monitoring"""
        # Count errors by type
        error_types = {}
        for error in self.error_history:
            error_type = error["error_code"]
            if error_type not in error_types:
                error_types[error_type] = 0
            error_types[error_type] += 1
        
        # Calculate error rate over time
        now = time.time()
        errors_last_minute = sum(1 for e in self.error_history if now - e["timestamp"] < 60)
        errors_last_hour = sum(1 for e in self.error_history if now - e["timestamp"] < 3600)
        
        return {
            "total_errors": sum(self.error_counts.values()),
            "errors_by_code": self.error_counts.copy(),
            "errors_last_minute": errors_last_minute,
            "errors_last_hour": errors_last_hour,
            "error_types": error_types,
            "recent_errors": len(self.error_history)
        }
    
    def register_recovery_strategy(self, error_code: ErrorCode, strategy_func):
        """Register a recovery strategy for specific error types"""
        self.recovery_strategies[error_code] = strategy_func
    
    async def handle_with_recovery(self, error: TTSBaseError, context: Dict[str, Any] = None):
        """Handle error with potential recovery strategy and graceful degradation"""
        await self.log_error(error, context)
        
        # Try recovery strategy if available
        if error.code in self.recovery_strategies:
            try:
                recovery_result = await self.recovery_strategies[error.code](error, context)
                if recovery_result:
                    self.logger.info(f"Successfully recovered from error: {error.code.value}")
                    return recovery_result
            except Exception as recovery_error:
                self.logger.error(
                    f"Recovery strategy failed for {error.code.value}: {recovery_error}",
                    exc_info=True
                )
        
        # Apply graceful degradation strategies based on error type
        try:
            degraded_result = await self._apply_degradation_strategy(error, context)
            if degraded_result:
                self.logger.info(f"Applied graceful degradation for error: {error.code.value}")
                return degraded_result
        except Exception as degradation_error:
            self.logger.error(
                f"Degradation strategy failed for {error.code.value}: {degradation_error}",
                exc_info=True
            )
        
        # If no recovery or degradation worked, raise the original error
        raise error
        
    async def _apply_degradation_strategy(self, error: TTSBaseError, context: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """Apply graceful degradation strategies based on error type"""
        context = context or {}
        
        # Model errors - try fallback to simpler model
        if isinstance(error, ModelError) and error.code == ErrorCode.MODEL_LOAD_FAILED:
            from config import settings
            if context.get("requested_model") != settings.default_model:
                return {
                    'fallback_model': settings.default_model,
                    'message': f'Model failed to load, using default model {settings.default_model} instead',
                    'degraded': True
                }
        
        # System overload - suggest retry with backoff
        elif isinstance(error, SystemError) and error.code in [ErrorCode.SYSTEM_OVERLOAD, ErrorCode.RESOURCE_EXHAUSTED]:
            retry_count = context.get('retry_count', 0)
            if retry_count < 3:  # Allow up to 3 retries
                backoff_time = (2 ** retry_count) + (random.random() * 2)  # Exponential backoff with jitter
                return {
                    'retry_after': backoff_time,
                    'retry_count': retry_count + 1,
                    'message': f'System busy, retry suggested after {backoff_time:.1f} seconds',
                    'degraded': True
                }
        
        # TTS engine failures - try with simpler text
        elif isinstance(error, SystemError) and error.code == ErrorCode.TTS_ENGINE_FAILED:
            if 'text' in context and len(context['text']) > 100:
                # Try with shorter text
                shortened_text = context['text'][:100] + "..."
                return {
                    'shortened_text': shortened_text,
                    'message': 'Using shortened text due to TTS engine failure',
                    'degraded': True
                }
                
        return None


# Recovery strategies
async def model_not_found_recovery(error: TTSBaseError, context: Dict[str, Any]):
    """Recovery strategy for missing models - try default model"""
    from config import settings
    
    if context and 'requested_model' in context:
        requested_model = context['requested_model']
        if requested_model != settings.default_model:
            return {
                'fallback_model': settings.default_model,
                'message': f'Model {requested_model} not found, using default model {settings.default_model}'
            }
    return None


async def resource_exhausted_recovery(error: TTSBaseError, context: Dict[str, Any]):
    """Recovery strategy for resource exhaustion - implement backoff"""
    import asyncio
    
    # Simple exponential backoff
    backoff_time = context.get('retry_count', 0) * 2 + 1
    if backoff_time <= 8:  # Max 8 seconds backoff
        await asyncio.sleep(backoff_time)
        return {'retry_after': backoff_time}
    return None


# Global error handler instance
error_handler = ErrorHandler(logging.getLogger(__name__))

# Register default recovery strategies
error_handler.register_recovery_strategy(ErrorCode.MODEL_NOT_FOUND, model_not_found_recovery)
error_handler.register_recovery_strategy(ErrorCode.RESOURCE_EXHAUSTED, resource_exhausted_recovery)