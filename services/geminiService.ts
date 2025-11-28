import { ApiConfig } from "../types";

// Helper to convert File to Base64 (Raw base64 data without prefix)
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const parts = base64String.split(",");
      const base64Data = parts.length > 1 ? parts[1] : base64String;
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper to extract image URL from content
const extractImageFromContent = (content: string): string => {
  if (!content) {
    throw new Error("API 返回了空内容");
  }

  // 1. Try to extract markdown image link: ![alt](url)
  const imageMatch = content.match(/!\[.*?\]\((.*?)\)/);
  if (imageMatch && imageMatch[1]) {
    return imageMatch[1];
  }

  // 2. Check if the content itself looks like a URL
  const trimmed = content.trim();
  if (trimmed.startsWith("http") || trimmed.startsWith("data:image")) {
      return trimmed;
  }
  
  // 3. Fallback
  throw new Error("未在响应中检测到生成的图片。请确保模型返回了图片链接或 Base64 数据。");
};

// Default Prompt (English instructions work better for complex formatting on v3 models)
const DEFAULT_PROMPT = `
Generate a sticker sheet featuring a Chibi-style, LINE sticker-like character based on the input image.
The character should maintain key features like headwear from the original image.
Style: Hand-drawn color illustration.
Layout: 4x6 grid (24 stickers total).
Content: Various common chat expressions and fun memes.
Language: All text must be in Handwritten Simplified Chinese.
Do not just copy the original image. Create expressive, stylized stickers.
`;

// --- OpenAI Format Implementation ---
export const generateStickerPackOpenAI = async (
  imageFile: File,
  config: ApiConfig
): Promise<string> => {
  
  const base64Image = await fileToGenerativePart(imageFile);
  const mimeType = imageFile.type;

  // Intelligent URL Normalization
  let fetchUrl = config.baseUrl.trim().replace(/\/+$/, ""); // Remove trailing slashes
  
  // If user didn't provide the full path, append it smartly
  if (!fetchUrl.endsWith("/chat/completions")) {
      if (fetchUrl.endsWith("/v1")) {
          fetchUrl += "/chat/completions";
      } else {
          fetchUrl += "/v1/chat/completions";
      }
  }

  const payload = {
    model: config.model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: DEFAULT_PROMPT },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`
            }
          }
        ]
      }
    ],
    stream: true 
  };

  try {
    const response = await fetch(fetchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`API 请求失败 (${response.status}): ${errorText}`);
    }

    if (!response.body) throw new Error("API 响应没有内容体");

    // Case A: JSON Fallback
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
       const json = await response.json();
       const content = json.choices?.[0]?.message?.content || "";
       return extractImageFromContent(content);
    }

    // Case B: SSE Stream Parsing
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let fullContent = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;
        if (trimmedLine === "data: [DONE]") continue;

        try {
          const jsonStr = trimmedLine.substring(6); 
          const json = JSON.parse(jsonStr);
          const deltaContent = json.choices?.[0]?.delta?.content;
          if (deltaContent) fullContent += deltaContent;
        } catch (e) {
          // ignore parse errors for partial chunks
        }
      }
    }

    return extractImageFromContent(fullContent);

  } catch (error: any) {
    console.error("OpenAI Generation Error:", error);
    throw error;
  }
};