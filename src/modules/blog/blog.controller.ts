import { Request, Response } from "express";
import { BlogPostModel } from "../../models/BlogPost.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const listPublishedPosts = asyncHandler(async (_req: Request, res: Response) => {
  const posts = await BlogPostModel.find({ status: "Published" }).sort({ publishedOn: -1 });
  sendSuccess(res, 200, posts);
});

export const getPublishedPostBySlug = asyncHandler(async (req: Request, res: Response) => {
  const post = await BlogPostModel.findOne({ slug: req.params.slug, status: "Published" });
  if (!post) throw ApiError.notFound("Post not found");
  sendSuccess(res, 200, post);
});
