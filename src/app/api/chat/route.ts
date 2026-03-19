import { Mppx, tempo } from "mppx/server";
import OpenAI from "openai";

const ALPHA_USD = "0x20c0000000000000000000000000000000000001" as const;
const COST_PER_MESSAGE = "0.01";

const mppx = Mppx.create({
  secretKey: process.env.MPP_SECRET_KEY!,
  methods: [
    tempo({
      testnet: true,
      currency: ALPHA_USD,
      recipient: process.env.MERCHANT_WALLET_ADDRESS as `0x${string}`,
    }),
  ],
});

export async function POST(request: Request) {
  const result = await mppx.charge({ amount: COST_PER_MESSAGE })(request);
  if (result.status === 402) return result.challenge;

  const { messages } = (await request.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  const reply = await getReply(messages);
  return result.withReceipt(Response.json({ reply }));
}

async function getReply(
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return `[mock] You said: "${messages.at(-1)?.content}". (Set OPENAI_API_KEY to use real GPT.)`;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1024,
    messages,
  });

  return completion.choices[0]?.message?.content ?? "";
}
