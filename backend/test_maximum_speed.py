#!/usr/bin/env python3
"""
Test script to demonstrate MAXIMUM SPEED streaming
"""
import asyncio
import time
from services.gemini_client import get_gemini_client

async def test_maximum_speed():
    """Test MAXIMUM SPEED streaming"""
    gemini_client = get_gemini_client()
    
    test_message = "Write a quick response about artificial intelligence."
    
    print("🚀 Testing MAXIMUM SPEED Streaming")
    print("=" * 50)
    
    # Test MAXIMUM SPEED streaming
    print("\n⚡ MAXIMUM SPEED Test (15-char batches, ZERO delay)")
    start_time = time.time()
    first_token_time = None
    batch_count = 0
    total_chars = 0
    
    async for chunk in gemini_client.chat_with_tools_streaming(
        test_message, 
        [], 
        ultra_fast_streaming=True
    ):
        if chunk["type"] == "text":
            batch_count += 1
            total_chars += len(chunk["content"])
            
            # Record first token time
            if first_token_time is None:
                first_token_time = time.time()
                print(f"🎯 FIRST TOKEN: '{chunk['content']}' at {first_token_time - start_time:.3f}s")
            
            if batch_count <= 5:  # Show first 5 batches
                print(f"Batch {batch_count}: '{chunk['content']}' ({len(chunk['content'])} chars)")
    
    total_time = time.time() - start_time
    time_to_first_token = first_token_time - start_time if first_token_time else 0
    
    print(f"\n📊 MAXIMUM SPEED Results:")
    print(f"   First token time: {time_to_first_token:.3f}s")
    print(f"   Total time: {total_time:.3f}s")
    print(f"   Total batches: {batch_count}")
    print(f"   Total characters: {total_chars}")
    print(f"   Characters/second: {total_chars/total_time:.1f}")
    print(f"   Batches/second: {batch_count/total_time:.1f}")
    
    # Speed assessment
    if time_to_first_token < 0.1:
        print("   🚀 BLAZING FAST - First token under 100ms!")
    elif time_to_first_token < 0.2:
        print("   ⚡ VERY FAST - First token under 200ms!")
    else:
        print("   🐌 Needs optimization")
    
    if total_chars/total_time > 100:
        print("   🚀 BLAZING FAST - Over 100 chars/second!")
    elif total_chars/total_time > 50:
        print("   ⚡ VERY FAST - Over 50 chars/second!")
    else:
        print("   🐌 Needs optimization")

if __name__ == "__main__":
    asyncio.run(test_maximum_speed())

