#!/usr/bin/env python3
"""
Test script to demonstrate the difference in streaming speeds
"""
import asyncio
import time
from services.gemini_client import get_gemini_client

async def test_streaming_speed():
    """Test different streaming modes"""
    gemini_client = get_gemini_client()
    
    test_message = "Hello world! This is a test of ultra-fast streaming."
    
    print("🚀 Testing BLAZING FAST Streaming Speed")
    print("=" * 50)
    
    # Test 1: Original streaming (word-level)
    print("\n📊 Test 1: Word-level streaming")
    start_time = time.time()
    token_count = 0
    
    async for chunk in gemini_client.chat_with_tools_streaming(
        test_message, 
        [], 
        ultra_fast_streaming=False
    ):
        if chunk["type"] == "text":
            token_count += 1
            print(f"Token {token_count}: '{chunk['content']}' (t={chunk['timestamp']:.3f})")
    
    word_time = time.time() - start_time
    print(f"✅ Word-level: {token_count} tokens in {word_time:.2f}s")
    
    # Test 2: BLAZING FAST streaming (3-char batches)
    print("\n⚡ Test 2: BLAZING FAST streaming (3-char batches)")
    start_time = time.time()
    char_count = 0
    
    async for chunk in gemini_client.chat_with_tools_streaming(
        test_message, 
        [], 
        ultra_fast_streaming=True
    ):
        if chunk["type"] == "text":
            char_count += 1
            if char_count <= 10:  # Show first 10 batches
                print(f"Batch {char_count}: '{chunk['content']}' (t={chunk['timestamp']:.6f})")
    
    char_time = time.time() - start_time
    print(f"✅ BLAZING FAST: {char_count} batches in {char_time:.3f}s")
    
    # Calculate speed improvement
    if char_time > 0:
        speed_improvement = word_time / char_time
        print(f"\n🎯 Speed Improvement: {speed_improvement:.1f}x faster with character-level streaming")
    
    print("\n📈 Streaming Rate Comparison:")
    print(f"   Word-level: {token_count/word_time:.1f} tokens/second")
    print(f"   BLAZING FAST: {char_count/char_time:.1f} batches/second")
    print(f"   Estimated chars/second: {(char_count * 3)/char_time:.1f}")  # 3 chars per batch

if __name__ == "__main__":
    asyncio.run(test_streaming_speed())
