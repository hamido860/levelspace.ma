import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const apiKey = process.env.VITE_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY;

if (!apiKey) {
  console.error("❌ No NVIDIA API key found in .env");
  console.error("Please add VITE_NVIDIA_API_KEY or NVIDIA_API_KEY to your .env file.");
  process.exit(1);
}

const NVIDIA_MODEL = "google/gemma-3-27b-it";

async function main() {
  console.log(`🤖 Testing NVIDIA API with model: ${NVIDIA_MODEL}...`);
  console.log("--------------------------------------------------");

  try {
    const startTime = Date.now();
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages: [{ role: "user", content: "Tell me a very short joke." }],
        temperature: 0.7,
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`NVIDIA API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const endTime = Date.now();

    console.log("✅ API call successful!");
    console.log(`⏱️  Response time: ${endTime - startTime}ms`);
    console.log("\nResponse content:");
    console.log(data.choices?.[0]?.message?.content || data);
    console.log("\n--------------------------------------------------");
    console.log("To use this in the app, the model 'google/gemma-3-27b-it' is already configured in src/services/geminiService.ts");

  } catch (error) {
    console.error("❌ NVIDIA API call failed:");
    console.error(error);
  }
}

main();
