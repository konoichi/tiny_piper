# tts_server.py
"""
Version: 1.3.1
------------------------------
ID: NAVYYARD-TTS-SERVER-CLEANED-01
Beschreibung: Multi-Model, Multi-Speaker Piper TTS API.
FIX: Behebt einen kritischen Fehler im /tts-Endpunkt, bei dem das
piper-Kommando versehentlich zweimal aufgerufen wurde. Dies führte zu
unvorhersehbarem Verhalten, einschließlich doppelter Audio-Wiedergabe
und falschen Fehlermeldungen. Der Code wurde bereinigt und ruft den
Prozess jetzt nur noch einmal korrekt auf.

Autor: Stephan Wilkens / Abby-System
Stand: Juli 2025
"""
from fastapi import FastAPI, Request, BackgroundTasks, Response, HTTPException
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse, PlainTextResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
import asyncio
import subprocess
import os
import logging
import json
import uuid
import time
from typing import List, Dict, Optional
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from config import settings
from cache import tts_cache
from errors import (
    TTSBaseError, ModelError, RequestError, SystemError, ErrorCode, 
    error_handler
)
from resource_manager import initialize_resource_manager, get_resource_manager, ResourceStatus, validate_system_resources
import re

def find_first_with_ext(folder, ext):
    files = [f for f in os.listdir(folder) if f.endswith(ext)]
    return files[0] if files else None

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Piper TTS Service", 
    description="Multi-Model, Multi-Speaker Piper TTS API",
    version="2.0.0"
)

# Add rate limiting error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add request tracking middleware
@app.middleware("http")
async def request_tracking_middleware(request: Request, call_next):
    """Middleware to track request metrics and manage request context"""
    # Generate correlation ID for request tracking
    correlation_id = str(uuid.uuid4())
    
    # Set up request context with basic info
    set_request_context(
        correlation_id=correlation_id,
        endpoint=request.url.path,
        method=request.method,
        client_ip=str(request.client.host),
        user_agent=request.headers.get("user-agent", "unknown")
    )
    
    # Track request timing
    start_time = time.time()
    
    try:
        # Process the request
        response = await call_next(request)
        
        # Calculate request duration
        duration = time.time() - start_time
        
        # Add timing info to response headers
        response.headers["X-Request-Time"] = f"{duration:.3f}"
        response.headers["X-Correlation-ID"] = correlation_id
        
        # Log request completion
        logger.info(
            f"Request completed: {request.method} {request.url.path}",
            extra={
                "duration": duration,
                "status_code": response.status_code,
                "correlation_id": correlation_id
            }
        )
        
        return response
    except Exception as e:
        # Log unhandled exceptions
        logger.error(
            f"Unhandled exception in request: {str(e)}",
            exc_info=True,
            extra={"correlation_id": correlation_id}
        )
        raise
    finally:
        # Always clear request context
        clear_request_context()

# Add CORS middleware
if settings.enable_cors:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Configure structured logging
from structured_logging import setup_structured_logging, get_logger, set_request_context, clear_request_context

# Use JSON format in production, plain text in debug mode
setup_structured_logging(
    level=logging.DEBUG if settings.debug else logging.INFO,
    json_format=not settings.debug,
    log_file=getattr(settings, 'log_file', None)
)
logger = get_logger(__name__)

MODEL_DIR = settings.model_dir

# Initialize enhanced resource manager with configurable timeout from settings
initialize_resource_manager(
    max_concurrent_requests=settings.max_concurrent_requests, 
    default_timeout=getattr(settings, 'tts_process_timeout', 30.0)
)

# Add startup event to validate system resources
async def validate_models() -> Dict[str, Any]:
    """Validate TTS models and return validation results"""
    validation_results = {
        "passed": True,
        "warnings": [],
        "errors": [],
        "valid_models": [],
        "invalid_models": []
    }
    
    # Get all models
    models = await get_models()
    if not models:
        validation_results["errors"].append("No TTS models found! Server will not be able to process TTS requests.")
        validation_results["passed"] = False
        return validation_results
    
    # Validate each model
    for model in models:
        model_validation = await validate_single_model(model)
        
        if model_validation["passed"]:
            validation_results["valid_models"].append({
                "name": model,
                "speakers": model_validation.get("speakers", []),
                "has_json": model_validation.get("has_json", False),
                "has_demo": model_validation.get("has_demo", False)
            })
        else:
            validation_results["invalid_models"].append({
                "name": model,
                "errors": model_validation.get("errors", []),
                "warnings": model_validation.get("warnings", [])
            })
            
            # Add model-specific errors and warnings to the main results
            for error in model_validation.get("errors", []):
                validation_results["errors"].append(f"Model '{model}': {error}")
            
            for warning in model_validation.get("warnings", []):
                validation_results["warnings"].append(f"Model '{model}': {warning}")
    
    # Check if default model is valid
    from config import settings
    if settings.default_model not in [model["name"] for model in validation_results["valid_models"]]:
        validation_results["errors"].append(
            f"Default model '{settings.default_model}' is not valid or not found!"
        )
        validation_results["passed"] = False
    
    # Overall validation status
    if validation_results["errors"]:
        validation_results["passed"] = False
    
    return validation_results

async def validate_single_model(model: str) -> Dict[str, Any]:
    """Validate a single TTS model"""
    validation_results = {
        "passed": True,
        "warnings": [],
        "errors": [],
        "speakers": []
    }
    
    # Get model files
    files = await get_model_files(model)
    
    # Check if ONNX file exists
    if not files["onnx"] or not os.path.isfile(files["onnx"]):
        validation_results["errors"].append("ONNX file missing or invalid")
        validation_results["passed"] = False
    else:
        # Check ONNX file size
        try:
            onnx_size = os.path.getsize(files["onnx"]) / (1024 * 1024)  # Size in MB
            if onnx_size < 0.1:
                validation_results["errors"].append(f"ONNX file suspiciously small: {onnx_size:.2f} MB")
                validation_results["passed"] = False
        except Exception as e:
            validation_results["errors"].append(f"Failed to check ONNX file size: {str(e)}")
    
    # Check if JSON metadata file exists
    if not files["json"] or not os.path.isfile(files["json"]):
        validation_results["warnings"].append("JSON metadata file missing")
    else:
        validation_results["has_json"] = True
        # Validate JSON content
        try:
            with open(files["json"], "r", encoding="utf-8") as f:
                meta = json.load(f)
                
            # Check for required fields
            if "speaker_id_map" not in meta:
                validation_results["warnings"].append("JSON metadata missing speaker_id_map")
            else:
                speakers = list(meta["speaker_id_map"].values())
                validation_results["speakers"] = speakers
                
                # Check if default speaker exists
                from config import settings
                if settings.default_speaker not in meta["speaker_id_map"].keys():
                    validation_results["warnings"].append(
                        f"Default speaker '{settings.default_speaker}' not found in model"
                    )
        except json.JSONDecodeError:
            validation_results["errors"].append("JSON metadata file is not valid JSON")
            validation_results["passed"] = False
        except Exception as e:
            validation_results["errors"].append(f"Failed to validate JSON metadata: {str(e)}")
    
    # Check for demo file
    if files["demo"] and os.path.isfile(files["demo"]):
        validation_results["has_demo"] = True
    
    return validation_results

async def validate_configuration() -> Dict[str, Any]:
    """Validate server configuration"""
    validation_results = {
        "passed": True,
        "warnings": [],
        "errors": [],
        "config": {}
    }
    
    from config import settings
    
    # Add key configuration values to results
    validation_results["config"] = {
        "model_dir": settings.model_dir,
        "default_model": settings.default_model,
        "default_speaker": settings.default_speaker,
        "max_text_length": settings.max_text_length,
        "max_concurrent_requests": settings.max_concurrent_requests,
        "rate_limit_requests": settings.rate_limit_requests,
        "debug": settings.debug,
        "enable_cors": settings.enable_cors
    }
    
    # Validate model directory
    if not os.path.exists(settings.model_dir):
        validation_results["errors"].append(f"Model directory '{settings.model_dir}' does not exist")
        validation_results["passed"] = False
    elif not os.path.isdir(settings.model_dir):
        validation_results["errors"].append(f"Model directory path '{settings.model_dir}' is not a directory")
        validation_results["passed"] = False
    elif not os.access(settings.model_dir, os.R_OK):
        validation_results["errors"].append(f"Model directory '{settings.model_dir}' is not readable")
        validation_results["passed"] = False
    
    # Validate max_concurrent_requests
    if settings.max_concurrent_requests < 1:
        validation_results["errors"].append("max_concurrent_requests must be at least 1")
        validation_results["passed"] = False
    elif settings.max_concurrent_requests > 100:
        validation_results["warnings"].append(
            f"max_concurrent_requests is set very high ({settings.max_concurrent_requests}). "
            "This may cause system overload."
        )
    
    # Validate max_text_length
    if settings.max_text_length < 10:
        validation_results["warnings"].append(
            f"max_text_length is set very low ({settings.max_text_length}). "
            "This may restrict useful TTS generation."
        )
    elif settings.max_text_length > 5000:
        validation_results["warnings"].append(
            f"max_text_length is set very high ({settings.max_text_length}). "
            "This may cause memory issues with long texts."
        )
    
    # Check for Piper executable
    try:
        process = await asyncio.create_subprocess_exec(
            "piper", "--help",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()
        if process.returncode != 0:
            validation_results["errors"].append("Piper executable found but returned non-zero exit code")
            validation_results["passed"] = False
    except Exception:
        validation_results["errors"].append("Piper executable not found in PATH")
        validation_results["passed"] = False
    
    return validation_results

@app.on_event("startup")
async def startup_event():
    """Validate system resources, models, and configuration on startup"""
    logger.info("Starting TTS server and validating system...")
    
    # Validate system resources
    logger.info("Validating system resources...")
    resource_validation = await validate_system_resources()
    
    # Log validation results
    if resource_validation["passed"]:
        logger.info("System resource validation passed")
    else:
        logger.warning("System resource validation failed")
        
    for warning in resource_validation["warnings"]:
        logger.warning(f"Resource warning: {warning}")
        
    for error in resource_validation["errors"]:
        logger.error(f"Resource error: {error}")
        
    # Log system metrics
    metrics = resource_validation.get("metrics", {})
    logger.info(
        f"System metrics: CPU: {metrics.get('cpu_percent', 0)}%, "
        f"Memory: {metrics.get('memory_percent', 0)}%, "
        f"Available memory: {metrics.get('available_memory_gb', 0):.2f} GB, "
        f"Free disk: {metrics.get('free_disk_gb', 0):.2f} GB"
    )
    
    # Validate configuration
    logger.info("Validating configuration...")
    config_validation = await validate_configuration()
    
    if config_validation["passed"]:
        logger.info("Configuration validation passed")
    else:
        logger.warning("Configuration validation failed")
        
    for warning in config_validation["warnings"]:
        logger.warning(f"Configuration warning: {warning}")
        
    for error in config_validation["errors"]:
        logger.error(f"Configuration error: {error}")
    
    # Validate models
    logger.info("Validating TTS models...")
    model_validation = await validate_models()
    
    if model_validation["passed"]:
        logger.info(f"Model validation passed. Found {len(model_validation['valid_models'])} valid models.")
    else:
        logger.warning(f"Model validation failed. Found {len(model_validation['invalid_models'])} invalid models.")
        
    for warning in model_validation["warnings"]:
        logger.warning(f"Model warning: {warning}")
        
    for error in model_validation["errors"]:
        logger.error(f"Model error: {error}")
    
    # Log valid models
    if model_validation["valid_models"]:
        valid_model_names = [model["name"] for model in model_validation["valid_models"]]
        logger.info(f"Valid models: {', '.join(valid_model_names)}")
    else:
        logger.error("No valid TTS models found! Server will not be able to process TTS requests.")
        
    # Initialize resource manager metrics
    resource_manager = get_resource_manager()
    metrics = await resource_manager.get_system_metrics()
    logger.info(
        f"Initial resource metrics: CPU: {metrics.cpu_percent:.1f}%, "
        f"Memory: {metrics.memory_percent:.1f}%, "
        f"Disk: {metrics.disk_usage_percent:.1f}%"
    )
    
@app.on_event("shutdown")
async def shutdown_event():
    """Gracefully shutdown resources"""
    logger.info("Shutting down TTS server...")
    
    # Get resource manager and perform graceful shutdown
    resource_manager = get_resource_manager()
    
    # Log final statistics before shutdown
    try:
        stats = resource_manager.get_stats()
        logger.info(
            f"Final statistics: total_requests={stats['total_requests']}, "
            f"failed_requests={stats['failed_requests']}, "
            f"timeout_requests={stats['timeout_requests']}, "
            f"success_rate={stats['success_rate_percent']:.1f}%"
        )
    except Exception as e:
        logger.error(f"Error getting final statistics: {e}")
    
    # Perform graceful shutdown with timeout
    shutdown_timeout = getattr(settings, 'shutdown_timeout', 30.0)
    logger.info(f"Waiting up to {shutdown_timeout}s for active requests to complete...")
    
    try:
        await resource_manager.graceful_shutdown(timeout=shutdown_timeout)
        logger.info("Graceful shutdown completed")
    except Exception as e:
        logger.error(f"Error during graceful shutdown: {e}")
        
    logger.info("TTS server shutdown complete")

def sanitize_model_name(model: str) -> str:
    """Sanitize model name to prevent path traversal attacks"""
    # Remove any path separators and keep only alphanumeric, hyphens, underscores
    return re.sub(r'[^a-zA-Z0-9_-]', '', model)

async def get_models() -> List[str]:
    """Get list of available TTS models"""
    try:
        if not os.path.exists(MODEL_DIR):
            logger.warning(f"Model directory {MODEL_DIR} does not exist")
            return []
        
        models = []
        for d in os.listdir(MODEL_DIR):
            model_path = os.path.join(MODEL_DIR, d)
            if os.path.isdir(model_path) and find_first_with_ext(model_path, ".onnx"):
                models.append(d)
        return models
    except Exception as e:
        logger.error(f"Error getting models: {e}")
        return []

async def get_model_files(model: str) -> Dict[str, Optional[str]]:
    """Get file paths for a specific model"""
    sanitized_model = sanitize_model_name(model)
    model_dir = os.path.join(MODEL_DIR, sanitized_model)
    
    if not os.path.exists(model_dir):
        return {"onnx": None, "json": None, "card": None, "demo": None}
    
    onnx_file = find_first_with_ext(model_dir, ".onnx")
    json_file = find_first_with_ext(model_dir, ".onnx.json")
    card_file = find_first_with_ext(model_dir, ".md")
    demo_file = find_first_with_ext(model_dir, ".wav")
    
    return {
        "onnx": os.path.join(model_dir, onnx_file) if onnx_file else None,
        "json": os.path.join(model_dir, json_file) if json_file else None,
        "card": os.path.join(model_dir, card_file) if card_file else None,
        "demo": os.path.join(model_dir, demo_file) if demo_file else None,
    }

async def get_speakers_for_model(model: str) -> tuple[List[str], List[str]]:
    """Get available speakers for a model"""
    files = await get_model_files(model)
    json_path = files["json"]
    
    if not json_path or not os.path.isfile(json_path):
        return [], []
    
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
            if "speaker_id_map" in meta:
                return list(meta["speaker_id_map"].values()), list(meta["speaker_id_map"].keys())
            return [], []
    except Exception as e:
        logger.error(f"Error reading model metadata for {model}: {e}")
        return [], []

@app.get("/health", tags=["Service"])
@limiter.limit(f"{settings.rate_limit_requests}/minute")
async def health(request: Request):
    """Health check endpoint"""
    models_count = len(await get_models())
    
    # Basic health check with minimal information
    return {
        "status": "ok", 
        "version": "2.0.0", 
        "models_available": models_count
    }
    
@app.get("/health/detailed", tags=["Service"])
@limiter.limit(f"{settings.rate_limit_requests}/minute")
async def health_detailed(request: Request):
    """Detailed health check with resource metrics"""
    resource_manager = get_resource_manager()
    detailed_stats = await resource_manager.get_detailed_stats()
    models_count = len(await get_models())
    
    # Determine overall system status
    system_metrics = detailed_stats.get("system_metrics", {})
    status = "ok"
    
    if system_metrics.get("status") == ResourceStatus.EXHAUSTED:
        status = "overloaded"
    elif system_metrics.get("status") == ResourceStatus.LIMITED:
        status = "limited"
    
    return {
        "status": status,
        "version": "2.0.0",
        "models_available": models_count,
        "uptime_seconds": detailed_stats.get("uptime_seconds", 0),
        "resource_metrics": {
            "cpu_percent": system_metrics.get("cpu_percent", 0),
            "memory_percent": system_metrics.get("memory_percent", 0),
            "disk_usage_percent": system_metrics.get("disk_usage_percent", 0),
            "active_requests": detailed_stats.get("active_requests", 0),
            "max_concurrent_requests": detailed_stats.get("current_limit", 0),
            "available_slots": detailed_stats.get("available_slots", 0)
        },
        "request_metrics": {
            "total_requests": detailed_stats.get("total_requests", 0),
            "failed_requests": detailed_stats.get("failed_requests", 0),
            "timeout_requests": detailed_stats.get("timeout_requests", 0),
            "success_rate_percent": detailed_stats.get("success_rate_percent", 100),
            "avg_response_time": detailed_stats.get("avg_response_time", 0),
            "active_processes": detailed_stats.get("active_processes", 0)
        }
    }

@app.get("/metrics", tags=["Monitoring"])
@limiter.limit(f"{settings.rate_limit_requests}/minute")
async def metrics(request: Request):
    """Comprehensive metrics endpoint for monitoring systems"""
    resource_manager = get_resource_manager()
    detailed_stats = await resource_manager.get_detailed_stats()
    
    # Get cache statistics if available
    cache_stats = {}
    try:
        from cache import tts_cache
        if hasattr(tts_cache, 'get_stats'):
            cache_stats = tts_cache.get_stats()
    except ImportError:
        pass
    
    # Get error statistics
    from errors import error_handler
    error_stats = error_handler.get_error_stats()
    
    # Get model usage statistics
    models = await get_models()
    model_stats = {}
    
    for model in models:
        speakers, _ = await get_speakers_for_model(model)
        model_stats[model] = {
            "speakers_count": len(speakers),
            "speakers": speakers
        }
    
    # Build comprehensive metrics response
    return {
        "timestamp": time.time(),
        "version": "2.0.0",
        "uptime_seconds": detailed_stats.get("uptime_seconds", 0),
        
        # System metrics
        "system": {
            "cpu_percent": detailed_stats.get("system_metrics", {}).get("cpu_percent", 0),
            "memory_percent": detailed_stats.get("system_metrics", {}).get("memory_percent", 0),
            "disk_usage_percent": detailed_stats.get("system_metrics", {}).get("disk_usage_percent", 0),
            "open_file_descriptors": detailed_stats.get("system_metrics", {}).get("open_file_descriptors", 0),
            "status": str(detailed_stats.get("system_metrics", {}).get("status", "unknown"))
        },
        
        # Request metrics
        "requests": {
            "total": detailed_stats.get("total_requests", 0),
            "failed": detailed_stats.get("failed_requests", 0),
            "timeouts": detailed_stats.get("timeout_requests", 0),
            "success_rate": detailed_stats.get("success_rate_percent", 100),
            "active": detailed_stats.get("active_requests", 0),
            "limit": detailed_stats.get("current_limit", 0),
            "available_slots": detailed_stats.get("available_slots", 0)
        },
        
        # Performance metrics
        "performance": {
            "avg_response_time_seconds": detailed_stats.get("avg_response_time", 0),
            "min_response_time_seconds": detailed_stats.get("min_response_time", 0),
            "max_response_time_seconds": detailed_stats.get("max_response_time", 0),
            "active_processes": detailed_stats.get("active_processes", 0),
            "process_details": detailed_stats.get("active_processes_details", [])
        },
        
        # Cache metrics
        "cache": cache_stats,
        
        # Error metrics
        "errors": {
            "total": error_stats.get("total_errors", 0),
            "by_code": error_stats.get("errors_by_code", {}),
            "last_minute": error_stats.get("errors_last_minute", 0),
            "last_hour": error_stats.get("errors_last_hour", 0)
        },
        
        # Model metrics
        "models": {
            "available_count": len(models),
            "models": model_stats
        }
    }

@app.get("/metrics/prometheus", tags=["Monitoring"], response_class=PlainTextResponse)
@limiter.limit(f"{settings.rate_limit_requests}/minute")
async def prometheus_metrics(request: Request):
    """Prometheus-compatible metrics endpoint"""
    resource_manager = get_resource_manager()
    detailed_stats = await resource_manager.get_detailed_stats()
    
    # Build Prometheus-compatible metrics
    lines = [
        "# HELP tts_uptime_seconds Total uptime of the TTS server",
        "# TYPE tts_uptime_seconds counter",
        f"tts_uptime_seconds {detailed_stats.get('uptime_seconds', 0)}",
        
        "# HELP tts_cpu_usage_percent Current CPU usage percentage",
        "# TYPE tts_cpu_usage_percent gauge",
        f"tts_cpu_usage_percent {detailed_stats.get('system_metrics', {}).get('cpu_percent', 0)}",
        
        "# HELP tts_memory_usage_percent Current memory usage percentage",
        "# TYPE tts_memory_usage_percent gauge",
        f"tts_memory_usage_percent {detailed_stats.get('system_metrics', {}).get('memory_percent', 0)}",
        
        "# HELP tts_disk_usage_percent Current disk usage percentage",
        "# TYPE tts_disk_usage_percent gauge",
        f"tts_disk_usage_percent {detailed_stats.get('system_metrics', {}).get('disk_usage_percent', 0)}",
        
        "# HELP tts_requests_total Total number of TTS requests",
        "# TYPE tts_requests_total counter",
        f"tts_requests_total {detailed_stats.get('total_requests', 0)}",
        
        "# HELP tts_requests_failed Total number of failed TTS requests",
        "# TYPE tts_requests_failed counter",
        f"tts_requests_failed {detailed_stats.get('failed_requests', 0)}",
        
        "# HELP tts_requests_timeout Total number of timed out TTS requests",
        "# TYPE tts_requests_timeout counter",
        f"tts_requests_timeout {detailed_stats.get('timeout_requests', 0)}",
        
        "# HELP tts_requests_active Current number of active TTS requests",
        "# TYPE tts_requests_active gauge",
        f"tts_requests_active {detailed_stats.get('active_requests', 0)}",
        
        "# HELP tts_response_time_seconds Average response time in seconds",
        "# TYPE tts_response_time_seconds gauge",
        f"tts_response_time_seconds {detailed_stats.get('avg_response_time', 0)}",
        
        "# HELP tts_models_available Number of available TTS models",
        "# TYPE tts_models_available gauge",
        f"tts_models_available {len(await get_models())}"
    ]
    
    # Add cache metrics if available
    try:
        from cache import tts_cache
        if hasattr(tts_cache, 'get_stats'):
            cache_stats = tts_cache.get_stats()
            lines.extend([
                "# HELP tts_cache_items Number of items in the TTS cache",
                "# TYPE tts_cache_items gauge",
                f"tts_cache_items {cache_stats.get('items', 0)}",
                
                "# HELP tts_cache_hit_rate Cache hit rate",
                "# TYPE tts_cache_hit_rate gauge",
                f"tts_cache_hit_rate {cache_stats.get('hit_rate', 0)}",
                
                "# HELP tts_cache_size_bytes Cache size in bytes",
                "# TYPE tts_cache_size_bytes gauge",
                f"tts_cache_size_bytes {cache_stats.get('size_bytes', 0)}"
            ])
    except ImportError:
        pass
    
    # Add error metrics
    from errors import error_handler
    error_stats = error_handler.get_error_stats()
    lines.extend([
        "# HELP tts_errors_total Total number of errors",
        "# TYPE tts_errors_total counter",
        f"tts_errors_total {error_stats.get('total_errors', 0)}",
        
        "# HELP tts_errors_last_minute Errors in the last minute",
        "# TYPE tts_errors_last_minute gauge",
        f"tts_errors_last_minute {error_stats.get('errors_last_minute', 0)}"
    ])
    
    # Return Prometheus-compatible metrics
    return "\n".join(lines)

@app.get("/info", tags=["Service"])
@limiter.limit(f"{settings.rate_limit_requests}/minute")
async def info(request: Request):
    """Service information endpoint"""
    models = await get_models()
    return {
        "service": "Piper TTS", 
        "version": "2.0.0",
        "models": models, 
        "api": "/docs",
        "settings": {
            "max_text_length": settings.max_text_length,
            "max_concurrent_requests": settings.max_concurrent_requests
        }
    }

@app.get("/voices", tags=["Models"])
@limiter.limit(f"{settings.rate_limit_requests}/minute")
async def voices(request: Request):
    """Get all available voices and their speakers"""
    result = {}
    models = await get_models()
    
    for model in models:
        files = await get_model_files(model)
        idx_list, name_list = await get_speakers_for_model(model)
        card_url = f"/model_card/{model}" if files["card"] else None
        demo_url = f"/demo/{model}" if files["demo"] else None
        result[model] = {
            "speakers": [{"index": str(idx), "id": name} for idx, name in zip(idx_list, name_list)],
            "model_card": card_url,
            "demo": demo_url,
        }
    return result

@app.get("/model_card/{model}", tags=["Models"])
@limiter.limit(f"{settings.rate_limit_requests}/minute")
async def model_card(request: Request, model: str):
    """Get model card/documentation"""
    sanitized_model = sanitize_model_name(model)
    files = await get_model_files(sanitized_model)
    
    if not files["card"] or not os.path.isfile(files["card"]):
        raise HTTPException(status_code=404, detail="No model card found")
    
    return FileResponse(files["card"], media_type="text/markdown")

@app.get("/demo/{model}/raw", tags=["Models"])
@limiter.limit(f"{settings.rate_limit_requests}/minute")
async def demo_raw(request: Request, model: str):
    """Get demo audio for a model"""
    sanitized_model = sanitize_model_name(model)
    files = await get_model_files(sanitized_model)
    
    if not files["demo"] or not os.path.isfile(files["demo"]):
        raise HTTPException(status_code=404, detail="No demo audio found")
    
    return FileResponse(files["demo"], media_type="audio/wav")

class TTSRequest(BaseModel):
    text: str
    model: str = settings.default_model
    speaker_id: str = settings.default_speaker
    
    @validator('text')
    def validate_text(cls, v):
        if not v or not v.strip():
            raise ValueError('Text cannot be empty')
        if len(v) > settings.max_text_length:
            raise ValueError(f'Text too long (max {settings.max_text_length} characters)')
        # Basic XSS prevention
        if '<' in v or '>' in v:
            raise ValueError('HTML tags not allowed in text')
        return v.strip()
    
    @validator('model')
    def validate_model(cls, v):
        # Sanitize model name
        sanitized = sanitize_model_name(v)
        if not sanitized:
            raise ValueError('Invalid model name')
        return sanitized
    
    @validator('speaker_id')
    def validate_speaker_id(cls, v):
        # Ensure speaker_id is numeric string
        if not v.isdigit():
            raise ValueError('Speaker ID must be numeric')
        return v

@app.post("/tts", tags=["TTS"])
@limiter.limit("10/minute")  # Stricter limit for TTS generation
async def tts(request: Request, req: TTSRequest):
    """Generate speech from text using Piper TTS"""
    # Generate correlation ID and set up structured logging context
    correlation_id = str(uuid.uuid4())
    set_request_context(
        correlation_id=correlation_id,
        endpoint="/tts",
        model=req.model,
        speaker_id=req.speaker_id,
        text_length=len(req.text),
        client_ip=str(request.client.host),
        user_agent=request.headers.get("user-agent", "unknown")
    )
    
    try:
        # Extract request parameters first
        text = req.text
        model = req.model
        speaker_id = req.speaker_id
        
        # Use enhanced resource manager for concurrency control with request info
        request_info = {
            "model": model,
            "speaker_id": speaker_id,
            "text_length": len(text),
            "endpoint": "/tts"
        }
        async with get_resource_manager().acquire_resource(
            correlation_id=correlation_id,
            request_info=request_info
        ):
            
            # Check cache first if enabled
            cached_audio = tts_cache.get(text, model, speaker_id)
            if cached_audio:
                logger.info(f"Cache hit for TTS request: Model={model}, Speaker={speaker_id}, Text length={len(text)}")
                return Response(
                    content=cached_audio,
                    media_type="audio/wav",
                    headers={
                        "Content-Disposition": f"attachment; filename=tts_{model}_{speaker_id}.wav",
                        "Content-Length": str(len(cached_audio)),
                        "X-Cache": "HIT",
                        "X-Correlation-ID": correlation_id
                    }
                )
            
            # Get model files with async call
            files = await get_model_files(model)
            model_path = files["onnx"]
            
            # Validate model exists
            if not model_path or not os.path.isfile(model_path):
                raise ModelError(
                    ErrorCode.MODEL_NOT_FOUND,
                    f"Model '{model}' not found or .onnx file missing",
                    model_name=model,
                    correlation_id=correlation_id
                )
            
            # Validate speaker exists for this model
            _, speaker_ids = await get_speakers_for_model(model)
            if speaker_ids and speaker_id not in speaker_ids:
                raise RequestError(
                    ErrorCode.SPEAKER_NOT_FOUND,
                    f"Speaker ID '{speaker_id}' not available for model '{model}'",
                    request_data={
                        "model": model,
                        "speaker_id": speaker_id,
                        "available_speakers": speaker_ids
                    },
                    correlation_id=correlation_id
                )
            
            logger.info(f"TTS request: Model={model}, Speaker={speaker_id}, Text length={len(text)}, Correlation ID={correlation_id}")
            
            # Prepare Piper command
            cmd = ["piper", "-m", model_path, "--speaker", speaker_id]
            
            try:
                # Get configurable timeouts from settings or use defaults
                process_start_timeout = getattr(settings, 'process_start_timeout', 30.0)
                process_execution_timeout = getattr(settings, 'process_execution_timeout', 25.0)
                
                # Calculate dynamic timeout based on text length
                # Longer text needs more time to process
                text_length_factor = max(1.0, min(3.0, len(text) / 500))
                adjusted_execution_timeout = process_execution_timeout * text_length_factor
                
                # Optimize process execution based on system load
                resource_manager = get_resource_manager()
                metrics = await resource_manager.get_system_metrics()
                
                # Adjust timeouts based on system load
                if metrics.status == ResourceStatus.LIMITED:
                    # Increase timeouts when system is under load
                    process_start_timeout *= 1.5
                    adjusted_execution_timeout *= 1.5
                    logger.debug("Increased timeouts due to limited system resources")
                elif metrics.status == ResourceStatus.EXHAUSTED:
                    # Significantly increase timeouts when system is overloaded
                    process_start_timeout *= 2.0
                    adjusted_execution_timeout *= 2.0
                    logger.debug("Significantly increased timeouts due to exhausted system resources")
                    
                # Optimize batch processing - if we have multiple requests for the same model,
                # try to process them more efficiently by adjusting priorities
                active_processes_for_model = sum(
                    1 for p in resource_manager.active_processes.values() 
                    if p.model == model
                )
                if active_processes_for_model > 2:
                    logger.debug(f"High load for model {model}: {active_processes_for_model} active processes")
                
                logger.debug(
                    f"Starting TTS process with timeouts: start={process_start_timeout}s, "
                    f"execution={adjusted_execution_timeout}s (text length: {len(text)})"
                )
                
                # Optimize process creation for high concurrency
                # Use lower priority for TTS processes to prevent system overload
                try:
                    # Run Piper asynchronously with timeout and optimized settings
                    process = await asyncio.wait_for(
                        asyncio.create_subprocess_exec(
                            *cmd,
                            stdin=asyncio.subprocess.PIPE,
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE,
                            # Set lower process priority (nice value)
                            preexec_fn=lambda: os.nice(10) if hasattr(os, 'nice') else None
                        ),
                        timeout=process_start_timeout
                    )
                except asyncio.TimeoutError:
                    logger.warning(f"Process creation timed out after {process_start_timeout}s")
                    raise SystemError(
                        ErrorCode.TTS_TIMEOUT,
                        f"TTS process creation timed out after {process_start_timeout}s",
                        details={"timeout_seconds": process_start_timeout},
                        correlation_id=correlation_id
                    )
                
                # Register process with resource manager for monitoring
                resource_manager = get_resource_manager()
                await resource_manager.register_process(
                    process=process,
                    correlation_id=correlation_id,
                    timeout=adjusted_execution_timeout,
                    model=model,
                    text_length=len(text)
                )
                
                # Send text and get audio output with timeout
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(input=text.encode('utf-8')),
                    timeout=adjusted_execution_timeout
                )
                
                # Unregister process after completion
                resource_manager.unregister_process(correlation_id)
                
                if process.returncode != 0:
                    error_msg = stderr.decode('utf-8', errors='ignore')
                    raise SystemError(
                        ErrorCode.TTS_ENGINE_FAILED,
                        f"TTS generation failed: {error_msg}",
                        system_info={
                            "return_code": process.returncode,
                            "stderr": error_msg,
                            "command": cmd
                        },
                        correlation_id=correlation_id
                    )
                
                if not stdout:
                    raise SystemError(
                        ErrorCode.TTS_ENGINE_FAILED,
                        "TTS generation produced no audio output",
                        correlation_id=correlation_id
                    )
                
                # Store in cache for future requests
                tts_cache.set(text, model, speaker_id, stdout)
                
                logger.info(f"TTS generation successful: {len(stdout)} bytes generated, Correlation ID={correlation_id}")
                
                # Return audio with proper headers
                return Response(
                    content=stdout,
                    media_type="audio/wav",
                    headers={
                        "Content-Disposition": f"attachment; filename=tts_{model}_{speaker_id}.wav",
                        "Content-Length": str(len(stdout)),
                        "X-Cache": "MISS",
                        "X-Correlation-ID": correlation_id
                    }
                )
                
            except asyncio.TimeoutError:
                raise SystemError(
                    ErrorCode.TTS_TIMEOUT,
                    "TTS generation timed out",
                    details={"timeout_seconds": 30},
                    correlation_id=correlation_id
                )
            except FileNotFoundError:
                raise SystemError(
                    ErrorCode.DEPENDENCY_MISSING,
                    "Piper TTS engine not installed or not in PATH",
                    details={"dependency": "piper"},
                    correlation_id=correlation_id
                )
            except Exception as e:
                raise SystemError(
                    ErrorCode.TTS_ENGINE_FAILED,
                    f"Unexpected error during TTS generation: {str(e)}",
                    correlation_id=correlation_id,
                    original_error=e
                )
    
    except TTSBaseError as e:
        # Handle our custom errors
        await error_handler.handle_with_recovery(e, {
            "endpoint": "/tts",
            "request_data": req.dict(),
            "correlation_id": correlation_id
        })
        # Convert to HTTP exception
        if isinstance(e, ModelError):
            raise e.to_http_exception(404)
        elif isinstance(e, RequestError):
            raise e.to_http_exception(400)
        else:
            raise e.to_http_exception(500)
    
    except Exception as e:
        # Handle unexpected errors
        system_error = SystemError(
            ErrorCode.TTS_ENGINE_FAILED,
            f"Unexpected server error: {str(e)}",
            correlation_id=correlation_id,
            original_error=e
        )
        await error_handler.handle_with_recovery(system_error)
        raise system_error.to_http_exception(500)
