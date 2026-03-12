import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";

export const contentType = "image/png";

export const size = {
  width: 180,
  height: 180,
};

async function getIconDataUrl(): Promise<string> {
  const iconSvg = await readFile(new URL("./icon.svg", import.meta.url), "utf8");

  return `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString("base64")}`;
}

export default async function AppleIcon(): Promise<ImageResponse> {
  const iconDataUrl = await getIconDataUrl();

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#111827",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <img
        alt=""
        src={iconDataUrl}
        style={{
          height: 112,
          width: 112,
        }}
      />
    </div>,
    size,
  );
}
