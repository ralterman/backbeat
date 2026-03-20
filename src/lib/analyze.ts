import Anthropic from "@anthropic-ai/sdk";
import { VideoAnalysis } from "@/lib/matching";

function getClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

const ANALYSIS_PROMPT = `You are an expert music supervisor and video editor analyzing video frames to recommend background music.

Analyze the provided video frames and return a JSON object with the following structure:

{
  "mood_tags": ["tag1", "tag2", ...],       // 3-6 mood descriptors (e.g., "epic", "calm", "melancholic", "energetic", "romantic", "tense", "joyful", "mysterious")
  "bpm_range": { "min": number, "max": number }, // estimated suitable BPM range for music (e.g., {"min": 80, "max": 110})
  "energy_score": number,                    // 1-10 scale (1=very calm/ambient, 10=extremely high energy)
  "scene_tags": ["tag1", "tag2", ...],      // 3-6 visual scene descriptors (e.g., "outdoor", "urban", "nature", "action", "intimate", "crowd", "travel")
  "recommended_genres": ["genre1", ...]     // 2-4 recommended music genres that would suit this video best
}

Consider these factors when analyzing:
- Color temperature: warm tones suggest acoustic/pop, cool tones suggest electronic/cinematic
- Motion and pacing: fast cuts → high BPM/energy, slow pans → ambient/cinematic
- Subject matter: nature → acoustic/ambient, urban → hip-hop/electronic, dramatic action → cinematic/rock
- Lighting: bright/sunny → upbeat pop, dark/moody → ambient/jazz/cinematic
- Emotion conveyed by subjects (faces, body language)

Respond ONLY with valid JSON. No markdown, no explanation.`;

export async function analyzeVideoFrames(
  base64Frames: string[]
): Promise<VideoAnalysis> {
  const imageContent: Anthropic.ImageBlockParam[] = base64Frames.map(
    (frame) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/jpeg" as const,
        data: frame,
      },
    })
  );

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          ...imageContent,
          {
            type: "text",
            text: ANALYSIS_PROMPT,
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  try {
    const parsed = JSON.parse(textBlock.text) as VideoAnalysis;
    // Validate required fields
    if (
      !Array.isArray(parsed.mood_tags) ||
      !parsed.bpm_range ||
      typeof parsed.energy_score !== "number" ||
      !Array.isArray(parsed.scene_tags) ||
      !Array.isArray(parsed.recommended_genres)
    ) {
      throw new Error("Invalid response structure from Claude");
    }
    return parsed;
  } catch {
    // Return a safe fallback on parse failure
    console.error("Failed to parse Claude response:", textBlock.text);
    return {
      mood_tags: ["neutral", "calm"],
      bpm_range: { min: 80, max: 120 },
      energy_score: 5,
      scene_tags: ["general"],
      recommended_genres: ["cinematic", "acoustic"],
    };
  }
}
