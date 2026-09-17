"use server";
import { renderRich } from "@/ui/rich-text";
/** Renders trusted explanation Markdown (from our own question bank) to HTML for client players. */
export async function renderExplanationAction(md: string): Promise<string> { return renderRich(md.slice(0, 6000)); }
