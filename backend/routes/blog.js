const express = require("express");
const { body } = require("express-validator/check");

const isAuth = require("../middlewares/is-auth");
const blogController = require("../Controller/blog");

const router = express.Router();

router.get("/posts", isAuth, blogController.getPosts);

router.get("/post/:postId", isAuth, blogController.getPost);

router.post(
  "/post",
  isAuth,
  [
    body("title").trim().isLength({ min: 5 }),
    body("content").trim().isLength({ min: 5 }),
  ],
  blogController.createPost
);

router.put(
  "/post/:postId",
  isAuth,
  [
    body("title").trim().isLength({ min: 5 }),
    body("content").trim().isLength({ min: 5 }),
  ],
  blogController.updatePost
);

router.delete("/post/:postId", isAuth, blogController.deletePost);

module.exports = router;
