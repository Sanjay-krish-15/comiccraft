import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function gateway(body: unknown) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("Too many requests — please wait a moment and try again.");
  if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  return res.json();
}

export type Panel = { caption: string; dialogue: string; scene: string };
export type Story = { title: string; panels: Panel[] };

export const generateStory = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        idea: z.string().min(3).max(1000),
        hero: z.string().max(100),
        tone: z.string().max(40),
        style: z.string().max(40),
        panels: z.number().int().min(2).max(8),
        previous: z.string().max(4000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<Story> => {
    const prompt = `Write a ${data.tone} comic book story with exactly ${data.panels} panels.
Story idea: ${data.idea}
Main character: ${data.hero || "an original hero"}
Art style (for scene descriptions): ${data.style}
${data.previous ? `Revise this previous version with the new tone/style while keeping the plot:\n${data.previous}` : ""}
Each panel needs: a short narration caption, one short line of dialogue, and a vivid visual scene description for an illustrator (characters' appearance kept consistent).`;
    const json = await gateway({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "You are a professional comic book writer." },
        { role: "user", content: prompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "comic",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                panels: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      caption: { type: "string" },
                      dialogue: { type: "string" },
                      scene: { type: "string" },
                    },
                    required: ["caption", "dialogue", "scene"],
                  },
                },
              },
              required: ["title", "panels"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "comic" } },
    });
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("Story generation failed");
    return JSON.parse(args) as Story;
  });

export const generatePanelImage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ scene: z.string().max(2000), style: z.string().max(40) }).parse(d))
  .handler(async ({ data }) => {
    const json = await gateway({
      model: "google/gemini-3.1-flash-image",
      messages: [
        {
          role: "user",
          content: `Comic book panel illustration, ${data.style} style, no text or speech bubbles, square composition. Scene: ${data.scene}`,
        },
      ],
      modalities: ["image", "text"],
    });
    const url: string | undefined = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!url) throw new Error("Image generation failed");
    return { url };
  });
