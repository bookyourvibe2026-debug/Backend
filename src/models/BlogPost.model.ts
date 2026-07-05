import { Schema, model, Types } from "mongoose";

export interface BlogPostDocument {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  thumbnail?: string;
  content: string;
  status: "Published" | "Draft";
  publishedOn?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const blogPostSchema = new Schema<BlogPostDocument>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    thumbnail: { type: String },
    content: { type: String, required: true },
    status: { type: String, enum: ["Published", "Draft"], default: "Draft" },
    publishedOn: { type: Date, default: null },
  },
  { timestamps: true }
);

export const BlogPostModel = model<BlogPostDocument>("BlogPost", blogPostSchema);
