"""
Enhanced resource management for TTS Server
"""
import asyncio
import time
import psutil
import logging
import os
import signal
from typing import Dict, Any, Optional, List, Callable, Awaitable
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from enum import Enum

from errors import SystemError, ErrorCode, error_handler


class ResourceStatus(str, Enum):
    """Resource availability status"""
    AVAILABLE = "available"
    LIMITED = "limited"
    EXHAUSTED = "exhausted"


@dataclass
class ResourceMetrics:
    """Current resource usage metrics"""
    cpu_percent: float
    memory_percent: float
    active_requests: int
    max_requests: int
    queue_size: int
    avg_response_time: float
    disk_usage_percent: float = 0.0
    open_file_descriptors: int = 0
    
    @property
    def status(self) -> ResourceStatus:
        """Determine overall resource status"""
        # Enhanced resource status determination with more metrics
        if (self.memory_percent > 90 or 
            self.cpu_percent > 95 or 
            self.disk_usage_percent > 95):
            return ResourceStatus.EXHAUSTED
        elif (self.memory_percent > 75 or 
              self.cpu_percent > 80 or 
              self.disk_usage_percent > 85 or
              self.active_requests >= self.max_requests * 0.9):
            return ResourceStatus.LIMITED
        else:
            return ResourceStatus.AVAILABLE


class AdaptiveSemaphore:
    """Adaptive semaphore that adjusts based on system load"""
    
    def __init__(self, initial_limit: int, min_limit: int = 1, max_limit: int = None):
        self.initial_limit = initial_limit
        self.min_limit = min_limit
        self.max_limit = max_limit or initial_limit * 2
        self.current_limit = initial_limit
        self._semaphore = asyncio.Semaphore(initial_limit)
        self._active_count = 0
        self._total_requests = 0
        self._total_time = 0.0
        self._last_adjustment = time.time()
        self.logger = logging.getLogger(__name__)
    
    async def acquire(self):
        """Acquire semaphore with adaptive behavior"""
        await self._semaphore.acquire()
        self._active_count += 1
        self._total_requests += 1
    
    def release(self):
        """Release semaphore"""
        self._semaphore.release()
        self._active_count = max(0, self._active_count - 1)
    
    def adjust_limit(self, system_metrics: ResourceMetrics):
        """Adjust semaphore limit based on system metrics"""
        now = time.time()
        
        # Only adjust every 30 seconds to avoid thrashing
        if now - self._last_adjustment < 30:
            return
        
        old_limit = self.current_limit
        
        if system_metrics.status == ResourceStatus.EXHAUSTED:
            # Reduce limit when resources are exhausted
            new_limit = max(self.min_limit, int(self.current_limit * 0.7))
        elif system_metrics.status == ResourceStatus.LIMITED:
            # Slightly reduce limit when resources are limited
            new_limit = max(self.min_limit, int(self.current_limit * 0.9))
        elif system_metrics.status == ResourceStatus.AVAILABLE and system_metrics.avg_response_time < 2.0:
            # Increase limit when resources are available and response time is good
            new_limit = min(self.max_limit, int(self.current_limit * 1.1))
        else:
            new_limit = self.current_limit
        
        if new_limit != old_limit:
            self._adjust_semaphore(new_limit)
            self.logger.info(f"Adjusted concurrent request limit from {old_limit} to {new_limit}")
            self._last_adjustment = now
    
    def _adjust_semaphore(self, new_limit: int):
        """Adjust the underlying semaphore"""
        difference = new_limit - self.current_limit
        
        if difference > 0:
            # Increase semaphore capacity
            for _ in range(difference):
                self._semaphore.release()
        elif difference < 0:
            # Decrease semaphore capacity (acquire without releasing)
            async def reduce_capacity():
                for _ in range(abs(difference)):
                    await self._semaphore.acquire()
            
            # Schedule the reduction
            asyncio.create_task(reduce_capacity())
        
        self.current_limit = new_limit
    
    @property
    def active_count(self) -> int:
        """Get current active request count"""
        return self._active_count
    
    @property
    def available_slots(self) -> int:
        """Get available semaphore slots"""
        return self.current_limit - self._active_count


@dataclass
class ProcessInfo:
    """Information about a running TTS process"""
    process: asyncio.subprocess.Process
    start_time: float
    correlation_id: str
    timeout: float
    model: str = ""
    text_length: int = 0

class ResourceManager:
    """Enhanced resource manager with monitoring and adaptive control"""
    
    def __init__(self, max_concurrent_requests: int, default_timeout: float = 30.0):
        self.max_concurrent_requests = max_concurrent_requests
        self.default_timeout = default_timeout
        self.semaphore = AdaptiveSemaphore(max_concurrent_requests)
        self.request_times = []
        self.logger = logging.getLogger(__name__)
        
        # Monitoring data
        self.start_time = time.time()
        self.total_requests = 0
        self.failed_requests = 0
        self.timeout_requests = 0
        
        # Process tracking for timeout management
        self.active_processes: Dict[str, ProcessInfo] = {}
        self.cleanup_task = None
        self.memory_monitor_task = None
        
        # Resource thresholds for adaptive behavior
        self.critical_memory_threshold = 90  # Percentage
        self.critical_cpu_threshold = 95     # Percentage
        self.warning_memory_threshold = 75   # Percentage
        self.warning_cpu_threshold = 80      # Percentage
        
        # Memory management
        self.temp_files: List[str] = []
        self.memory_check_interval = 60  # Check memory usage every 60 seconds
        self.temp_cleanup_interval = 300  # Clean temp files every 5 minutes
        self.last_temp_cleanup = time.time()
        self.memory_history = []  # Track memory usage over time
        self.max_memory_history_points = 60  # Keep last 60 data points
        
        # Start the monitoring tasks
        self._start_process_monitor()
        self._start_memory_monitor()
        
    def _start_memory_monitor(self):
        """Start the background task for monitoring memory usage"""
        async def monitor_memory():
            while True:
                try:
                    await self._check_memory_usage()
                    
                    # Periodically clean up temporary resources
                    now = time.time()
                    if now - self.last_temp_cleanup > self.temp_cleanup_interval:
                        await self._cleanup_temp_resources()
                        self.last_temp_cleanup = now
                        
                    await asyncio.sleep(self.memory_check_interval)
                except Exception as e:
                    self.logger.error(f"Error in memory monitor: {e}")
                    await asyncio.sleep(30)  # Back off on error
        
        self.memory_monitor_task = asyncio.create_task(monitor_memory())
        self.logger.info("Started memory monitoring task")
        
    async def _check_memory_usage(self):
        """Check memory usage and take action if needed"""
        try:
            # Get memory usage
            memory = psutil.virtual_memory()
            memory_percent = memory.percent
            
            # Record in history
            self.memory_history.append((time.time(), memory_percent))
            
            # Trim history if needed
            if len(self.memory_history) > self.max_memory_history_points:
                self.memory_history = self.memory_history[-self.max_memory_history_points:]
            
            # Log memory usage periodically
            if len(self.memory_history) % 10 == 0:
                self.logger.info(f"Memory usage: {memory_percent:.1f}%")
            
            # Take action if memory usage is too high
            if memory_percent > self.critical_memory_threshold:
                self.logger.warning(f"Critical memory usage: {memory_percent:.1f}%")
                await self._handle_high_memory_usage()
                
        except Exception as e:
            self.logger.error(f"Error checking memory usage: {e}")
    
    async def _handle_high_memory_usage(self):
        """Handle high memory usage situation"""
        # First try to clean up temporary resources
        await self._cleanup_temp_resources()
        
        # If we have active processes and memory is still high, terminate the longest running ones
        memory = psutil.virtual_memory()
        if memory.percent > self.critical_memory_threshold and self.active_processes:
            self.logger.warning("Memory still critical after cleanup, terminating long-running processes")
            await self._terminate_long_running_processes()
            
        # As a last resort, force Python garbage collection
        import gc
        gc.collect()
        self.logger.info("Forced garbage collection due to high memory usage")
    
    async def _cleanup_temp_resources(self):
        """Clean up temporary resources"""
        # Clean up temporary files
        removed_count = 0
        for temp_file in list(self.temp_files):
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
                    removed_count += 1
                self.temp_files.remove(temp_file)
            except Exception as e:
                self.logger.warning(f"Failed to remove temp file {temp_file}: {e}")
        
        if removed_count > 0:
            self.logger.info(f"Cleaned up {removed_count} temporary files")
        
        # Clean up request times list if it's too large
        if len(self.request_times) > 1000:
            self.request_times = self.request_times[-500:]
            self.logger.debug("Trimmed request times history")
        
        # Clean up cache if available
        try:
            from cache import tts_cache
            if hasattr(tts_cache, 'cleanup'):
                removed = tts_cache.cleanup()
                if removed > 0:
                    self.logger.info(f"Cache cleanup: removed {removed} expired items")
        except ImportError:
            pass
    
    def register_temp_file(self, file_path: str):
        """Register a temporary file for later cleanup"""
        if os.path.exists(file_path):
            self.temp_files.append(file_path)
            self.logger.debug(f"Registered temp file for cleanup: {file_path}")
        
    def _start_process_monitor(self):
        """Start the background task for monitoring processes"""
        async def monitor_processes():
            while True:
                try:
                    await self._check_process_timeouts()
                    await asyncio.sleep(1)  # Check every second
                except Exception as e:
                    self.logger.error(f"Error in process monitor: {e}")
                    await asyncio.sleep(5)  # Back off on error
        
        self.cleanup_task = asyncio.create_task(monitor_processes())
        
    async def _check_process_timeouts(self):
        """Check for processes that have exceeded their timeout"""
        now = time.time()
        timed_out_ids = []
        
        for correlation_id, process_info in self.active_processes.items():
            elapsed = now - process_info.start_time
            if elapsed > process_info.timeout:
                timed_out_ids.append(correlation_id)
                self.logger.warning(
                    f"Process timeout: {correlation_id}, model: {process_info.model}, "
                    f"elapsed: {elapsed:.2f}s, timeout: {process_info.timeout}s"
                )
                
                # Try to terminate the process
                try:
                    if process_info.process.returncode is None:
                        process_info.process.terminate()
                        self.timeout_requests += 1
                except Exception as e:
                    self.logger.error(f"Failed to terminate process {correlation_id}: {e}")
        
        # Remove timed out processes from tracking
        for correlation_id in timed_out_ids:
            self.active_processes.pop(correlation_id, None)
            
    async def register_process(
        self, 
        process: asyncio.subprocess.Process, 
        correlation_id: str, 
        timeout: float = None,
        model: str = "",
        text_length: int = 0
    ) -> None:
        """Register a TTS process for monitoring"""
        timeout = timeout or self.default_timeout
        self.active_processes[correlation_id] = ProcessInfo(
            process=process,
            start_time=time.time(),
            correlation_id=correlation_id,
            timeout=timeout,
            model=model,
            text_length=text_length
        )
        self.logger.debug(
            f"Registered process {correlation_id} with timeout {timeout}s, "
            f"model: {model}, text length: {text_length}"
        )
        
    def unregister_process(self, correlation_id: str) -> None:
        """Unregister a TTS process after completion"""
        if correlation_id in self.active_processes:
            self.active_processes.pop(correlation_id)
            self.logger.debug(f"Unregistered process {correlation_id}")
            
    async def terminate_all_processes(self, timeout: float = 5.0) -> None:
        """Terminate all active processes during shutdown"""
        if not self.active_processes:
            return
            
        self.logger.info(f"Terminating {len(self.active_processes)} active processes")
        
        # First try gentle termination
        for process_info in self.active_processes.values():
            if process_info.process.returncode is None:
                try:
                    process_info.process.terminate()
                except Exception as e:
                    self.logger.warning(f"Failed to terminate process: {e}")
                    
        # Wait for processes to terminate
        start_time = time.time()
        while self.active_processes and (time.time() - start_time) < timeout:
            # Check which processes have exited
            terminated = []
            for correlation_id, process_info in self.active_processes.items():
                if process_info.process.returncode is not None:
                    terminated.append(correlation_id)
                    
            # Remove terminated processes
            for correlation_id in terminated:
                self.active_processes.pop(correlation_id, None)
                
            if self.active_processes:
                await asyncio.sleep(0.5)
                
        # Force kill any remaining processes
        if self.active_processes:
            self.logger.warning(f"Force killing {len(self.active_processes)} processes that didn't terminate")
            for process_info in self.active_processes.values():
                if process_info.process.returncode is None:
                    try:
                        process_info.process.kill()
                    except Exception as e:
                        self.logger.error(f"Failed to kill process: {e}")
                        
        self.active_processes.clear()
        
    async def get_system_metrics(self) -> ResourceMetrics:
        """Get current system resource metrics"""
        try:
            cpu_percent = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            
            # Get disk usage for the current directory
            disk = psutil.disk_usage('/')
            disk_percent = disk.percent
            
            # Get open file descriptors (Linux only)
            try:
                open_fds = len(psutil.Process().open_files())
            except (AttributeError, psutil.AccessDenied, psutil.Error):
                open_fds = 0
            
            # Calculate average response time from recent requests
            recent_times = self.request_times[-100:] if self.request_times else [0]
            avg_response_time = sum(recent_times) / len(recent_times)
            
            return ResourceMetrics(
                cpu_percent=cpu_percent,
                memory_percent=memory.percent,
                active_requests=self.semaphore.active_count,
                max_requests=self.max_concurrent_requests,
                queue_size=max(0, self.total_requests - self.semaphore.active_count),
                avg_response_time=avg_response_time,
                disk_usage_percent=disk_percent,
                open_file_descriptors=open_fds
            )
        except Exception as e:
            self.logger.warning(f"Failed to get system metrics: {e}")
            # Return safe defaults
            return ResourceMetrics(
                cpu_percent=0,
                memory_percent=0,
                active_requests=self.semaphore.active_count,
                max_requests=self.max_concurrent_requests,
                queue_size=0,
                avg_response_time=1.0,
                disk_usage_percent=0,
                open_file_descriptors=0
            )
    
    @asynccontextmanager
    async def acquire_resource(self, timeout: Optional[float] = None, correlation_id: str = None, 
                              request_info: Optional[Dict[str, Any]] = None):
        """Acquire resource with timeout and monitoring"""
        timeout = timeout or self.default_timeout
        start_time = time.time()
        request_info = request_info or {}
        
        try:
            # Enhanced system overload check with more detailed metrics
            metrics = await self.get_system_metrics()
            
            # Implement graceful handling of resource exhaustion
            if metrics.status == ResourceStatus.EXHAUSTED:
                # Log detailed system state
                self.logger.warning(
                    f"System overloaded: CPU={metrics.cpu_percent:.1f}%, "
                    f"Memory={metrics.memory_percent:.1f}%, "
                    f"Disk={metrics.disk_usage_percent:.1f}%, "
                    f"Active requests={metrics.active_requests}/{self.max_concurrent_requests}"
                )
                
                # Try to recover by terminating long-running processes if we have any
                long_running_terminated = await self._terminate_long_running_processes()
                
                # If we couldn't free up resources, reject the request
                if not long_running_terminated and metrics.status == ResourceStatus.EXHAUSTED:
                    raise SystemError(
                        ErrorCode.SYSTEM_OVERLOAD,
                        "System is currently overloaded, please try again later",
                        system_info={
                            "cpu_percent": metrics.cpu_percent,
                            "memory_percent": metrics.memory_percent,
                            "disk_usage_percent": metrics.disk_usage_percent,
                            "active_requests": metrics.active_requests,
                            "retry_suggested": True,
                            "retry_after": 5  # Suggest client retry after 5 seconds
                        },
                        correlation_id=correlation_id
                    )
            
            # Acquire semaphore with configurable timeout
            try:
                # Use dynamic timeout based on system load
                adjusted_timeout = self._calculate_adjusted_timeout(timeout, metrics)
                
                self.logger.debug(
                    f"Attempting to acquire resource with timeout {adjusted_timeout:.1f}s "
                    f"(original: {timeout:.1f}s), correlation_id: {correlation_id}"
                )
                
                await asyncio.wait_for(self.semaphore.acquire(), timeout=adjusted_timeout)
            except asyncio.TimeoutError:
                self.timeout_requests += 1
                
                # Enhanced error with more context
                raise SystemError(
                    ErrorCode.RESOURCE_EXHAUSTED,
                    f"Resource acquisition timed out after {adjusted_timeout:.1f} seconds",
                    details={
                        "timeout": adjusted_timeout,
                        "original_timeout": timeout,
                        "active_requests": self.semaphore.active_count,
                        "system_status": metrics.status,
                        "retry_suggested": True,
                        "retry_after": 3  # Suggest client retry after 3 seconds
                    },
                    correlation_id=correlation_id
                )
            
            self.total_requests += 1
            
            try:
                yield
                
                # Record successful request time
                request_time = time.time() - start_time
                self.request_times.append(request_time)
                
                # Keep only recent request times for memory efficiency
                if len(self.request_times) > 1000:
                    self.request_times = self.request_times[-500:]
                
            except Exception as e:
                self.failed_requests += 1
                # Enhanced error logging with more context
                await error_handler.log_error(
                    SystemError(
                        ErrorCode.TTS_ENGINE_FAILED,
                        f"Request failed during execution: {str(e)}",
                        system_info={
                            "execution_time": time.time() - start_time,
                            "request_info": request_info
                        },
                        correlation_id=correlation_id,
                        original_error=e
                    )
                )
                raise
            
        finally:
            # Always release the semaphore
            self.semaphore.release()
            
            # Adjust semaphore based on current metrics
            try:
                current_metrics = await self.get_system_metrics()
                self.semaphore.adjust_limit(current_metrics)
            except Exception as e:
                self.logger.warning(f"Failed to adjust semaphore: {e}")
                
    def _calculate_adjusted_timeout(self, base_timeout: float, metrics: ResourceMetrics) -> float:
        """Calculate an adjusted timeout based on system load"""
        # If system is under heavy load, reduce timeout to prevent long queues
        if metrics.status == ResourceStatus.EXHAUSTED:
            return max(5.0, base_timeout * 0.5)  # At least 5 seconds, but reduced
        elif metrics.status == ResourceStatus.LIMITED:
            return max(10.0, base_timeout * 0.8)  # At least 10 seconds, slightly reduced
        else:
            return base_timeout  # Normal timeout when system is healthy
            
    async def _terminate_long_running_processes(self) -> bool:
        """Attempt to terminate long-running processes to free up resources"""
        if not self.active_processes:
            return False
            
        # Find processes running longer than 2x their expected timeout
        now = time.time()
        long_running = []
        
        for correlation_id, process_info in self.active_processes.items():
            elapsed = now - process_info.start_time
            if elapsed > (process_info.timeout * 2):
                long_running.append((correlation_id, process_info, elapsed))
                
        if not long_running:
            return False
            
        # Sort by longest running first
        long_running.sort(key=lambda x: x[2], reverse=True)
        
        # Terminate up to 2 longest running processes
        terminated_count = 0
        for correlation_id, process_info, elapsed in long_running[:2]:
            if process_info.process.returncode is None:
                try:
                    self.logger.warning(
                        f"Terminating long-running process {correlation_id}, "
                        f"running for {elapsed:.1f}s (timeout: {process_info.timeout:.1f}s)"
                    )
                    process_info.process.terminate()
                    self.active_processes.pop(correlation_id, None)
                    terminated_count += 1
                except Exception as e:
                    self.logger.error(f"Failed to terminate process {correlation_id}: {e}")
                    
        return terminated_count > 0
    
    async def graceful_shutdown(self, timeout: float = 30.0):
        """Gracefully shutdown by waiting for active requests to complete"""
        self.logger.info("Starting graceful shutdown...")
        start_time = time.time()
        
        # Cancel the process monitoring task if it's running
        if self.cleanup_task and not self.cleanup_task.done():
            self.logger.info("Cancelling process monitoring task")
            self.cleanup_task.cancel()
            try:
                await self.cleanup_task
            except asyncio.CancelledError:
                pass
        
        # First wait for active requests to complete naturally
        wait_time = min(timeout * 0.7, 20.0)  # Use 70% of timeout for graceful wait, max 20 seconds
        self.logger.info(f"Waiting up to {wait_time:.1f}s for active requests to complete naturally...")
        
        while self.semaphore.active_count > 0 and (time.time() - start_time) < wait_time:
            self.logger.info(f"Waiting for {self.semaphore.active_count} active requests to complete...")
            await asyncio.sleep(1)
        
        # If we still have active processes, terminate them
        if self.active_processes:
            remaining_timeout = timeout - (time.time() - start_time)
            if remaining_timeout > 0:
                self.logger.warning(
                    f"Terminating {len(self.active_processes)} remaining active processes "
                    f"with {remaining_timeout:.1f}s timeout"
                )
                await self.terminate_all_processes(timeout=remaining_timeout)
        
        # Final check
        if self.semaphore.active_count > 0:
            self.logger.warning(f"Shutdown timeout reached with {self.semaphore.active_count} active requests")
        else:
            self.logger.info("All requests completed, shutdown successful")
            
        # Log final statistics
        self.logger.info(
            f"Final statistics: total_requests={self.total_requests}, "
            f"failed_requests={self.failed_requests}, "
            f"timeout_requests={self.timeout_requests}"
        )
    
    def get_stats(self) -> Dict[str, Any]:
        """Get resource manager statistics"""
        uptime = time.time() - self.start_time
        success_rate = ((self.total_requests - self.failed_requests) / max(1, self.total_requests)) * 100
        
        # Enhanced statistics with more detailed information
        return {
            "uptime_seconds": uptime,
            "total_requests": self.total_requests,
            "failed_requests": self.failed_requests,
            "timeout_requests": self.timeout_requests,
            "success_rate_percent": success_rate,
            "active_requests": self.semaphore.active_count,
            "current_limit": self.semaphore.current_limit,
            "available_slots": self.semaphore.available_slots,
            "avg_response_time": sum(self.request_times[-100:]) / len(self.request_times[-100:]) if self.request_times else 0,
            "active_processes": len(self.active_processes),
            "min_response_time": min(self.request_times[-100:]) if self.request_times else 0,
            "max_response_time": max(self.request_times[-100:]) if self.request_times else 0,
            "semaphore_info": {
                "initial_limit": self.semaphore.initial_limit,
                "min_limit": self.semaphore.min_limit,
                "max_limit": self.semaphore.max_limit
            }
        }
        
    async def get_detailed_stats(self) -> Dict[str, Any]:
        """Get detailed resource manager statistics including system metrics"""
        basic_stats = self.get_stats()
        
        try:
            # Get current system metrics
            metrics = await self.get_system_metrics()
            
            # Get active process details
            active_process_details = []
            now = time.time()
            
            for correlation_id, process_info in self.active_processes.items():
                elapsed = now - process_info.start_time
                active_process_details.append({
                    "correlation_id": correlation_id,
                    "model": process_info.model,
                    "text_length": process_info.text_length,
                    "elapsed_seconds": elapsed,
                    "timeout": process_info.timeout,
                    "timeout_percent": (elapsed / process_info.timeout) * 100 if process_info.timeout > 0 else 0
                })
            
            # Combine all statistics
            return {
                **basic_stats,
                "system_metrics": {
                    "cpu_percent": metrics.cpu_percent,
                    "memory_percent": metrics.memory_percent,
                    "disk_usage_percent": metrics.disk_usage_percent,
                    "open_file_descriptors": metrics.open_file_descriptors,
                    "status": metrics.status
                },
                "active_processes_details": active_process_details,
                "resource_thresholds": {
                    "critical_memory_threshold": self.critical_memory_threshold,
                    "critical_cpu_threshold": self.critical_cpu_threshold,
                    "warning_memory_threshold": self.warning_memory_threshold,
                    "warning_cpu_threshold": self.warning_cpu_threshold
                }
            }
        except Exception as e:
            self.logger.warning(f"Failed to get detailed stats: {e}")
            return basic_stats


# Global resource manager instance (will be initialized in main app)
resource_manager: Optional[ResourceManager] = None


async def validate_system_resources() -> Dict[str, Any]:
    """Validate system resources and return validation results"""
    validation_results = {
        "passed": True,
        "warnings": [],
        "errors": [],
        "metrics": {}
    }
    
    try:
        # Check CPU count
        cpu_count = psutil.cpu_count()
        if cpu_count < 2:
            validation_results["warnings"].append(f"Only {cpu_count} CPU cores detected. Performance may be limited.")
        
        # Check available memory
        memory = psutil.virtual_memory()
        available_gb = memory.available / (1024 * 1024 * 1024)
        validation_results["metrics"]["available_memory_gb"] = round(available_gb, 2)
        
        if available_gb < 1.0:
            validation_results["errors"].append(f"Insufficient memory: {available_gb:.2f} GB available. At least 1 GB recommended.")
            validation_results["passed"] = False
        elif available_gb < 2.0:
            validation_results["warnings"].append(f"Low memory: {available_gb:.2f} GB available. At least 2 GB recommended.")
        
        # Check disk space
        disk = psutil.disk_usage('/')
        free_disk_gb = disk.free / (1024 * 1024 * 1024)
        validation_results["metrics"]["free_disk_gb"] = round(free_disk_gb, 2)
        
        if free_disk_gb < 1.0:
            validation_results["errors"].append(f"Insufficient disk space: {free_disk_gb:.2f} GB available. At least 1 GB recommended.")
            validation_results["passed"] = False
        elif free_disk_gb < 5.0:
            validation_results["warnings"].append(f"Low disk space: {free_disk_gb:.2f} GB available. At least 5 GB recommended.")
        
        # Check open file limits (Linux only)
        try:
            import resource as sys_resource
            soft_limit, hard_limit = sys_resource.getrlimit(sys_resource.RLIMIT_NOFILE)
            validation_results["metrics"]["max_open_files"] = soft_limit
            
            if soft_limit < 1024:
                validation_results["warnings"].append(f"Low file descriptor limit: {soft_limit}. At least 1024 recommended.")
        except (ImportError, AttributeError):
            # Not on Linux or resource module not available
            pass
            
        # Add CPU and memory usage
        validation_results["metrics"]["cpu_percent"] = psutil.cpu_percent(interval=0.1)
        validation_results["metrics"]["memory_percent"] = memory.percent
        
    except Exception as e:
        validation_results["errors"].append(f"Resource validation error: {str(e)}")
        validation_results["passed"] = False
        
    return validation_results

def initialize_resource_manager(max_concurrent_requests: int, default_timeout: float = 30.0):
    """Initialize the global resource manager"""
    global resource_manager
    resource_manager = ResourceManager(max_concurrent_requests, default_timeout)
    return resource_manager


def get_resource_manager() -> ResourceManager:
    """Get the global resource manager instance"""
    if resource_manager is None:
        raise RuntimeError("Resource manager not initialized. Call initialize_resource_manager() first.")
    return resource_manager