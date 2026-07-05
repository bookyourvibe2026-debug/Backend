import { Router } from "express";
import { getPublishedPostBySlug, listPublishedPosts } from "./blog.controller";

const router = Router();

router.get("/", listPublishedPosts);
router.get("/:slug", getPublishedPostBySlug);

export default router;
