#!/usr/bin/env python3
"""
Load testing script for TTS Server
"""
import asyncio
import aiohttp
import argparse
import time
import json
import random
import statistics
from typing import List, Dict, Any, Optional
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Sample texts for testing with different lengths
SAMPLE_TEXTS = [
    "This is a short test sentence.",  # Short
    "This is a medium length test sentence that has more words than the short one.",  # Medium
    "This is a longer test sentence that contains multiple clauses and should take more time to process than the shorter examples because it has significantly more words and complexity.",  # Long
    "This is a very long test sentence that contains multiple clauses and should take even more time to process than the previous examples because it has significantly more words and complexity. It also includes additional phrases to make it longer and test the system's ability to handle lengthy inputs efficiently.",  # Very long
]

class LoadTester:
    """Load testing client for TTS Server"""
    
    def __init__(
        self, 
        base_url: str, 
        concurrency: int = 5,
        total_requests: int = 100,
        ramp_up: int = 5,
        timeout: int = 60,
        model: Optional[str] = None,
        speaker_id: Optional[str] = None
    ):
        self.base_url = base_url
        self.concurrency = concurrency
        self.total_requests = total_requests
        self.ramp_up = ramp_up
        self.timeout = timeout
        self.model = model
        self.speaker_id = speaker_id
        
        # Results tracking
        self.response_times: List[float] = []
        self.error_count = 0
        self.success_count = 0
        self.start_time = 0
        self.end_time = 0
        self.status_codes: Dict[int, int] = {}
        self.errors: Dict[str, int] = {}
        
    async def get_available_models(self) -> Dict[str, Any]:
        """Get available models from the server"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/voices", timeout=10) as response:
                    if response.status == 200:
                        return await response.json()
                    else:
                        logger.error(f"Failed to get models: {response.status}")
                        return {}
        except Exception as e:
            logger.error(f"Error getting models: {e}")
            return {}
    
    async def run_test(self):
        """Run the load test"""
        logger.info(f"Starting load test against {self.base_url}")
        logger.info(f"Concurrency: {self.concurrency}, Total requests: {self.total_requests}")
        
        # Get available models if not specified
        if not self.model or not self.speaker_id:
            voices = await self.get_available_models()
            if not voices:
                logger.error("Failed to get available models. Exiting.")
                return
                
            # Select first available model and speaker
            if not self.model:
                self.model = list(voices.keys())[0]
                
            if not self.speaker_id:
                speakers = voices.get(self.model, {}).get("speakers", [])
                if speakers:
                    self.speaker_id = speakers[0].get("index", "0")
                else:
                    self.speaker_id = "0"
                    
            logger.info(f"Using model: {self.model}, speaker: {self.speaker_id}")
        
        # Create semaphore to limit concurrency
        semaphore = asyncio.Semaphore(self.concurrency)
        
        # Create tasks
        self.start_time = time.time()
        tasks = []
        for i in range(self.total_requests):
            # Apply ramp-up delay if specified
            if self.ramp_up > 0:
                delay = (i / self.total_requests) * self.ramp_up
                await asyncio.sleep(delay)
                
            # Create task
            task = asyncio.create_task(self._make_request(i, semaphore))
            tasks.append(task)
            
        # Wait for all tasks to complete
        await asyncio.gather(*tasks)
        self.end_time = time.time()
        
        # Print results
        self._print_results()
    
    async def _make_request(self, request_id: int, semaphore: asyncio.Semaphore):
        """Make a single TTS request"""
        # Select random text
        text = random.choice(SAMPLE_TEXTS)
        
        # Prepare request data
        data = {
            "text": text,
            "model": self.model,
            "speaker_id": self.speaker_id
        }
        
        # Acquire semaphore to limit concurrency
        async with semaphore:
            start_time = time.time()
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        f"{self.base_url}/tts",
                        json=data,
                        timeout=self.timeout
                    ) as response:
                        # Record response time
                        response_time = time.time() - start_time
                        self.response_times.append(response_time)
                        
                        # Record status code
                        status = response.status
                        if status not in self.status_codes:
                            self.status_codes[status] = 0
                        self.status_codes[status] += 1
                        
                        # Check if successful
                        if 200 <= status < 300:
                            self.success_count += 1
                            # Read response to ensure it's complete
                            await response.read()
                            if request_id % 10 == 0:  # Log every 10th request
                                logger.info(f"Request {request_id} completed in {response_time:.2f}s")
                        else:
                            self.error_count += 1
                            error_text = await response.text()
                            error_key = f"HTTP {status}: {error_text[:50]}"
                            if error_key not in self.errors:
                                self.errors[error_key] = 0
                            self.errors[error_key] += 1
                            logger.warning(f"Request {request_id} failed: HTTP {status}")
            except asyncio.TimeoutError:
                self.error_count += 1
                error_key = f"Timeout after {self.timeout}s"
                if error_key not in self.errors:
                    self.errors[error_key] = 0
                self.errors[error_key] += 1
                logger.warning(f"Request {request_id} timed out after {self.timeout}s")
            except Exception as e:
                self.error_count += 1
                error_key = f"Exception: {str(e)[:50]}"
                if error_key not in self.errors:
                    self.errors[error_key] = 0
                self.errors[error_key] += 1
                logger.warning(f"Request {request_id} failed with exception: {e}")
    
    def _print_results(self):
        """Print test results"""
        total_time = self.end_time - self.start_time
        requests_per_second = self.total_requests / total_time if total_time > 0 else 0
        success_rate = (self.success_count / self.total_requests) * 100 if self.total_requests > 0 else 0
        
        # Calculate statistics
        if self.response_times:
            avg_response_time = statistics.mean(self.response_times)
            min_response_time = min(self.response_times)
            max_response_time = max(self.response_times)
            p95_response_time = sorted(self.response_times)[int(len(self.response_times) * 0.95)]
            
            # Calculate standard deviation
            if len(self.response_times) > 1:
                stdev_response_time = statistics.stdev(self.response_times)
            else:
                stdev_response_time = 0
        else:
            avg_response_time = min_response_time = max_response_time = p95_response_time = stdev_response_time = 0
        
        # Print summary
        logger.info("=" * 50)
        logger.info("Load Test Results")
        logger.info("=" * 50)
        logger.info(f"Total requests: {self.total_requests}")
        logger.info(f"Concurrency: {self.concurrency}")
        logger.info(f"Total time: {total_time:.2f}s")
        logger.info(f"Requests per second: {requests_per_second:.2f}")
        logger.info(f"Success rate: {success_rate:.2f}%")
        logger.info(f"Successful requests: {self.success_count}")
        logger.info(f"Failed requests: {self.error_count}")
        logger.info("-" * 50)
        logger.info("Response Time Statistics")
        logger.info(f"Average: {avg_response_time:.2f}s")
        logger.info(f"Minimum: {min_response_time:.2f}s")
        logger.info(f"Maximum: {max_response_time:.2f}s")
        logger.info(f"95th percentile: {p95_response_time:.2f}s")
        logger.info(f"Standard deviation: {stdev_response_time:.2f}s")
        
        # Print status code distribution
        logger.info("-" * 50)
        logger.info("Status Code Distribution")
        for status, count in sorted(self.status_codes.items()):
            logger.info(f"HTTP {status}: {count} requests")
        
        # Print errors
        if self.errors:
            logger.info("-" * 50)
            logger.info("Error Distribution")
            for error, count in sorted(self.errors.items(), key=lambda x: x[1], reverse=True):
                logger.info(f"{error}: {count} requests")
        
        # Performance analysis and recommendations
        logger.info("-" * 50)
        logger.info("Performance Analysis and Recommendations")
        
        # Analyze response time
        if avg_response_time > 5.0:
            logger.info("- HIGH RESPONSE TIME: Average response time is high (> 5s)")
            logger.info("  Recommendation: Consider optimizing TTS engine performance or using smaller models")
        
        # Analyze throughput
        if requests_per_second < 1.0:
            logger.info("- LOW THROUGHPUT: Server is processing less than 1 request per second")
            logger.info("  Recommendation: Increase max_concurrent_requests or optimize request handling")
        
        # Analyze success rate
        if success_rate < 90:
            logger.info("- LOW SUCCESS RATE: Less than 90% of requests succeeded")
            logger.info("  Recommendation: Check server logs for errors and increase resource limits")
        
        # Analyze response time variability
        if stdev_response_time > avg_response_time * 0.5 and avg_response_time > 1.0:
            logger.info("- HIGH VARIABILITY: Response times are highly variable")
            logger.info("  Recommendation: Ensure consistent resource allocation and check for resource contention")
        
        # Analyze concurrency
        if self.concurrency > 10 and success_rate < 95:
            logger.info("- CONCURRENCY ISSUES: High concurrency with reduced success rate")
            logger.info("  Recommendation: Reduce concurrency or increase server resources")
        
        # Analyze timeout errors
        timeout_errors = sum(count for error, count in self.errors.items() if "Timeout" in error)
        if timeout_errors > 0:
            timeout_percent = (timeout_errors / self.total_requests) * 100
            logger.info(f"- TIMEOUT ERRORS: {timeout_percent:.1f}% of requests timed out")
            logger.info("  Recommendation: Increase request timeout or optimize TTS processing speed")
        
        # Save results to file
        results = {
            "timestamp": time.time(),
            "config": {
                "base_url": self.base_url,
                "concurrency": self.concurrency,
                "total_requests": self.total_requests,
                "ramp_up": self.ramp_up,
                "timeout": self.timeout,
                "model": self.model,
                "speaker_id": self.speaker_id
            },
            "results": {
                "total_time": total_time,
                "requests_per_second": requests_per_second,
                "success_rate": success_rate,
                "success_count": self.success_count,
                "error_count": self.error_count,
                "response_times": {
                    "average": avg_response_time,
                    "min": min_response_time,
                    "max": max_response_time,
                    "p95": p95_response_time,
                    "stdev": stdev_response_time
                },
                "status_codes": self.status_codes,
                "errors": self.errors
            },
            "recommendations": self._generate_recommendations(
                avg_response_time, requests_per_second, success_rate, 
                stdev_response_time, timeout_errors
            )
        }
        
        # Save results to file
        filename = f"load_test_results_{int(time.time())}.json"
        with open(filename, "w") as f:
            json.dump(results, f, indent=2)
        logger.info(f"Results saved to {filename}")
        
    def _generate_recommendations(
        self, 
        avg_response_time: float, 
        requests_per_second: float,
        success_rate: float,
        stdev_response_time: float,
        timeout_errors: int
    ) -> List[Dict[str, str]]:
        """Generate performance optimization recommendations"""
        recommendations = []
        
        # Response time recommendations
        if avg_response_time > 5.0:
            recommendations.append({
                "issue": "High response time",
                "recommendation": "Consider using smaller TTS models or optimizing the TTS engine",
                "priority": "High"
            })
        
        # Throughput recommendations
        if requests_per_second < 1.0:
            recommendations.append({
                "issue": "Low throughput",
                "recommendation": "Increase max_concurrent_requests setting or optimize request handling",
                "priority": "Medium"
            })
        
        # Success rate recommendations
        if success_rate < 90:
            recommendations.append({
                "issue": "Low success rate",
                "recommendation": "Check server logs for errors and increase resource limits",
                "priority": "High"
            })
        
        # Variability recommendations
        if stdev_response_time > avg_response_time * 0.5 and avg_response_time > 1.0:
            recommendations.append({
                "issue": "High response time variability",
                "recommendation": "Ensure consistent resource allocation and check for resource contention",
                "priority": "Medium"
            })
        
        # Concurrency recommendations
        if self.concurrency > 10 and success_rate < 95:
            recommendations.append({
                "issue": "Concurrency issues",
                "recommendation": "Reduce concurrency or increase server resources",
                "priority": "Medium"
            })
        
        # Timeout recommendations
        if timeout_errors > 0:
            recommendations.append({
                "issue": "Timeout errors",
                "recommendation": "Increase request timeout or optimize TTS processing speed",
                "priority": "High"
            })
        
        # Cache recommendations
        if avg_response_time > 2.0:
            recommendations.append({
                "issue": "Potential for caching improvement",
                "recommendation": "Ensure caching is enabled and properly configured",
                "priority": "Medium"
            })
        
        # Memory recommendations
        if success_rate < 95:
            recommendations.append({
                "issue": "Potential memory issues",
                "recommendation": "Monitor memory usage and consider increasing available memory",
                "priority": "Medium"
            })
        
        return recommendations

async def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Load testing tool for TTS Server")
    parser.add_argument("--url", default="http://localhost:8000", help="Base URL of the TTS server")
    parser.add_argument("--concurrency", type=int, default=5, help="Number of concurrent requests")
    parser.add_argument("--requests", type=int, default=100, help="Total number of requests")
    parser.add_argument("--ramp-up", type=int, default=5, help="Ramp-up time in seconds")
    parser.add_argument("--timeout", type=int, default=60, help="Request timeout in seconds")
    parser.add_argument("--model", help="Model to use for testing")
    parser.add_argument("--speaker", help="Speaker ID to use for testing")
    
    args = parser.parse_args()
    
    tester = LoadTester(
        base_url=args.url,
        concurrency=args.concurrency,
        total_requests=args.requests,
        ramp_up=args.ramp_up,
        timeout=args.timeout,
        model=args.model,
        speaker_id=args.speaker
    )
    
    await tester.run_test()

if __name__ == "__main__":
    asyncio.run(main())