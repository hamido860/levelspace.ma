import "dotenv/config";
import { generateAIResponse } from "./src/lib/ai/provider";

async function testNvidia() {
  console.log("Testing NVIDIA AI Provider...");
  try {
    const response = await generateAIResponse({
      provider: "nvidia",
      prompt: "Write a haiku about artificial intelligence.",
      maxOutputTokens: 50,
      temperature: 0.7
    });
    console.log("✅ NVIDIA connection successful!");
    console.log("Response:", response);
  } catch (error: any) {
    console.error("❌ NVIDIA connection failed:");
    console.error(error.message || error);
  }
}

testNvidia();
