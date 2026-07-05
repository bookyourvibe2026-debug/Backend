import { Request, Response } from "express";
import { BlogPostModel } from "../../models/BlogPost.model";
import { ApiError } from "../../utils/ApiError";
import { sendSuccess } from "../../utils/ApiResponse";
import { asyncHandler } from "../../utils/asyncHandler";

export const listBlogPosts = asyncHandler(async (_req: Request, res: Response) => {
  const posts = await BlogPostModel.find().sort({ createdAt: -1 });
  sendSuccess(res, 200, posts);
});

export const createBlogPost = asyncHandler(async (req: Request, res: Response) => {
  const existing = await BlogPostModel.findOne({ slug: req.body.slug });
  if (existing) throw ApiError.conflict("A post with this slug already exists");

  const post = await BlogPostModel.create({
    ...req.body,
    publishedOn: req.body.status === "Published" ? new Date() : null,
  });
  sendSuccess(res, 201, post, "Post created");
});

export const updateBlogPost = asyncHandler(async (req: Request, res: Response) => {
  const post = await BlogPostModel.findById(req.params.id!);
  if (!post) throw ApiError.notFound("Post not found");

  const wasPublished = post.status === "Published";
  post.set(req.body);
  if (!wasPublished && post.status === "Published") post.publishedOn = new Date();
  await post.save();

  sendSuccess(res, 200, post, "Post updated");
});

export const deleteBlogPost = asyncHandler(async (req: Request, res: Response) => {
  const post = await BlogPostModel.findByIdAndDelete(req.params.id!);
  if (!post) throw ApiError.notFound("Post not found");
  sendSuccess(res, 200, null, "Post deleted");
});
