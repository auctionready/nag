import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    category: z.enum(["Release", "Design", "Build log", "Field notes"]),
    readingTime: z.string().optional(),
    featured: z.boolean().optional(),
    number: z.string().optional(),
  }),
});

export const collections = { blog };
