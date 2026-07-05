import { Router } from "express";
import { requireAdminPermission } from "../../middleware/permissions.middleware";
import { validate } from "../../middleware/validate.middleware";
import { createBlogPostSchema, idParamSchema, updateBlogPostSchema } from "../../validators/admin.validators";
import { createBlogPost, deleteBlogPost, listBlogPosts, updateBlogPost } from "./admin.blog.controller";

const router = Router();

router.get("/", requireAdminPermission("blog", "view"), listBlogPosts);
router.post("/", requireAdminPermission("blog", "create"), validate({ body: createBlogPostSchema }), createBlogPost);
router.put(
  "/:id",
  requireAdminPermission("blog", "edit"),
  validate({ params: idParamSchema, body: updateBlogPostSchema }),
  updateBlogPost
);
router.delete("/:id", requireAdminPermission("blog", "delete"), validate({ params: idParamSchema }), deleteBlogPost);

export default router;
