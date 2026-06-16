import "dotenv/config";

async function testFetch() {
  console.log("Direct fetch to NVIDIA...");
  const apiKey = process.env.NVIDIA_API_KEY;
  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta/llama-3.3-70b-instruct",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 10
      }),
    });
    
    if (response.ok) {
        console.log("✅ Fetch successful!");
        console.log(await response.json());
    } else {
        console.log("❌ Fetch rejected with status", response.status);
        console.log(await response.text());
    }
  } catch (error: any) {
    console.error("❌ Fetch failed with exception:");
    console.error(error);
  }
}

testFetch();
