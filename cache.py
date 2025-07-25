"""
Enhanced in-memory cache for TTS audio responses with size limits and eviction policies
"""
import time
import hashlib
import logging
import asyncio
import threading
from typing import Dict, Any, Optional, Tuple, List, NamedTuple
from config import settings

class CacheItem(NamedTuple):
    """Represents a cached item with metadata for better management"""
    audio: bytes
    timestamp: float
    size: int
    model: str
    speaker_id: str
    access_count: int = 0
    last_access: float = 0

class TTSCache:
    """Enhanced in-memory cache for TTS audio responses with size limits and eviction policies"""
    
    def __init__(self):
        self.cache: Dict[str, CacheItem] = {}
        self.ttl = getattr(settings, 'cache_ttl', 3600)  # Default 1 hour
        self.enabled = getattr(settings, 'enable_caching', True)
        
        # Cache size limits
        self.max_items = getattr(settings, 'cache_max_items', 1000)
        self.max_size_bytes = getattr(settings, 'cache_max_size_mb', 500) * 1024 * 1024  # Convert MB to bytes
        
        # Eviction policy: 'lru' (least recently used), 'lfu' (least frequently used), 
        # 'fifo' (first in first out), or 'size' (largest items first)
        self.eviction_policy = getattr(settings, 'cache_eviction_policy', 'lru')
        
        # Cache statistics
        self.hits = 0
        self.misses = 0
        self.evictions = 0
        self.current_size_bytes = 0
        
        # Setup automatic cleanup
        self.cleanup_interval = getattr(settings, 'cache_cleanup_interval', 300)  # Default 5 minutes
        self.logger = logging.getLogger(__name__)
        
        # Start background cleanup if enabled
        if getattr(settings, 'cache_auto_cleanup', True):
            self._start_cleanup_task()
    
    def _generate_key(self, text: str, model: str, speaker_id: str) -> str:
        """Generate a unique cache key for a TTS request"""
        key_string = f"{text}|{model}|{speaker_id}"
        return hashlib.md5(key_string.encode()).hexdigest()
    
    def _start_cleanup_task(self):
        """Start background task for periodic cache cleanup"""
        def run_cleanup():
            while True:
                time.sleep(self.cleanup_interval)
                try:
                    removed = self.cleanup()
                    if removed > 0:
                        self.logger.info(f"Cache cleanup: removed {removed} expired items")
                except Exception as e:
                    self.logger.error(f"Error in cache cleanup: {e}")
        
        # Start cleanup in a daemon thread
        cleanup_thread = threading.Thread(target=run_cleanup, daemon=True)
        cleanup_thread.start()
        self.logger.info(f"Started cache cleanup thread with interval {self.cleanup_interval}s")
    
    def get(self, text: str, model: str, speaker_id: str) -> Optional[bytes]:
        """Get cached audio if available and not expired"""
        if not self.enabled:
            self.misses += 1
            return None
            
        key = self._generate_key(text, model, speaker_id)
        if key not in self.cache:
            self.misses += 1
            return None
        
        # Get cache item
        item = self.cache[key]
        now = time.time()
        
        # Check if expired
        if now - item.timestamp > self.ttl:
            # Cache expired
            self._remove_item(key)
            self.misses += 1
            return None
        
        # Update access statistics
        self.hits += 1
        self.cache[key] = item._replace(
            access_count=item.access_count + 1,
            last_access=now
        )
        
        return item.audio
    
    def set(self, text: str, model: str, speaker_id: str, audio: bytes) -> None:
        """Cache audio for a TTS request with size management"""
        if not self.enabled or not audio:
            return
        
        # Check if audio size exceeds individual item limit
        audio_size = len(audio)
        max_item_size = getattr(settings, 'cache_max_item_size_mb', 10) * 1024 * 1024
        if audio_size > max_item_size:
            self.logger.warning(
                f"Audio too large for cache: {audio_size / (1024*1024):.2f} MB "
                f"(limit: {max_item_size / (1024*1024):.2f} MB)"
            )
            return
            
        key = self._generate_key(text, model, speaker_id)
        now = time.time()
        
        # Create new cache item
        new_item = CacheItem(
            audio=audio,
            timestamp=now,
            size=audio_size,
            model=model,
            speaker_id=speaker_id,
            access_count=0,
            last_access=now
        )
        
        # If key already exists, update size tracking
        if key in self.cache:
            old_item = self.cache[key]
            self.current_size_bytes -= old_item.size
        
        # Check if we need to make room in the cache
        self._ensure_cache_size(audio_size)
        
        # Add new item and update size
        self.cache[key] = new_item
        self.current_size_bytes += audio_size
        
        # Log cache statistics periodically
        if len(self.cache) % 10 == 0:  # Log every 10 items
            self.logger.debug(
                f"Cache stats: {len(self.cache)} items, "
                f"{self.current_size_bytes / (1024*1024):.2f} MB used, "
                f"hit rate: {self.hits / max(1, self.hits + self.misses):.2f}"
            )
    
    def _ensure_cache_size(self, new_item_size: int) -> None:
        """Ensure cache has room for a new item by evicting items if necessary"""
        # Check if we need to evict by count
        while len(self.cache) >= self.max_items:
            self._evict_item()
        
        # Check if we need to evict by size
        while self.current_size_bytes + new_item_size > self.max_size_bytes and self.cache:
            self._evict_item()
    
    def _evict_item(self) -> None:
        """Evict an item based on the configured eviction policy"""
        if not self.cache:
            return
            
        key_to_evict = None
        
        if self.eviction_policy == 'lru':
            # Least Recently Used - evict item with oldest last_access
            key_to_evict = min(
                self.cache.items(), 
                key=lambda x: x[1].last_access
            )[0]
        elif self.eviction_policy == 'lfu':
            # Least Frequently Used - evict item with lowest access_count
            key_to_evict = min(
                self.cache.items(), 
                key=lambda x: x[1].access_count
            )[0]
        elif self.eviction_policy == 'fifo':
            # First In First Out - evict item with oldest timestamp
            key_to_evict = min(
                self.cache.items(), 
                key=lambda x: x[1].timestamp
            )[0]
        elif self.eviction_policy == 'size':
            # Largest Size First - evict largest item
            key_to_evict = max(
                self.cache.items(), 
                key=lambda x: x[1].size
            )[0]
        else:
            # Default to LRU if policy is invalid
            key_to_evict = min(
                self.cache.items(), 
                key=lambda x: x[1].last_access
            )[0]
        
        if key_to_evict:
            self._remove_item(key_to_evict, eviction=True)
    
    def _remove_item(self, key: str, eviction: bool = False) -> None:
        """Remove an item from the cache and update statistics"""
        if key in self.cache:
            item = self.cache[key]
            self.current_size_bytes -= item.size
            del self.cache[key]
            
            if eviction:
                self.evictions += 1
                if self.evictions % 10 == 0:  # Log every 10 evictions
                    self.logger.debug(
                        f"Cache eviction: {self.eviction_policy} policy, "
                        f"model: {item.model}, size: {item.size / 1024:.1f} KB, "
                        f"age: {(time.time() - item.timestamp) / 60:.1f} min"
                    )
    
    def clear(self) -> None:
        """Clear all cached items"""
        self.cache.clear()
        self.current_size_bytes = 0
        self.logger.info("Cache cleared")
    
    def cleanup(self) -> int:
        """Remove expired items and enforce size limits"""
        now = time.time()
        removed_count = 0
        
        # Remove expired items
        expired_keys = [
            key for key, item in self.cache.items() 
            if now - item.timestamp > self.ttl
        ]
        
        for key in expired_keys:
            self._remove_item(key)
            removed_count += 1
        
        # Enforce size limits
        while len(self.cache) > self.max_items:
            self._evict_item()
            removed_count += 1
            
        while self.current_size_bytes > self.max_size_bytes and self.cache:
            self._evict_item()
            removed_count += 1
            
        return removed_count
        
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        hit_rate = self.hits / max(1, self.hits + self.misses)
        
        # Count items by model
        model_counts = {}
        for item in self.cache.values():
            if item.model not in model_counts:
                model_counts[item.model] = 0
            model_counts[item.model] += 1
        
        return {
            "enabled": self.enabled,
            "items": len(self.cache),
            "max_items": self.max_items,
            "size_bytes": self.current_size_bytes,
            "max_size_bytes": self.max_size_bytes,
            "size_mb": self.current_size_bytes / (1024 * 1024),
            "max_size_mb": self.max_size_bytes / (1024 * 1024),
            "usage_percent": (self.current_size_bytes / max(1, self.max_size_bytes)) * 100,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": hit_rate,
            "evictions": self.evictions,
            "ttl_seconds": self.ttl,
            "eviction_policy": self.eviction_policy,
            "model_distribution": model_counts
        }

# Global cache instance
tts_cache = TTSCache()