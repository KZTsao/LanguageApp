const Groq = require("groq-sdk");

console.log("[groqClient] Using API Key:", (process.env.GROQ_API_KEY || "").slice(0, 6) + "******");

const client = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

module.exports = client;
